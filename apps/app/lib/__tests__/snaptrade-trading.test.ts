import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ owner: "owner", list: vi.fn(), links: vi.fn(), quotes: vi.fn(), orders: vi.fn(),
    generations: new Map<string, number>(), orderDetail: vi.fn(), positions: vi.fn(), details: vi.fn(), partner: vi.fn(), balances: vi.fn(), preview: vi.fn(), place: vi.fn(), force: vi.fn(), login: vi.fn(),
    rows: new Map<string, any>(), sequence: 0, scope: null as string | null, denied: null as Response | null }))
vi.mock("@/lib/snaptrade-session", () => ({ loadSession: async () => ({ clientId: "key", userId: "vendor-user", userSecret: "fixture" }) }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => m.owner }))
vi.mock("@/lib/snaptrade-access", () => ({ brokerageReadScope: async () => m.denied ? { denied: m.denied } : ({ countedConnectionId: m.scope }) }))
vi.mock("@/lib/snaptrade", () => ({ isTradingKeyApproved: (id: string) => (process.env.SNAPTRADE_TRADING_APPROVED_CLIENT_IDS ?? "").split(",").includes(id), mapOrderRecord: (x: any) => ({ brokerageOrderId: x.brokerage_order_id, status: x.status }),
    getSnapTrade: () => ({ accountInformation: { listUserAccounts: m.list, getAccountDetails: m.details, getUserAccountOrders: m.orders,
        getUserAccountOrderDetail: m.orderDetail, getAllAccountPositions: m.positions, getUserAccountBalance: m.balances },
        referenceData: { getPartnerInfo: m.partner }, connections: { listBrokerageAuthorizations: m.links }, authentication: { loginSnapTradeUser: m.login },
        trading: { getUserAccountQuotes: m.quotes, getOrderImpact: m.preview, placeOrder: m.place, placeForceOrder: m.force } }) }))
// Durable-store interface fixture: atomic state transitions, no Supabase/network.
vi.mock("@/lib/snaptrade-order-reviews", () => ({
    captureReviewGeneration: async (owner: string) => String(m.generations.get(owner) ?? 0),
    ownerReservation: async (owner: string) => { const r = [...m.rows.values()].find(r => r.owner_id === owner && ["submitting", "unknown", "complete"].includes(r.state)); return r ? { ...r } : null },
    resolveAcknowledgedReview: async (review: any, generation: string, evidence: any) => {
        const r = m.rows.get(review.id)
        if (!r || r.state !== "complete" || String(m.generations.get(r.owner_id) ?? 0) !== generation || r.client_id !== review.client_id || r.vendor_user_id !== review.vendor_user_id) return false
        r.state = "resolved"; r.result = { ...r.result, status: evidence.status, reconciliation: evidence }
        m.generations.set(r.owner_id, Number(generation) + 1)
        for (const other of m.rows.values()) if (other.owner_id === r.owner_id && other.state === "reviewing") other.state = "invalidated"
        return true
    },
    saveReview: async (r: any) => {
        if (r.generation !== String(m.generations.get(r.owner_id) ?? 0)) throw new TradingError("order_review_stale", "Review generation changed.", 409)
        if ([...m.rows.values()].some(row => row.owner_id === r.owner_id && ["submitting", "unknown", "complete"].includes(row.state)))
            throw new TradingError("order_reconciliation_required", "An earlier submission must be reconciled.", 409)
        const row = { ...r, id: `review-${++m.sequence}`, state: "reviewing" }; m.rows.set(row.id, row); return row },
    loadReview: async (id: string, owner: string) => { const r = m.rows.get(id); return r?.owner_id === owner ? { ...r } : null },
    consumeReview: async (id: string, owner: string, client: string, vendor: string) => {
        const r = m.rows.get(id)
        if (!r || r.generation !== String(m.generations.get(owner) ?? 0) || r.state !== "reviewing" || r.owner_id !== owner || r.client_id !== client || r.vendor_user_id !== vendor
            || Date.parse(r.expires_at) <= Date.now() || [...m.rows.values()].some(r => ["submitting", "unknown", "complete"].includes(r.state))) return false
        r.state = "submitting"
        m.generations.set(owner, (m.generations.get(owner) ?? 0) + 1)
        for (const other of m.rows.values()) if (other.id !== id && other.owner_id === owner && other.state === "reviewing") other.state = "invalidated"
        return true
    },
    finishReview: async (id: string, _owner: string, result: any, unknown: boolean) => {
        Object.assign(m.rows.get(id), { state: unknown ? "unknown" : "complete", result })
    },
}))
import { impact, place, quote, upgrade } from "../snaptrade-trading-routes"
import { terms, TradingError } from "../snaptrade-trading"
const order = { accountId: "a", symbol: "AAPL", action: "BUY", units: 2, orderType: "Limit", timeInForce: "Day", price: 10, stop: null }
const req = (body: any) => new NextRequest("https://test.invalid/api", { method: "POST", body: JSON.stringify(body) })
async function review(body = order) { return (await impact(req(body))).json() }
async function submit(r: any, body = {}) { return place(req({ reviewId: r.reviewId, confirmed: true, terms: r.terms, ...body })) }
beforeEach(() => {
    vi.resetAllMocks(); m.rows.clear(); m.generations.clear(); m.sequence = 0; m.owner = "owner"; m.scope = null; m.denied = null
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true")
    vi.stubEnv("SNAPTRADE_TRADE_CONNECTIONS_ENABLED", "true")
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [{ slug: "BROKER", allows_trading: true, enabled: true, maintenance_mode: false }] } })
    vi.stubEnv("SNAPTRADE_TRADING_APPROVED_CLIENT_IDS", "key")
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ BROKER: { orderTypes: ["Market", "Limit"], timeInForce: ["Day", "GTC"], fractional: false, preview: false, exchanges: ["XNAS"] } }))
    vi.stubEnv("SNAPTRADE_TRADING_CASH_ACCOUNT_POLICIES", JSON.stringify([{ clientId: "key", vendorUserId: "vendor-user", accountId: "a", mode: "cash", providerRawType: "fixture-cash", evidenceRef: "fixture-reviewed-policy", validUntil: "2100-01-01T00:00:00Z" }]))
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("LIVE REQUEST FORBIDDEN") }))
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: "cash" } })
    m.list.mockResolvedValue({ data: [{ id: "a", brokerage_authorization: "c", status: "open", raw_type: "fixture-cash", account_category: "INVESTMENT" }] })
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug: "BROKER", allows_trading: true } }] })
    m.quotes.mockResolvedValue({ data: [{ symbol: { id: "listing", symbol: "AAPL", type: { code: "cs" }, currency: { id: "currency-usd", code: "USD" }, exchange: { code: "XNAS" } }, ask_price: 10 }] })
    m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 100 }] })
    m.positions.mockResolvedValue({ data: { results: [{ units: "3", instrument: { kind: "stock", id: "v2-instrument", symbol: "AAPL", exchange: "XNAS", currency: "USD" }, currency: "USD" }] } })
    m.orders.mockResolvedValue({ data: [] })
    m.force.mockResolvedValue({ data: { brokerage_order_id: "recorded-order", status: "ACCEPTED" } })
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it("defaults to unavailable before vendor calls without explicit commercial/key release approval", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "false")
    expect((await impact(req(order))).status).toBe(503); expect(m.list).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("never accepts client-selected account or foreign review", async () => {
    expect((await impact(req({ ...order, accountId: "foreign" }))).status).toBe(404)
    expect(m.quotes).not.toHaveBeenCalled()
    const r = await review(); m.owner = "other"
    expect((await submit(r)).status).toBe(404); expect(m.force).not.toHaveBeenCalled()
})
it("rechecks counted plan, explicit trade permission and confirmed vendor capability", async () => {
    m.scope = "other"; expect((await impact(req(order))).status).toBe(403)
    m.scope = null; m.links.mockResolvedValue({ data: [{ id: "c", type: "read" }] })
    expect((await quote(req(order))).status).toBe(403); expect(m.quotes).not.toHaveBeenCalled()
})
it.each([{ units: 0 }, { units: -1 }, { units: "2" }, { units: 0.0000001 }, { orderType: "Stop" }, { notionalValue: 2 }, { price: 0 }, { timeInForce: "IOC" }, { stop: 10 }])("rejects malformed terms before vendor calls: %j", async changes => {
    expect((await impact(req({ ...order, ...changes }))).status).toBe(400); expect(m.list).not.toHaveBeenCalled()
})
it("rejects nonfinite numeric values and canonicalizes nulls/case without coercing", () => {
    expect(() => terms({ ...order, units: NaN })).toThrow(); expect(() => terms({ ...order, units: Infinity })).toThrow()
    expect(terms({ ...order, symbol: " aapl ", stop: undefined }).symbol).toBe("AAPL")
})
it("blocks oversell, stale unknown cash, fractional unsupported and open orders", async () => {
    expect((await impact(req({ ...order, action: "SELL", units: 4 }))).status).toBe(400)
    m.balances.mockResolvedValue({ data: [] }); expect((await impact(req(order))).status).toBe(400)
    m.orders.mockResolvedValue({ data: [{ status: "ACCEPTED" }] }); expect((await impact(req(order))).status).toBe(409)
    expect(m.force).not.toHaveBeenCalled()
})
it("no-preview capability returns honest unavailable estimate; review executes only after explicit confirmed canonical terms", async () => {
    const r = await review(); expect(r.estimate.source).toBe("unavailable"); expect(r.estimate).not.toHaveProperty("estimatedCommission")
    expect(m.preview).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
    expect((await submit(r, { confirmed: false })).status).toBe(400)
    expect((await submit(r, { terms: { ...r.terms, units: 3 } })).status).toBe(409)
    expect((await submit(r)).status).toBe(200); expect(m.force).toHaveBeenCalledOnce()
    expect(m.force.mock.calls[0][0]).toMatchObject({ account_id: "a", universal_symbol_id: "listing", units: 2, price: 10, client_order_id: r.reviewId })
})
it("atomically submits at most once across replay/concurrent confirmations, with used preceding expiry", async () => {
    const r = await review(); const responses = await Promise.all([submit(r), submit(r)])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect(m.force).toHaveBeenCalledOnce()
    m.rows.get(r.reviewId).expires_at = "2000-01-01T00:00:00Z"
    expect((await (await submit(r)).json()).code).toBe("order_review_used")
})
it("uncertain transport result locks execution and blocks another review submission without blind retry", async () => {
    const r = await review(), r2 = await review(); m.force.mockRejectedValue(new Error("timeout"))
    expect((await (await submit(r)).json()).code).toBe("order_status_unknown")
    expect((await (await submit(r2)).json()).code).toBe("order_review_used"); expect(m.force).toHaveBeenCalledOnce()
})
it("revalidates permission, holdings, cash and listing immediately before consume", async () => {
    const r = await review(); m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 0 }] })
    expect((await submit(r)).status).toBe(400); expect(m.rows.get(r.reviewId).state).toBe("reviewing"); expect(m.force).not.toHaveBeenCalled()
})
it("explicit owned upgrade never deletes a link or silently grants permission", async () => {
    expect((await upgrade(req({ connectionId: "c" }))).status).toBe(400)
    expect((await upgrade(req({ connectionId: "foreign", consent: true }))).status).toBe(404)
    m.links.mockResolvedValue({ data: [{ id: "c", type: "read", disabled: false, brokerage: { slug: "BROKER", allows_trading: true } }] })
    m.login.mockResolvedValue({ data: { redirectURI: "https://portal.invalid/consent" } })
    expect((await upgrade(req({ connectionId: "c", consent: true }))).status).toBe(200)
    expect(m.login.mock.calls[0][0]).toMatchObject({ reconnect: "c", connectionType: "trade" })
})
it("honors broker-supported preview mode with real nullable fee fields and checked-only submission", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ BROKER: { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["XNAS"] } }))
    m.preview.mockResolvedValue({ data: { trade: { id: "checked", account: "a", action: "BUY", units: 2, order_type: "Limit", time_in_force: "Day", price: 10, symbol: { universal_symbol_id: "listing" } }, trade_impacts: [{ account: "a", estimated_commission: 0, remaining_cash: 80, forex_fees: null, currency: "currency-usd" }] } })
    m.place.mockResolvedValue({ data: { brokerage_order_id: "checked-order", status: "ACCEPTED" } })
    const r = await review(); expect(r.estimate).toMatchObject({ source: "brokerage", estimatedCommission: 0, forexFees: null })
    expect((await submit(r)).status).toBe(200); expect(m.place).toHaveBeenCalledOnce(); expect(m.force).not.toHaveBeenCalled()
})
it("never converts a preview outage to a direct order and never uses provider-mutated terms", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ BROKER: { orderTypes: ["Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["XNAS"] } }))
    m.preview.mockRejectedValue(new Error("unavailable")); expect((await impact(req(order))).status).toBe(503)
    m.preview.mockResolvedValue({ data: { trade: { id: "bad", units: 3 } } }); expect((await impact(req(order))).status).toBe(502)
    expect(m.rows.size).toBe(0); expect(m.force).not.toHaveBeenCalled(); expect(m.place).not.toHaveBeenCalled()
})
it("expires unconsumed reviews and binds both registration key and listing", async () => {
    const r = await review(); m.rows.get(r.reviewId).expires_at = "2000-01-01T00:00:00Z"
    expect((await (await submit(r)).json()).code).toBe("order_review_expired")
    m.rows.get(r.reviewId).expires_at = "2100-01-01T00:00:00Z"; m.rows.get(r.reviewId).client_id = "other-key"
    expect((await (await submit(r)).json()).code).toBe("order_review_mismatch")
    m.rows.get(r.reviewId).client_id = "key"; m.rows.get(r.reviewId).symbol_id = "other-listing"
    expect((await (await submit(r)).json()).code).toBe("order_review_mismatch"); expect(m.force).not.toHaveBeenCalled()
})
it("different simultaneous reviews serialize submissions across an owner", async () => {
    const a = await review(), b = await review(); let finish: (value: any) => void = () => {}
    m.force.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const first = submit(a)
    await vi.waitFor(() => expect(m.force).toHaveBeenCalledOnce())
    expect((await submit(b)).status).toBe(409)
    finish({ data: { brokerage_order_id: "recorded-order", status: "ACCEPTED" } }); expect((await first).status).toBe(200)
})
function previewSetup(impacts: any[], changes = {}) {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ BROKER: { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: true, preview: true, exchanges: ["XNAS"] } }))
    m.preview.mockResolvedValue({ data: { trade: { id: "checked", account: "a", action: "BUY", units: 2, order_type: "Limit", time_in_force: "Day", price: 50, symbol: { universal_symbol_id: "listing" }, ...changes }, trade_impacts: impacts } })
}
it("rejects exact gross-affordable100 plus1 commission / matching-account net cash minus1", async () => {
    previewSetup([{ account: "a", currency: "currency-usd", estimated_commission: 1, remaining_cash: -1 }])
    const response = await impact(req({ ...order, price: 50 }))
    expect((await response.json()).code).toBe("order_funds_insufficient"); expect(m.rows.size).toBe(0)
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("rejects fee-inclusive deficit even if provider remaining_cash is missing or inconsistent", async () => {
    previewSetup([{ account: "a", currency: "currency-usd", estimated_commission: 1, remaining_cash: 0 }])
    expect((await impact(req({ ...order, price: 50 }))).status).toBe(400); expect(m.rows.size).toBe(0)
})
it("persists bound fee facts and revalidates fee-inclusive cash at submit before consume", async () => {
    previewSetup([{ account: "a", currency: "currency-usd", estimated_commission: 1, forex_fees: 0.5, remaining_cash: 18.5 }], { price: 40 })
    const r = await review({ ...order, price: 40 })
    expect(m.rows.get(r.reviewId).impact_facts).toMatchObject({ accountId: "a", currencyId: "currency-usd", currency: "USD", estimatedCommission: 1, forexFees: 0.5 })
    expect(r.estimate.currency).toBe("USD")
    m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 81 }] })
    const response = await submit(r), body = await response.json()
    expect(body).toMatchObject({ code: "order_funds_insufficient", submissionStatus: "not_submitted_by_this_request" })
    expect(m.rows.get(r.reviewId).state).toBe("reviewing"); expect(m.place).not.toHaveBeenCalled()
})
it.each([
    { account: "foreign", currency: "currency-usd" },
    { account: "a", currency: "currency-cad" },
    { account: "a", currency: "USD" },
])("omits unbound monetary estimates without relabeling UUID/account: %j", async mismatch => {
    previewSetup([{ ...mismatch, estimated_commission: 7, remaining_cash: -99, forex_fees: 2 }], { price: 10 })
    const r = await review()
    expect(r.estimate.source).toBe("unavailable")
    for (const key of ["price", "currency", "estimatedCommission", "forexFees", "remainingCash"]) expect(r.estimate).not.toHaveProperty(key)
    expect(m.rows.get(r.reviewId).impact_facts).toBeNull()
})
it("finds the correct matching-account impact beyond the first item, with provider ISO not account base currency", async () => {
    previewSetup([{ account: "foreign", currency: "currency-usd", estimated_commission: 999 },
        { account: "a", currency: "currency-usd", estimated_commission: 2, remaining_cash: 78 }], { price: 10 })
    m.list.mockResolvedValue({ data: [{ id: "a", brokerage_authorization: "c", raw_type: "fixture-cash", status: "open", account_category: "INVESTMENT", balance: { total: { currency: "CAD", amount: 100 } } }] })
    const r = await review(); expect(r.estimate).toMatchObject({ estimatedCommission: 2, remainingCash: 78, currency: "USD" })
})
it("preserves structured subscription outage503 on upgrade without issuing portal URL", async () => {
    m.links.mockResolvedValue({ data: [{ id: "c", type: "read", brokerage: { slug: "BROKER", allows_trading: true } }] })
    m.denied = Response.json({ code: "entitlement_unavailable", error: "Subscription service unavailable" }, { status: 503 })
    const response = await upgrade(req({ connectionId: "c", consent: true }))
    expect(response.status).toBe(503); expect((await response.json()).code).toBe("entitlement_unavailable")
    expect(m.login).not.toHaveBeenCalled()
})
it.each([false, undefined])("requires positive provider fractional capability, not allowlist alone: %s", async allows => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ BROKER: { orderTypes: ["Limit"], timeInForce: ["Day"], fractional: true, preview: false, exchanges: ["XNAS"] } }))
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", brokerage: { slug: "BROKER", allows_trading: true, allows_fractional_units: allows } }] })
    expect((await impact(req({ ...order, units: 0.5 }))).status).toBe(400); expect(m.force).not.toHaveBeenCalled()
})
it("permits fractional review only when provider and reviewed policy agree", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ BROKER: { orderTypes: ["Limit"], timeInForce: ["Day"], fractional: true, preview: false, exchanges: ["XNAS"] } }))
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", brokerage: { slug: "BROKER", allows_trading: true, allows_fractional_units: true } }] })
    expect((await impact(req({ ...order, units: 0.5 }))).status).toBe(200)
})
it.each(["margin", "unknown", null, undefined])("rejects unsupported provider cash mode at review and confirm: %s", async mode => {
    const r = await review()
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: mode } })
    const response = await submit(r)
    expect(await response.json()).toMatchObject({ code: "cash_only_unverified", submissionStatus: "not_submitted_by_this_request" })
    expect(m.rows.get(r.reviewId).state).toBe("reviewing"); expect(m.force).not.toHaveBeenCalled()
    expect((await impact(req(order))).status).toBe(409)
})

it("quote returns verified listing ISO rather than account base currency", async () => {
    m.list.mockResolvedValue({ data: [{ id: "a", brokerage_authorization: "c", raw_type: "fixture-cash", status: "open", account_category: "INVESTMENT", balance: { total: { currency: "CAD", amount: 100 } } }] })
    const response = await quote(req({ accountId: "a", symbol: "AAPL" }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ symbol: "AAPL", bid: null, ask: 10, last: null, currency: "USD" })
    expect(m.force).not.toHaveBeenCalled(); expect(m.place).not.toHaveBeenCalled()
})

it("rechecks account details identity and authorization before a quote", async () => {
    for (const detail of [{ id: "foreign", connection_id: "c" }, { id: "a", connection_id: "other" }, { id: "a" }, { id: "a", connection_id: "" }]) {
        m.details.mockResolvedValue({ data: detail })
        expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(404)
    }
    expect(m.quotes).not.toHaveBeenCalled()
})
it("uses normalized cash mode without an arbitrary private account allowlist", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_CASH_ACCOUNT_POLICIES", "[]")
    const r = await review()
    expect((await submit(r)).status).toBe(200)
    expect(m.details).toHaveBeenCalledTimes(2)
    expect(m.details).toHaveBeenCalledWith({ accountId: "a", userId: "vendor-user", userSecret: "fixture" })
})
it("SELL matches canonical listing despite different V2 and universal IDs", async () => {
    const r = await review({ ...order, action: "SELL" })
    expect(r.reviewId).toBeTruthy()
    expect((await submit(r)).status).toBe(200)
})
it.each([
    { symbol: "AAPL", exchange: "XNYS", currency: "USD" },
    { symbol: "AAPL", currency: "USD" },
    { symbol: "OTHER", exchange: "XNAS", currency: "USD" },
    { symbol: "AAPL", exchange: "XNAS", currency: "CAD" },
])("SELL refuses ambiguous or different venue/currency listing: %j", async instrument => {
    m.positions.mockResolvedValue({ data: { results: [{ units: "3", instrument: { kind: "stock", id: "listing", ...instrument }, currency: "USD" }] } })
    expect((await impact(req({ ...order, action: "SELL" }))).status).toBe(400)
    expect(m.force).not.toHaveBeenCalled()
})
it("SELL accepts matching venue FIGI but rejects conflicting venue FIGI even when tickers match", async () => {
    m.quotes.mockResolvedValue({ data: [{ symbol: { id: "listing", symbol: "AAPL", figi_code: "VENUE-FIGI", type: { code: "cs" }, currency: { code: "USD" }, exchange: { code: "XNAS" } }, ask_price: 10 }] })
    const position = { units: "3", instrument: { kind: "stock", id: "v2-id", symbol: "AAPL", exchange: "XNAS", figi_instrument: { figi_code: "VENUE-FIGI" } }, currency: "USD" }
    m.positions.mockResolvedValue({ data: { results: [position] } })
    expect((await impact(req({ ...order, action: "SELL" }))).status).toBe(200)
    position.instrument.figi_instrument.figi_code = "OTHER-VENUE"
    expect((await impact(req({ ...order, action: "SELL" }))).status).toBe(400)
})
it("SELL rechecks holdings immediately before consume and refuses changed listing", async () => {
    const r = await review({ ...order, action: "SELL" })
    m.positions.mockResolvedValue({ data: { results: [{ units: "3", instrument: { kind: "stock", id: "listing", symbol: "AAPL", exchange: "XNYS" }, currency: "USD" }] } })
    expect(await (await submit(r)).json()).toMatchObject({ code: "order_invalid", submissionStatus: "not_submitted_by_this_request" })
    expect(m.rows.get(r.reviewId).state).toBe("reviewing"); expect(m.force).not.toHaveBeenCalled()
})

it("rejects missing authorization in both list and details rather than treating undefined as ownership", async () => {
    m.list.mockResolvedValue({ data: [{ id: "a" }] })
    m.details.mockResolvedValue({ data: { id: "a", kind: "investment", is_paper: false, cash_or_margin: "cash" } })
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(404)
    expect(m.details).not.toHaveBeenCalled(); expect(m.quotes).not.toHaveBeenCalled()
})
it.each(["deposit", "line_of_credit", "annuity", undefined])("rejects unsupported account detail kind: %s", async kind => {
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind, cash_or_margin: "cash" } })
    expect((await impact(req(order))).status).toBe(403)
    expect(m.quotes).not.toHaveBeenCalled()
})

it.each([
    ["ALPACA-PAPER", true, 200], ["ALPACA-PAPER", false, 409], ["ALPACA-PAPER", undefined, 409],
    ["ETRADE", false, 200], ["ETRADE", true, 409], ["ETRADE", undefined, 409],
])("binds paper/live account details to %s: paper=%s", async (slug, paper, status) => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ [slug as string]: { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["XNAS"] } }))
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [{ slug, allows_trading: true, enabled: true, maintenance_mode: false }] } })
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug, allows_trading: true } }] })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: paper, cash_or_margin: "cash" } })
    const res = await quote(req({ accountId: "a", symbol: "AAPL" }))
    expect(res.status).toBe(status)
    if (status === 409) expect(await res.json()).toMatchObject({ code: "account_environment_unverified" })
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("rechecks paper/live marker before consuming a reviewed order", async () => {
    const r = await review()
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", cash_or_margin: "cash" } })
    expect(await (await submit(r)).json()).toMatchObject({ code: "account_environment_unverified", submissionStatus: "not_submitted_by_this_request" })
    expect(m.rows.get(r.reviewId).state).toBe("reviewing"); expect(m.force).not.toHaveBeenCalled()
})

it.each(["BUY", "SELL"] as const)("rejects delayed %s review after another order is acknowledged, despite stale cached funds/positions", async action => {
    const body = { ...order, action, units: 3 }
    const a = await review(body), b = await review(body)
    let release: (value: any) => void = () => {}
    const gate = new Promise<any>(resolve => { release = resolve })
    if (action === "SELL") m.positions.mockImplementationOnce(() => gate)
    else m.balances.mockImplementationOnce(() => gate)
    const delayed = submit(b)
    await vi.waitFor(() => expect(action === "SELL" ? m.positions : m.balances).toHaveBeenCalledTimes(3))
    expect((await submit(a)).status).toBe(200)
    expect(m.rows.get(a.reviewId).state).toBe("complete")
    expect(m.rows.get(b.reviewId).state).toBe("invalidated")
    release(action === "SELL" ? { data: { results: [{ units: "3", instrument: { kind: "stock", id: "v2", symbol: "AAPL", exchange: "XNAS", currency: "USD" }, currency: "USD" }] } }
        : { data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 100 }] })
    expect(await (await delayed).json()).toMatchObject({ code: "order_review_used" })
    expect(m.force).toHaveBeenCalledOnce()
    expect(await review(body)).toMatchObject({ code: "order_reconciliation_required" })
})
it("cannot use an invalidated old review even after operator resolves the earlier order", async () => {
    const a = await review(), b = await review()
    expect((await submit(a)).status).toBe(200)
    m.rows.get(a.reviewId).state = "resolved"; m.generations.set("owner", (m.generations.get("owner") ?? 0) + 1) // restricted operator CAS fixture, never a public API.
    expect((await submit(b)).status).toBe(409)
    const fresh = await review()
    expect(fresh.reviewId).toBeTruthy(); expect((await submit(fresh)).status).toBe(200)
    expect(m.force).toHaveBeenCalledTimes(2)
})
it.each(["margin", "unknown", undefined])("rejects SELL on unsupported account cash mode: %s", async mode => {
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: mode } })
    expect(await review({ ...order, action: "SELL" })).toMatchObject({ code: "cash_only_unverified" })
    expect(m.force).not.toHaveBeenCalled()
})

function terminalDetail(changes = {}) {
    return { brokerage_order_id: "recorded-order", status: "EXECUTED", universal_symbol: { id: "listing", symbol: "AAPL", currency: { code: "USD" }, type: { code: "cs" } },
        action: "BUY", total_quantity: "2", filled_quantity: "2", open_quantity: "0", order_type: "Limit", time_in_force: "Day", limit_price: "10", ...changes }
}
it("automatically reconciles only exact known terminal ACK then requires fresh generation and fresh provider review reads", async () => {
    const a = await review(); expect((await submit(a)).status).toBe(200)
    m.orderDetail.mockResolvedValue({ data: terminalDetail() })
    const fresh = await review()
    expect(fresh.reviewId).toBeTruthy(); expect(m.rows.get(a.reviewId).state).toBe("resolved")
    expect(m.rows.get(fresh.reviewId).generation).toBe("2")
    expect(m.orderDetail).toHaveBeenCalledWith({ userId: "vendor-user", userSecret: "fixture", accountId: "a", brokerage_order_id: "recorded-order" })
    expect(m.list).toHaveBeenCalledTimes(3); expect(m.quotes).toHaveBeenCalledTimes(3)
    expect(m.force).toHaveBeenCalledOnce()
})
it("rejects a slow pre-A impact that finishes AFTER A terminal reconciliation", async () => {
    let release: (value: any) => void = () => {}
    m.quotes.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const slow = review()
    await vi.waitFor(() => expect(m.quotes).toHaveBeenCalledOnce())
    const a = await review(); expect((await submit(a)).status).toBe(200)
    m.orderDetail.mockResolvedValue({ data: terminalDetail() })
    const fresh = await review(); expect(fresh.reviewId).toBeTruthy()
    release({ data: [{ symbol: { id: "listing", symbol: "AAPL", type: { code: "cs" }, currency: { code: "USD" }, exchange: { code: "XNAS" } }, ask_price: 10 }] })
    expect(await slow).toMatchObject({ code: "order_review_stale" })
    expect(m.rows.size).toBe(2); expect(m.force).toHaveBeenCalledOnce()
})
it.each([
    { brokerage_order_id: "other" }, { action: "SELL" }, { total_quantity: "3" }, { time_in_force: "GTC" }, { limit_price: "11" },
    { universal_symbol: { id: "other" } }, { status: "PARTIAL", filled_quantity: "1" }, { status: "REPLACED" },
    { status: "CANCELED", filled_quantity: "1" }, { status: "ACCEPTED" }, { filled_quantity: null },
])("does not unlock a mismatched/partial/unknown existing order: %j", async changes => {
    const a = await review(); await submit(a)
    m.orderDetail.mockResolvedValue({ data: terminalDetail(changes) })
    expect(await review()).toMatchObject({ code: "order_reconciliation_required" })
    expect(m.rows.get(a.reviewId).state).toBe("complete"); expect(m.generations.get("owner")).toBe(1)
    expect(m.force).toHaveBeenCalledOnce()
})
it.each(["REJECTED", "CANCELED", "EXPIRED"])("reconciles exact zero-fill terminal %s without placing any new order", async status => {
    const a = await review(); await submit(a)
    m.orderDetail.mockResolvedValue({ data: terminalDetail({ status, filled_quantity: "0" }) })
    expect((await review()).reviewId).toBeTruthy()
    expect(m.rows.get(a.reviewId).state).toBe("resolved"); expect(m.force).toHaveBeenCalledOnce()
})
it("unknown/submitting is never automatically reconciled, even with a detail fixture available", async () => {
    const a = await review(); await submit(a)
    m.rows.get(a.reviewId).state = "unknown"
    m.orderDetail.mockResolvedValue({ data: terminalDetail() })
    expect(await review()).toMatchObject({ code: "order_status_unknown" }); expect(m.orderDetail).not.toHaveBeenCalled()
    m.rows.get(a.reviewId).state = "submitting"
    expect(await review()).toMatchObject({ code: "order_status_unknown" }); expect(m.orderDetail).not.toHaveBeenCalled()
})
it("rejects stale generation at consume even if a reviewing row was not invalidated", async () => {
    const a = await review(); m.generations.set("owner", 1)
    expect((await submit(a)).status).toBe(409); expect(m.force).not.toHaveBeenCalled()
})
it("cross-owner/key ACK reservation never triggers provider lookup", async () => {
    const a = await review(); await submit(a)
    m.rows.get(a.reviewId).client_id = "other-key"
    expect(await review()).toMatchObject({ code: "order_reconciliation_required" }); expect(m.orderDetail).not.toHaveBeenCalled()
})
it("two routine reconciliations compare-and-swap once, without another submission", async () => {
    const a = await review(); await submit(a)
    let releases: ((value: any) => void)[] = []
    m.orderDetail.mockImplementation(() => new Promise(resolve => { releases.push(resolve) }))
    const one = review(), two = review()
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.forEach(resolve => resolve({ data: terminalDetail() }))
    const results = await Promise.all([one, two])
    expect(results.filter(r => r.reviewId)).toHaveLength(1)
    expect(results.filter(r => r.code === "order_reconciliation_required")).toHaveLength(1)
    expect(m.generations.get("owner")).toBe(2); expect(m.force).toHaveBeenCalledOnce()
})

it.each([null, {}, []])("empty or unbound order detail never releases the reservation: %j", async data => {
    const a = await review(); await submit(a)
    m.orderDetail.mockResolvedValue({ data })
    expect(await review()).toMatchObject({ code: "order_reconciliation_required" })
    expect(m.rows.get(a.reviewId).state).toBe("complete"); expect(m.generations.get("owner")).toBe(1)
})
it("provider timeout/error is not terminal evidence and leaks no raw error", async () => {
    const a = await review(); await submit(a)
    m.orderDetail.mockRejectedValue(new Error("SECRET-PROVIDER-ERROR"))
    const result = await review()
    expect(result.code).toBe("order_reconciliation_required"); expect(JSON.stringify(result)).not.toContain("SECRET")
    expect(m.rows.get(a.reviewId).state).toBe("complete"); expect(m.force).toHaveBeenCalledOnce()
})
it("client generation fields cannot replace the server-captured epoch", async () => {
    const r = await (await impact(req({ ...order, generation: "999" }))).json()
    expect(m.rows.get(r.reviewId).generation).toBe("0")
})
