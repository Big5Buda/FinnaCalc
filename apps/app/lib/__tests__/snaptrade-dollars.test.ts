import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
// Dollar (notional) orders: terms, capabilities, provider payload binding.
// Fixtures and no-network SDK doubles only; no live or paper orders.
const m = vi.hoisted(() => ({ list: vi.fn(), links: vi.fn(), quotes: vi.fn(), orders: vi.fn(), positions: vi.fn(), details: vi.fn(),
    partner: vi.fn(), balances: vi.fn(), preview: vi.fn(), place: vi.fn(), force: vi.fn(), instruments: vi.fn(), orderDetail: vi.fn(),
    consumeCalls: 0, storageVersion: 4 as number | null, saved: [] as any[], rows: new Map<string, any>(), sequence: 0, generation: 0, client: null as any }))
vi.mock("@/lib/snaptrade-session", () => ({ loadSession: async () => ({ clientId: "key", userId: "vendor-user", userSecret: "fixture" }) }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "owner" }))
vi.mock("@/lib/snaptrade-access", () => ({ brokerageReadScope: async () => ({ countedConnectionId: null }) }))
vi.mock("@/lib/snaptrade", async () => ({ isTradingKeyApproved: (id: string) => id === "key",
    // REAL response mapper: placement boundary is exercised, not mocked.
    mapOrderRecord: (await vi.importActual<any>("../snaptrade")).mapOrderRecord,
    // Stable instance per credential, as in production, so the WeakMap cache applies.
    getSnapTrade: () => m.client }))
vi.mock("@/lib/snaptrade-order-reviews", () => ({
    reviewStorageVersion: async () => m.storageVersion,
    captureReviewGeneration: async () => String(m.generation),
    ownerReservation: async () => [...m.rows.values()].find(r => ["submitting", "unknown", "complete"].includes(r.state)) ?? null,
    resolveAcknowledgedReview: async () => false,
    saveReview: async (r: any, dollar?: any) => {
        m.saved.push({ row: r, dollar })
        if (r.generation !== String(m.generation)) throw new Error("stale")
        const row = { ...r, id: `review-${++m.sequence}`, state: "reviewing", dollar }; m.rows.set(row.id, row); return row
    },
    loadReview: async (id: string) => m.rows.has(id) ? { ...m.rows.get(id) } : null,
    consumeReview: async (id: string) => {
        m.consumeCalls++
        const r = m.rows.get(id); if (!r || r.state !== "reviewing" || r.generation !== String(m.generation)) return false
        r.state = "submitting"; m.generation++; return true
    },
    finishReview: async (id: string, _o: string, result: any, unknown: boolean) => { Object.assign(m.rows.get(id), { state: unknown ? "unknown" : "complete", result }) },
}))
import { impact, place, quote } from "../snaptrade-trading-routes"
import { capability, notionalCents, sameTerms, terms } from "../snaptrade-trading"
import { bindInstrument } from "../snaptrade-brokerage-instruments"

const dollarBuy = { accountId: "a", symbol: "AAPL", action: "BUY", amountMode: "dollars", notionalValue: "25", orderType: "Market", timeInForce: "Day", price: null, stop: null }
const notionalBlock = { orderTypes: ["Market"], timeInForce: ["Day"], minAmount: "1.00", maxAmount: "10000.00" }
const alpacaCaps = { "ALPACA-PAPER": { orderTypes: ["Market", "Limit"], timeInForce: ["Day", "GTC"], fractional: false, preview: true, exchanges: ["NASDAQ"], notional: notionalBlock } }
const listing = { id: "uid-aapl", symbol: "AAPL", type: { code: "cs" }, currency: { id: "currency-usd", code: "USD" }, exchange: { code: "NASDAQ", mic_code: "XNAS" } }
const instrument = { symbol: "AAPL", exchange_mic: "XNAS", universal_symbol_id: "uid-aapl", tradeable: true, fractionable: true }
const req = (body: any) => new NextRequest("https://test.invalid/api", { method: "POST", body: JSON.stringify(body) })
const checkedTrade = (changes: any = {}) => ({ data: { trade: { id: "checked-trade", account: "a", action: "BUY", units: null, order_type: "Market",
    time_in_force: "Day", price: null, symbol: { universal_symbol_id: "uid-aapl" }, ...changes },
    trade_impacts: [{ account: "a", currency: "currency-usd", estimated_commission: 0, forex_fees: 0, remaining_cash: 75 }] } })
async function review(body: any = dollarBuy) { const res = await impact(req(body)); return { status: res.status, body: await res.json() } }
const submit = (r: any, extra: any = {}) => place(req({ reviewId: r.reviewId, confirmed: true, terms: r.terms, ...extra }))

beforeEach(() => {
    vi.resetAllMocks(); m.rows.clear(); m.saved = []; m.sequence = 0; m.generation = 0; m.storageVersion = 4; m.consumeCalls = 0
    // Fresh client object per test isolates the module-level instrument cache.
    m.client = { accountInformation: { listUserAccounts: m.list, getAccountDetails: m.details, getUserAccountOrders: m.orders,
        getAllAccountPositions: m.positions, getUserAccountBalance: m.balances, getUserAccountOrderDetail: m.orderDetail },
        referenceData: { getPartnerInfo: m.partner, listAllBrokerageInstruments: m.instruments }, connections: { listBrokerageAuthorizations: m.links },
        trading: { getUserAccountQuotes: m.quotes, getOrderImpact: m.preview, placeOrder: m.place, placeForceOrder: m.force } }
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true"); vi.stubEnv("SNAPTRADE_TRADE_CONNECTIONS_ENABLED", "true")
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify(alpacaCaps))
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("LIVE REQUEST FORBIDDEN") }))
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [
        { slug: "ALPACA-PAPER", allows_trading: true, enabled: true, maintenance_mode: false },
        { slug: "ETRADE", allows_trading: true, enabled: true, maintenance_mode: false }] } })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: true, cash_or_margin: "cash" } })
    m.list.mockResolvedValue({ data: [{ id: "a", brokerage_authorization: "c" }] })
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug: "ALPACA-PAPER", allows_trading: true, allows_fractional_units: true } }] })
    m.quotes.mockResolvedValue({ data: [{ symbol: listing, ask_price: 10, bid_price: 9.5 }] })
    m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 100 }] })
    m.positions.mockResolvedValue({ data: { results: [{ units: "3", instrument: { kind: "stock", symbol: "AAPL", exchange: "NASDAQ", currency: "USD" }, currency: "USD" }] } })
    m.orders.mockResolvedValue({ data: [] })
    m.instruments.mockResolvedValue({ data: { instruments: [instrument, { symbol: "MSFT", exchange_mic: "XNAS", universal_symbol_id: "uid-msft", tradeable: true, fractionable: true }] } })
    m.preview.mockResolvedValue(checkedTrade())
    m.place.mockResolvedValue({ data: { brokerage_order_id: "broker-order", status: "ACCEPTED", total_quantity: "2.5" } })
})
afterEach(() => { vi.useRealTimers(); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

// ---- Terms contract -------------------------------------------------------
it("canonicalizes dollar terms to a 2-place string with units null, Market/Day only", () => {
    expect(terms(dollarBuy)).toEqual({ accountId: "a", symbol: "AAPL", action: "BUY", amountMode: "dollars", units: null,
        notionalValue: "25.00", orderType: "Market", timeInForce: "Day", price: null, stop: null })
    expect(terms({ ...dollarBuy, notionalValue: "1" }).notionalValue).toBe("1.00")
    expect(terms({ ...dollarBuy, notionalValue: "10000" }).notionalValue).toBe("10000.00")
    expect(terms({ ...dollarBuy, notionalValue: "12.5" }).notionalValue).toBe("12.50")
    expect(terms({ ...dollarBuy, units: null }).units).toBeNull()
})
it.each([
    ["number notional", { notionalValue: 25 }], ["3 decimals", { notionalValue: "25.001" }], ["exponent", { notionalValue: "1e2" }],
    ["negative", { notionalValue: "-5" }], ["below min", { notionalValue: "0.99" }], ["zero", { notionalValue: "0" }],
    ["above max", { notionalValue: "10000.01" }], ["whitespace", { notionalValue: " 25" }], ["leading zero", { notionalValue: "025" }],
    ["trailing dot", { notionalValue: "25." }], ["comma", { notionalValue: "1,000" }], ["missing", { notionalValue: undefined }],
    ["mixed units", { units: 2 }], ["mixed zero units", { units: 0 }], ["Limit", { orderType: "Limit", price: 10 }],
    ["GTC", { timeInForce: "GTC" }], ["stop", { stop: 5 }], ["unknown mode", { amountMode: "DOLLARS" }], ["null mode", { amountMode: null }],
])("rejects invalid dollar terms (%s) before any provider call", async (_label, change) => {
    expect(() => terms({ ...dollarBuy, ...change })).toThrow()
    expect((await impact(req({ ...dollarBuy, ...change }))).status).toBe(400)
    expect(m.list).not.toHaveBeenCalled(); expect(m.preview).not.toHaveBeenCalled()
})
it("legacy share bodies (no amountMode) remain valid and compare equal to the canonical V4 echo", () => {
    const legacy = { accountId: "a", symbol: "AAPL", action: "BUY", units: 2, orderType: "Limit", timeInForce: "GTC", price: 10, stop: null }
    const echo = terms(legacy)
    expect(echo).toMatchObject({ amountMode: "shares", units: 2, notionalValue: null })
    expect(sameTerms(legacy, echo)).toBe(true)
    expect(sameTerms(legacy, { ...echo, amountMode: "shares" })).toBe(true)
    expect(() => terms({ ...legacy, notionalValue: "20.00" })).toThrow()
    expect(() => terms({ ...legacy, amountMode: "shares", units: null, notionalValue: "20.00" })).toThrow()
    expect(sameTerms(terms(dollarBuy), terms({ ...dollarBuy, notionalValue: "25.01" }))).toBe(false)
})
it("parses integer cents without floating-point arithmetic", () => {
    expect(notionalCents("0.29")).toBe(29); expect(notionalCents("9999999.99")).toBe(999999999); expect(notionalCents(0.29)).toBeNull()
})

// ---- Capability configuration -------------------------------------------
it("env notional block is honored only for the code allowlist and exact shape; share capability survives a bad block", () => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({
        ETRADE: { orderTypes: ["Market"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["NASDAQ"], notional: notionalBlock },
        "ALPACA-PAPER": { ...alpacaCaps["ALPACA-PAPER"], notional: { ...notionalBlock, maxAmount: "10000.01" } } }))
    expect(capability("ETRADE")).not.toHaveProperty("notional")
    expect(capability("ALPACA-PAPER")).not.toHaveProperty("notional")
    expect(capability("ALPACA-PAPER").orderTypes).toEqual(["Market", "Limit"])
    for (const bad of [{ ...notionalBlock, orderTypes: ["Market", "Limit"] }, { ...notionalBlock, timeInForce: ["GTC"] },
        { ...notionalBlock, minAmount: "0.50" }, { ...notionalBlock, minAmount: 1 }, { ...notionalBlock, extra: true },
        { ...notionalBlock, minAmount: "500.00", maxAmount: "100.00" }]) {
        vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ "ALPACA-PAPER": { ...alpacaCaps["ALPACA-PAPER"], notional: bad } }))
        expect(capability("ALPACA-PAPER")).not.toHaveProperty("notional")
    }
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify(alpacaCaps))
    expect(capability("ALPACA-PAPER").notional).toEqual(notionalBlock)
})

// ---- Quote orderCapabilities --------------------------------------------
it("quote returns a dollars rule (min/max, Market→Day, preview required) only when fully eligible; uncached", async () => {
    const res = await quote(req({ accountId: "a", symbol: "AAPL", amountMode: "dollars", fractionable: true }))
    expect(res.status).toBe(200); expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    const body = await res.json()
    expect(body).toMatchObject({ symbol: "AAPL", bid: 9.5, ask: 10, currency: "USD" })
    expect(body.orderCapabilities).toEqual({ version: 1, currency: "USD", rules: [
        { amountMode: "shares", fractional: false, actions: ["BUY", "SELL"], orderTypes: { Market: ["Day"], Limit: ["Day", "GTC"] }, previewRequired: true },
        { amountMode: "dollars", actions: ["BUY", "SELL"], orderTypes: { Market: ["Day"] }, minAmount: "1.00", maxAmount: "10000.00", decimalPlaces: 2, previewRequired: true }] })
    expect(m.instruments).toHaveBeenCalledWith({ slug: "ALPACA-PAPER" }, expect.objectContaining({ timeout: expect.any(Number) }))
    expect(JSON.stringify(body)).not.toMatch(/uid-aapl|vendor-user|owner|key/)
    expect(m.preview).not.toHaveBeenCalled(); expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it.each([
    ["non-fractionable", { instruments: [{ ...instrument, fractionable: false }] }],
    ["unknown fractionable", { instruments: [{ ...instrument, fractionable: null }] }],
    ["non-tradeable", { instruments: [{ ...instrument, tradeable: false }] }],
    ["MIC mismatch", { instruments: [{ ...instrument, exchange_mic: "XNYS" }] }],
    ["universal id mismatch", { instruments: [{ ...instrument, universal_symbol_id: "uid-other" }] }],
    ["ambiguous duplicate", { instruments: [instrument, { ...instrument }] }],
    ["conflicting id row", { instruments: [instrument, { ...instrument, symbol: "AAPL.X", exchange_mic: "XNYS" }] }],
    ["empty (unsupported broker)", { instruments: [] }],
    ["malformed", { instruments: "nope" }],
])("quote hides dollars but still returns the share quote when instrument metadata is %s", async (_l, data) => {
    m.instruments.mockResolvedValue({ data })
    const res = await quote(req({ accountId: "a", symbol: "AAPL" })); expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ask).toBe(10); expect(body.orderCapabilities.rules.map((r: any) => r.amountMode)).toEqual(["shares"])
})
it("quote hides dollars on metadata transport failure, storage V3, missing MIC, margin or non-allowlisted broker", async () => {
    const modes = async () => (await (await quote(req({ accountId: "a", symbol: "AAPL" }))).json()).orderCapabilities.rules.map((r: any) => r.amountMode)
    m.instruments.mockRejectedValue(new Error("timeout")); expect(await modes()).toEqual(["shares"])
    m.instruments.mockResolvedValue({ data: { instruments: [instrument] } })
    m.storageVersion = 3; expect(await modes()).toEqual(["shares"]); m.storageVersion = null; expect(await modes()).toEqual(["shares"]); m.storageVersion = 4
    m.quotes.mockResolvedValue({ data: [{ symbol: { ...listing, exchange: { code: "NASDAQ", mic_code: null } }, ask_price: 10 }] }); expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(422)
    m.quotes.mockResolvedValue({ data: [{ symbol: listing, ask_price: 10 }] })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: true, cash_or_margin: "margin" } }); expect(await modes()).toEqual(["shares"])
})
it("ETRADE never offers dollars even with an env notional block and fractionable metadata", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ ETRADE: { ...alpacaCaps["ALPACA-PAPER"] } }))
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug: "ETRADE", allows_trading: true, allows_fractional_units: true } }] })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: "cash" } })
    const body = await (await quote(req({ accountId: "a", symbol: "AAPL" }))).json()
    expect(body.orderCapabilities.rules.map((r: any) => r.amountMode)).toEqual(["shares"])
    expect(m.instruments).not.toHaveBeenCalled()
    const r = await review(); expect(r.status).toBe(409); expect(r.body.code).toBe("dollar_orders_unavailable"); expect(m.preview).not.toHaveBeenCalled()
})

// ---- Impact payload and binding -----------------------------------------
it("dollar BUY preview sends the exact notional with units null and never a quote-derived share count", async () => {
    const r = await review(); expect(r.status).toBe(200)
    expect(m.preview).toHaveBeenCalledOnce()
    expect(m.preview.mock.calls[0][0]).toEqual({ userId: "vendor-user", userSecret: "fixture", account_id: "a", action: "BUY",
        universal_symbol_id: "uid-aapl", order_type: "Market", time_in_force: "Day", units: null, notional_value: "25.00", price: null, stop: null })
    expect(r.body.terms).toEqual(terms(dollarBuy))
    expect(r.body.estimate).toMatchObject({ source: "brokerage", amountMode: "dollars", amountVerification: "request_bound", brokerageEstimatedUnits: null,
        quoteEstimate: { basis: "ask", price: 10, approxUnits: 2.5 }, estimatedCommission: 0, currency: "USD" })
    expect(m.saved[0].dollar).toEqual({ estimate_units: null, amount_verification: "request_bound" })
    expect(m.saved[0].row).toMatchObject({ trade_id: "checked-trade", symbol_id: "uid-aapl", terms: { notionalValue: "25.00", units: null } })
})
it("accepts a provider share estimate for dollars and records it only as a brokerage estimate", async () => {
    m.preview.mockResolvedValue(checkedTrade({ units: 2.4876 }))
    const r = await review(); expect(r.status).toBe(200)
    expect(r.body.estimate.brokerageEstimatedUnits).toBe(2.4876); expect(r.body.terms.units).toBeNull()
    expect(m.saved[0].dollar.estimate_units).toBe(2.4876)
})
it.each([
    ["empty trade id", { id: "" }], ["missing trade id", { id: undefined }], ["negative units", { units: -1 }], ["string units", { units: "2" }],
    ["account", { account: "other" }], ["action", { action: "SELL" }], ["order type", { order_type: "Limit" }],
    ["time in force", { time_in_force: "GTC" }], ["listing", { symbol: { universal_symbol_id: "uid-other" } }],
])("rejects a provider preview that does not bind the dollar request: %s", async (_l, change) => {
    m.preview.mockResolvedValue(checkedTrade(change))
    const r = await review(); expect(r.status).toBe(502); expect(m.saved).toHaveLength(0)
})
it("dollar BUY requires fresh USD cash >= notional + known fees before and after preview", async () => {
    m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 24.99 }] })
    expect((await review()).body.code).toBe("order_funds_insufficient"); expect(m.preview).not.toHaveBeenCalled()
    m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 25.5 }] })
    m.preview.mockResolvedValue({ data: { ...checkedTrade().data, trade_impacts: [{ account: "a", currency: "currency-usd", estimated_commission: 1, forex_fees: 0, remaining_cash: 0 }] } })
    expect((await review()).body.code).toBe("order_funds_insufficient"); expect(m.saved).toHaveLength(0)
    m.balances.mockResolvedValue({ data: [] }); expect((await review()).body.code).toBe("order_funds_unverified")
})
it("dollar SELL is bounded by exact-listing held units times the current positive bid", async () => {
    const sell = { ...dollarBuy, action: "SELL", notionalValue: "28.50" } // 3 × 9.50 = 28.50
    m.preview.mockResolvedValue(checkedTrade({ action: "SELL" }))
    const ok = await review(sell); expect(ok.status).toBe(200)
    expect(ok.body.estimate.quoteEstimate).toEqual({ basis: "bid", price: 9.5, approxUnits: 3 })
    expect((await review({ ...sell, notionalValue: "28.51" })).status).toBe(400)
    m.quotes.mockResolvedValue({ data: [{ symbol: listing, ask_price: 10 }] })
    expect((await review(sell)).body.code).toBe("order_funds_unverified")
    m.quotes.mockResolvedValue({ data: [{ symbol: listing, ask_price: 10, bid_price: 9.5 }] })
    m.positions.mockResolvedValue({ data: { results: [] } }); expect((await review(sell)).status).toBe(400)
    m.positions.mockResolvedValue({ data: { results: [{ units: "0", instrument: { kind: "stock", symbol: "AAPL", exchange: "NASDAQ", currency: "USD" }, currency: "USD" }] } })
    expect((await review(sell)).status).toBe(400)
    expect(m.preview).toHaveBeenCalledOnce()
})
it("open orders block dollar reviews as they do share reviews", async () => {
    m.orders.mockResolvedValue({ data: [{ status: "ACCEPTED" }] }); expect((await review()).status).toBe(409); expect(m.preview).not.toHaveBeenCalled()
})
it("share orders on ALPACA-PAPER keep the unit payload and gain a reciprocal approximate dollar estimate", async () => {
    m.preview.mockResolvedValue(checkedTrade({ units: 2, order_type: "Limit", price: 9, time_in_force: "GTC" }))
    const r = await review({ accountId: "a", symbol: "AAPL", action: "BUY", units: 2, orderType: "Limit", timeInForce: "GTC", price: 9, stop: null })
    expect(r.status).toBe(200)
    expect(m.preview.mock.calls[0][0]).toMatchObject({ units: 2, notional_value: null, price: 9, order_type: "Limit" })
    expect(r.body.estimate).toMatchObject({ amountMode: "shares", units: 2, quoteEstimate: { basis: "limit", price: 9, approxNotional: 18 } })
    expect(r.body.estimate).not.toHaveProperty("amountVerification")
    expect(m.saved[0].dollar).toBeUndefined()
})

// ---- Confirm / place ----------------------------------------------------
it("places only the stored checked trade, re-reads instrument metadata upstream at confirm, never a direct order", async () => {
    const r = (await review()).body
    expect(m.instruments).toHaveBeenCalledTimes(1)
    const res = await submit(r, { tradeId: "client-forged", trade_id: "client-forged" })
    expect(res.status).toBe(200)
    expect(m.instruments).toHaveBeenCalledTimes(2) // fresh read despite a <15 min cache entry
    expect(m.place).toHaveBeenCalledExactlyOnceWith({ userId: "vendor-user", userSecret: "fixture", tradeId: "checked-trade", wait_to_confirm: true })
    expect(m.force).not.toHaveBeenCalled()
    expect(m.rows.get(r.reviewId)).toMatchObject({ state: "complete", result: { brokerageOrderId: "broker-order", totalQuantity: 2.5, ackQuantity: { state: "positive", value: 2.5 } } })
})
it.each([
    ["now non-fractionable", () => m.instruments.mockResolvedValue({ data: { instruments: [{ ...instrument, fractionable: false }] } })],
    ["metadata outage", () => m.instruments.mockRejectedValue(new Error("timeout"))],
    ["storage downgraded", () => { m.storageVersion = 3 }],
    ["notional block removed", () => vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ "ALPACA-PAPER": { ...alpacaCaps["ALPACA-PAPER"], notional: undefined } }))],
    ["cash fell", () => m.balances.mockResolvedValue({ data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 10 }] })],
])("confirm refuses before consume when eligibility changed: %s", async (_l, change) => {
    const r = (await review()).body; change()
    const res = await submit(r); const body = await res.json()
    expect(res.status).toBeGreaterThanOrEqual(400); expect(body.submissionStatus).toBe("not_submitted_by_this_request")
    expect(m.rows.get(r.reviewId).state).toBe("reviewing"); expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("confirm rejects altered dollar terms and never converts a dollar review to shares", async () => {
    const r = (await review()).body
    for (const t of [{ ...r.terms, notionalValue: "25.01" }, { ...r.terms, amountMode: "shares", units: 2.5, notionalValue: null }, { ...r.terms, action: "SELL" }]) {
        const res = await place(req({ reviewId: r.reviewId, confirmed: true, terms: t }))
        expect(res.status).toBe(409)
    }
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("a dollar review without a stored checked trade can never be placed", async () => {
    m.rows.set("forged", { id: "forged", owner_id: "owner", client_id: "key", vendor_user_id: "vendor-user", generation: "0", state: "reviewing",
        terms: terms(dollarBuy), symbol_id: "uid-aapl", trade_id: null, impact_facts: null, expires_at: "2100-01-01T00:00:00Z" })
    const res = await place(req({ reviewId: "forged", confirmed: true, terms: terms(dollarBuy) }))
    expect(res.status).toBe(409); expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
    expect(m.rows.get("forged").state).toBe("reviewing")
})
it("uncertain dollar placement locks as unknown without retry", async () => {
    const r = (await review()).body; m.place.mockRejectedValue(new Error("timeout"))
    expect((await (await submit(r)).json()).code).toBe("order_status_unknown")
    expect(m.rows.get(r.reviewId).state).toBe("unknown"); expect(m.place).toHaveBeenCalledOnce(); expect(m.force).not.toHaveBeenCalled()
})

// ---- Instrument binding unit --------------------------------------------
it("binds exactly one instrument by ticker + MIC + universal symbol id", () => {
    const row = (o: any = {}) => ({ symbol: "AAPL", mic: "XNAS", id: "u", tradeable: true, fractionable: true, ...o })
    const l = { symbol: "AAPL", mic: "XNAS", id: "u" }
    expect(bindInstrument({ rows: [row()] }, l)).toEqual({ tradeable: true, fractionable: true })
    expect(bindInstrument({ rows: [row(), row({ mic: "XNYS", id: "v" })] }, l)).not.toBeNull()
    expect(bindInstrument({ rows: [row({ id: null })] }, l)).toBeNull()
    expect(bindInstrument({ rows: [row()] }, { ...l, mic: null as any })).toBeNull()
    expect(bindInstrument(null, l)).toBeNull()
})

// ---- Phase 2a: metadata deadline / malformed rows / cache consistency ----
import { dollarTerminalEvidence, terminalOrderEvidence } from "../snaptrade-reconciliation"
const modes = async () => (await (await quote(req({ accountId: "a", symbol: "AAPL" }))).json()).orderCapabilities.rules.map((r: any) => r.amountMode)
it("enforces ONE overall 5s deadline across SDK 429 retries, aborts, and ignores a late positive completion", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    try {
        let late: (v: any) => void = () => {}, options: any
        // Simulates the SDK's internal 429 backoff (5/10/20 s) never settling inside our deadline.
        m.instruments.mockImplementation((_args: any, opts: any) => { options = opts; return new Promise(r => { late = r }) })
        const pending = modes(); await vi.advanceTimersByTimeAsync(5_000)
        expect(await pending).toEqual(["shares"]); expect(options.signal.aborted).toBe(true)
        late({ data: { instruments: [instrument] } }); await vi.advanceTimersByTimeAsync(0)
        // Failure published for 60 s; the late positive result was never published.
        expect(await modes()).toEqual(["shares"]); expect(m.instruments).toHaveBeenCalledTimes(1)
        m.instruments.mockResolvedValue({ data: { instruments: [instrument] } })
        await vi.advanceTimersByTimeAsync(60_001)
        expect(await modes()).toEqual(["shares", "dollars"]); expect(m.instruments).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
})
it("a repeated-429 rejection inside the deadline fails closed for dollars only", async () => {
    m.instruments.mockRejectedValue(Object.assign(new Error("429"), { response: { status: 429 } }))
    expect(await modes()).toEqual(["shares"])
})
it.each([
    ["missing symbol, same matching id", { universal_symbol_id: "uid-aapl", exchange_mic: "XNYS", tradeable: false, fractionable: false }],
    ["non-string symbol, same matching id", { symbol: 5, universal_symbol_id: "uid-aapl", exchange_mic: "XNAS" }],
    ["empty symbol", { symbol: "", universal_symbol_id: "uid-x" }],
    ["non-string universal id", { symbol: "ZZZ", universal_symbol_id: 7 }],
    ["string fractionable", { symbol: "ZZZ", universal_symbol_id: "uid-z", fractionable: "true" }],
    ["null row", null],
])("a malformed row (%s) rejects the whole response instead of being dropped", async (_l, bad) => {
    m.instruments.mockResolvedValue({ data: { instruments: [instrument, bad] } })
    expect(await modes()).toEqual(["shares"])
})
it("a fresh negative at confirm replaces the cached positive for later quotes", async () => {
    expect(await modes()).toEqual(["shares", "dollars"])
    const r = (await review()).body; expect(m.instruments).toHaveBeenCalledTimes(1) // impact reused the 15-min entry
    m.instruments.mockResolvedValue({ data: { instruments: [{ ...instrument, fractionable: false }] } })
    expect((await submit(r)).status).toBe(409); expect(m.place).not.toHaveBeenCalled()
    expect(await modes()).toEqual(["shares"]); expect(m.instruments).toHaveBeenCalledTimes(2) // served from the fresh negative
})
it("an empty instrument list is treated as unavailable and cached only for the 60 s failure TTL", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    try {
        m.instruments.mockResolvedValue({ data: { instruments: [] } })
        expect(await modes()).toEqual(["shares"]); expect(await modes()).toEqual(["shares"]); expect(m.instruments).toHaveBeenCalledTimes(1)
        m.instruments.mockResolvedValue({ data: { instruments: [instrument] } }); await vi.advanceTimersByTimeAsync(60_001)
        expect(await modes()).toEqual(["shares", "dollars"]); expect(m.instruments).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
})
it("concurrent quote/impact/confirm reads coalesce onto one in-flight upstream request", async () => {
    let release: (v: any) => void = () => {}
    m.instruments.mockImplementation(() => new Promise(r => { release = r }))
    const both = Promise.all([modes(), modes()])
    await new Promise(r => setTimeout(r, 10)); release({ data: { instruments: [instrument] } })
    expect(await both).toEqual([["shares", "dollars"], ["shares", "dollars"]]); expect(m.instruments).toHaveBeenCalledTimes(1)
})

// ---- Phase 2a: dollar terminal reconciliation (TypeScript only) ---------
const dollarReview = (result: any = {}, termChanges: any = {}) => ({ id: "r", owner_id: "owner", client_id: "key", vendor_user_id: "vendor-user", generation: "0",
    state: "complete", symbol_id: "uid-aapl", trade_id: "checked-trade", impact_facts: null, expires_at: "2100-01-01T00:00:00Z",
    terms: { ...terms(dollarBuy), ...termChanges }, result: { brokerageOrderId: "broker-order", accountId: "a", status: "ACCEPTED", totalQuantity: null, ackQuantity: { state: "absent" }, ...result } }) as any
const detail = (changes: any = {}) => ({ brokerage_order_id: "broker-order", status: "EXECUTED", action: "BUY", order_type: "Market", time_in_force: "Day",
    universal_symbol: { id: "uid-aapl", symbol: "AAPL", currency: { code: "USD" }, type: { code: "cs" } },
    total_quantity: "2.4876", filled_quantity: "2.4876", open_quantity: "0", limit_price: null, stop_price: null, ...changes })
it("resolves an EXECUTED dollar order on broker-actual quantities without inferring them from the notional", () => {
    const evidence = terminalOrderEvidence(dollarReview(), detail({ execution_price: "10.07" }))
    expect(evidence).toMatchObject({ status: "EXECUTED", amountMode: "dollars", notionalValue: "25.00", quantityBasis: "broker_actual",
        ackQuantity: null, totalQuantity: 2.4876, filledQuantity: 2.4876, openQuantity: 0, orderType: "Market", timeInForce: "Day", limitPrice: null })
    expect(dollarTerminalEvidence(dollarReview({ ackQuantity: { state: "positive", value: 2.4876 } }), detail())).toMatchObject({ ackQuantity: 2.4876 })
})
it.each([
    ["ACK quantity differs", { ackQuantity: { state: "positive", value: 2.5 } }, {}], ["ACK quantity invalid", { ackQuantity: { state: "invalid" } }, {}],
    ["ACK record malformed", { ackQuantity: { state: "positive", value: "abc" } }, {}], ["ACK record zero", { ackQuantity: { state: "positive", value: 0 } }, {}],
    ["ACK record missing", { ackQuantity: undefined }, {}], ["ACK record unknown state", { ackQuantity: { state: "maybe" } }, {}],
    ["partial fill", {}, { filled_quantity: "1.2" }], ["open remainder", {}, { open_quantity: "1.28" }], ["EXECUTED zero total", {}, { total_quantity: "0", filled_quantity: "0" }],
    ["pending", {}, { status: "PENDING" }], ["replaced", {}, { status: "REPLACED" }], ["missing status", {}, { status: undefined }],
    ["missing total", {}, { total_quantity: null }], ["negative filled", {}, { status: "CANCELED", filled_quantity: "-1" }],
    ["other order id", {}, { brokerage_order_id: "guess" }], ["missing order id", { brokerageOrderId: null }, { brokerage_order_id: null }],
    ["other account", { accountId: "b" }, {}], ["other listing", {}, { universal_symbol: { id: "uid-x", symbol: "AAPL", currency: { code: "USD" }, type: { code: "cs" } } }],
    ["action", {}, { action: "SELL" }], ["Limit", {}, { order_type: "Limit" }], ["GTC", {}, { time_in_force: "GTC" }],
    ["limit price", {}, { limit_price: "10" }], ["option", {}, { option_symbol: { id: "o" } }], ["group", {}, { brokerage_group_order_id: "g" }],
    ["CANCELED with fill", {}, { status: "CANCELED", filled_quantity: "0.5", open_quantity: "0" }],
])("keeps the dollar lock on %s", (_l, result, changes) => {
    expect(terminalOrderEvidence(dollarReview(result), detail(changes))).toBeNull()
})
it.each(["REJECTED", "CANCELED", "EXPIRED"])("resolves zero-fill %s dollar orders with consistent non-negative quantities", status => {
    expect(terminalOrderEvidence(dollarReview(), detail({ status, filled_quantity: "0", total_quantity: "0" }))).toMatchObject({ status, filledQuantity: 0 })
    expect(terminalOrderEvidence(dollarReview({ ackQuantity: { state: "positive", value: 2.4876 } }), detail({ status, filled_quantity: "0" }))).toMatchObject({ status, ackQuantity: 2.4876 })
})
it("a dollar review never resolves through the share rule, and shares keep total === units", () => {
    expect(dollarTerminalEvidence(dollarReview({}, { units: 2 }), detail())).toBeNull()
    const legacyShares = { ...dollarReview(), terms: { accountId: "a", symbol: "AAPL", action: "BUY", units: 2, orderType: "Market", timeInForce: "Day", price: null, stop: null } }
    expect(terminalOrderEvidence(legacyShares, detail({ total_quantity: "2", filled_quantity: "2" }))).not.toHaveProperty("quantityBasis")
    expect(terminalOrderEvidence(legacyShares, detail({ total_quantity: "2.4876", filled_quantity: "2.4876" }))).toBeNull()
})
it("unknown/submitting dollar reservations are never looked up or unlocked", async () => {
    for (const state of ["unknown", "submitting"]) {
        m.rows.clear(); m.rows.set("held", { ...dollarReview(), state })
        const r = await review(); expect(r.status).toBe(409); expect(m.orderDetail).not.toHaveBeenCalled(); expect(m.preview).not.toHaveBeenCalled()
    }
})

// ---- ACK quantity boundary through the REAL mapper + placement path -----
import { ackQuantityEvidence } from "../snaptrade-reconciliation"
it.each([
    ["absent key", {}, { state: "absent" }, true], ["explicit null", { total_quantity: null }, { state: "null" }, true],
    ["positive string", { total_quantity: "2.4876" }, { state: "positive", value: 2.4876 }, true],
    ["positive number", { total_quantity: 2.4876 }, { state: "positive", value: 2.4876 }, true],
    ["malformed abc", { total_quantity: "abc" }, { state: "invalid" }, false], ["prefix 2.5junk", { total_quantity: "2.4876junk" }, { state: "invalid" }, false],
    ["explicit zero", { total_quantity: "0" }, { state: "invalid" }, false], ["numeric zero", { total_quantity: 0 }, { state: "invalid" }, false],
    ["exponent", { total_quantity: "2.4876e0" }, { state: "invalid" }, false], ["sign", { total_quantity: "+2.4876" }, { state: "invalid" }, false],
    ["whitespace", { total_quantity: " 2.4876" }, { state: "invalid" }, false], ["negative", { total_quantity: "-1" }, { state: "invalid" }, false],
    ["boolean", { total_quantity: true }, { state: "invalid" }, false],
])("placement persists ACK quantity (%s) from the raw body and reconciliation honours it", async (_l, ack, expected, resolvable) => {
    m.place.mockResolvedValue({ data: { brokerage_order_id: "broker-order", status: "ACCEPTED", ...ack } })
    const r = (await review()).body
    expect((await submit(r)).status).toBe(200)
    const row = m.rows.get(r.reviewId)
    expect(row.state).toBe("complete"); expect(row.result.ackQuantity).toEqual(expected)
    const evidence = terminalOrderEvidence(row, detail())
    if (resolvable) expect(evidence).toMatchObject({ status: "EXECUTED", totalQuantity: 2.4876 })
    else expect(evidence).toBeNull()
})
it("share placements keep the existing result shape (no ackQuantity) and display mapper semantics", async () => {
    m.preview.mockResolvedValue(checkedTrade({ units: 2 }))
    m.place.mockResolvedValue({ data: { brokerage_order_id: "broker-order", status: "ACCEPTED", total_quantity: "2" } })
    const r = (await review({ accountId: "a", symbol: "AAPL", action: "BUY", units: 2, orderType: "Market", timeInForce: "Day", price: null, stop: null })).body
    const res = await submit(r); expect(res.status).toBe(200)
    const body = await res.json(); expect(body).not.toHaveProperty("ackQuantity"); expect(body.totalQuantity).toBe(2)
    expect(ackQuantityEvidence(undefined)).toEqual({ state: "absent" })
})

it.each(["ALPACA", "PUBLIC", "TASTYTRADE", "ROBINHOOD-AGENTIC", "WEBULL"])("offers real dollars for %s only after namespace, cash and listing proof", async slug => {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ [slug]: { ...alpacaCaps["ALPACA-PAPER"], timeInForce: ["Day"], notional: { ...notionalBlock, minAmount: slug === "WEBULL" ? "5.00" : "1.00" } } }))
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [{ slug, allows_trading: true, enabled: true, maintenance_mode: false }] } })
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug, allows_trading: true } }] })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: "cash" } })
    const res = await quote(req({ accountId: "a", symbol: "AAPL" }))
    expect(res.status).toBe(200)
    expect((await res.json()).orderCapabilities.rules.map((r: any) => r.amountMode)).toEqual(["shares", "dollars"])
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [] } })
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(503)
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})

it("rejects unknown US policy, Public GTC, and sub-$5 Webull configuration", () => {
    const base = alpacaCaps["ALPACA-PAPER"]
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({
        SCHWAB: base, UNKNOWN: base, PUBLIC: base, WEBULL: { ...base, notional: { ...notionalBlock, minAmount: "1.00" } },
        ETRADE: { ...base, fractional: true },
    }))
    for (const slug of ["SCHWAB", "UNKNOWN", "PUBLIC", "ETRADE"]) expect(() => capability(slug)).toThrow()
    expect(capability("WEBULL")).not.toHaveProperty("notional")
})

const fractionalBuy = { accountId: "a", symbol: "AAPL", action: "BUY", units: 0.75, orderType: "Market", timeInForce: "Day" }
function fractionalBroker(slug: string, decimalPlaces = 6) {
    const min = ["MOOMOO", "WEBULL"].includes(slug) ? "5.00" : undefined
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ [slug]: {
        ...alpacaCaps["ALPACA-PAPER"], timeInForce: ["Day"],
        notional: slug === "MOOMOO" ? undefined : { ...notionalBlock, minAmount: min ?? "1.00" },
        fractionalOrders: { orderTypes: { Market: ["Day"] }, decimalPlaces, ...(min ? { minOrderValue: min } : {}) },
    } }))
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [{ slug, allows_trading: true, enabled: true, maintenance_mode: false }] } })
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug, allows_trading: true, allows_fractional_units: false } }] })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: slug === "ALPACA-PAPER", cash_or_margin: "cash" } })
    m.preview.mockResolvedValue(checkedTrade({ units: 0.75 }))
}
it.each(["ALPACA-PAPER", "MOOMOO", "PUBLIC", "TASTYTRADE", "WEBULL"])("%s fractional quote/review/checked placement uses additive V1 proof, never deprecated flag", async slug => {
    fractionalBroker(slug)
    if (["MOOMOO", "WEBULL"].includes(slug)) m.instruments.mockResolvedValue({ data: { instruments: [] } })
    const body = await (await quote(req({ accountId: "a", symbol: "AAPL" }))).json()
    expect(body.orderCapabilities.version).toBe(1)
    expect(body.orderCapabilities.rules[0]).toMatchObject({ fractional: false, fractionalOrderTypes: { Market: ["Day"] }, fractionalDecimalPlaces: 6, fractionalAvailability: "broker_confirmed_at_review", previewRequired: true })
    if (["MOOMOO", "WEBULL"].includes(slug)) expect(body.orderCapabilities.rules[0].fractionalMinOrderValue).toBe("5.00")
    const r = await review(fractionalBuy); expect(r.status).toBe(200)
    expect(m.preview.mock.calls[0][0]).toMatchObject({ units: 0.75, notional_value: null })
    expect((await submit(r.body)).status).toBe(200)
    expect(m.place).toHaveBeenCalledWith(expect.objectContaining({ tradeId: "checked-trade" }))
    expect(m.force).not.toHaveBeenCalled()
})
it.each([{ units: 0.75000001 }, { units: 0.750001 }, { orderType: "Limit", price: 10 }, { timeInForce: "GTC" }])("fractional order server rejects unsupported precision/type/TIF %j", async changes => {
    fractionalBroker("ALPACA-PAPER", 3)
    expect((await review({ ...fractionalBuy, ...changes })).status).not.toBe(200)
    expect(m.preview).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it.each(["MOOMOO", "WEBULL"])("%s enforces documented fractional $5 minimum", async slug => {
    fractionalBroker(slug); m.instruments.mockResolvedValue({ data: { instruments: [] } })
    expect((await review({ ...fractionalBuy, units: 0.4 })).status).toBe(400)
    expect(m.preview).not.toHaveBeenCalled()
})
it.each([null, {}, { instruments: null }, { instruments: [{ ...instrument, fractionable: false }] }, { instruments: [{ ...instrument, tradeable: false }] }, { instruments: [{ ...instrument, universal_symbol_id: "other" }] }, { instruments: [{ ...instrument, fractionable: null }] }])("preview-only policy never bypasses malformed/negative/conflicting instrument facts %j", async data => {
    fractionalBroker("WEBULL"); m.instruments.mockResolvedValue({ data })
    expect((await review(fractionalBuy)).status).not.toBe(200)
    expect(m.preview).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("preview-only transport errors stay closed; instrument-capable empty list stays closed", async () => {
    fractionalBroker("WEBULL"); m.instruments.mockRejectedValue(new Error("timeout"))
    expect((await review(fractionalBuy)).status).not.toBe(200)
    fractionalBroker("PUBLIC"); m.instruments.mockResolvedValue({ data: { instruments: [] } })
    expect((await review(fractionalBuy)).status).not.toBe(200)
    expect(m.preview).not.toHaveBeenCalled()
})
it.each([{ units: 0.7 }, { account: "other" }, { action: "SELL" }, { symbol: { universal_symbol_id: "other" } }, { order_type: "Limit" }, { time_in_force: "GTC" }, { id: null }])("fractional preview must echo exact request %j", async changes => {
    fractionalBroker("PUBLIC"); m.preview.mockResolvedValue(checkedTrade({ units: 0.75, ...changes }))
    expect((await review(fractionalBuy)).status).not.toBe(200)
    expect(m.rows.size).toBe(0); expect(m.force).not.toHaveBeenCalled()
})
it("fractional preview failure never chooses force placement", async () => {
    fractionalBroker("PUBLIC"); m.preview.mockRejectedValue(new Error("broker rejection"))
    expect((await review(fractionalBuy)).status).not.toBe(200)
    expect(m.rows.size).toBe(0); expect(m.force).not.toHaveBeenCalled()
})
it("fractional confirm requires saved checked ID and fresh positive capable metadata", async () => {
    fractionalBroker("PUBLIC"); const r = await review(fractionalBuy); expect(r.status).toBe(200)
    m.instruments.mockResolvedValue({ data: { instruments: [{ ...instrument, fractionable: false }] } })
    expect((await submit(r.body)).status).toBe(409)
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("fractional confirm without a trade ID cannot consume or force submit", async () => {
    fractionalBroker("PUBLIC"); const r = await review(fractionalBuy); m.rows.get(r.body.reviewId).trade_id = null
    expect((await submit(r.body)).status).toBe(409)
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("Webull dollars with valid unsupported instruments binds real notional to checked trade", async () => {
    fractionalBroker("WEBULL"); m.instruments.mockResolvedValue({ data: { instruments: [] } }); m.preview.mockResolvedValue(checkedTrade())
    const body = await (await quote(req({ accountId: "a", symbol: "AAPL" }))).json()
    expect(body.orderCapabilities.rules[1]).toMatchObject({ amountMode: "dollars", availability: "broker_confirmed_at_review", minAmount: "5.00" })
    const r = await review(); expect(r.status).toBe(200)
    expect(m.preview.mock.calls[0][0]).toMatchObject({ units: null, notional_value: "25.00" })
    expect((await submit(r.body)).status).toBe(200); expect(m.force).not.toHaveBeenCalled()
})
it.each(["XNAS", "XNYS", "ARCX"])("accepts verified US equity MIC %s regardless short display code", async mic => {
    m.quotes.mockResolvedValue({ data: [{ symbol: { ...listing, exchange: { code: "provider-short-name", mic_code: mic } }, ask_price: 10 }] })
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(200)
})
it.each([null, "", "XLON", "XOTC", "XNYS ", "xnys"])("rejects unknown, non-US or non-normalized quote MIC %j", async mic => {
    m.quotes.mockResolvedValue({ data: [{ symbol: { ...listing, exchange: { code: "NYSE", mic_code: mic } }, ask_price: 10 }] })
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(422)
})

it.each([0, 7, 1.5, "6", null])("rejects malformed fractional app precision %j", async precision => {
    fractionalBroker("PUBLIC", precision as any)
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(503)
})
it("fractional map cannot bypass preview:false or whole-order capability intersection", () => {
    for (const changes of [{ preview: false }, { orderTypes: ["Limit"] }, { timeInForce: ["GTC"] }]) {
        vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ "ALPACA-PAPER": { ...alpacaCaps["ALPACA-PAPER"], fractionalOrders: { orderTypes: { Market: ["Day"] }, decimalPlaces: 6 }, ...changes } }))
        expect(() => capability("ALPACA-PAPER")).toThrow()
    }
})
it("Webull preview-only fresh negative blocks confirm and never forces", async () => {
    fractionalBroker("WEBULL"); m.instruments.mockResolvedValue({ data: { instruments: [] } })
    const r = await review(fractionalBuy); expect(r.status).toBe(200)
    m.instruments.mockResolvedValue({ data: { instruments: [{ ...instrument, tradeable: false }] } })
    expect((await submit(r.body)).status).toBe(409)
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it.each(["CAD", "EUR"])("USD launch rejects foreign listing currency %s even on NYSE MIC", async code => {
    m.quotes.mockResolvedValue({ data: [{ symbol: { ...listing, currency: { code }, exchange: { mic_code: "XNYS" } }, ask_price: 10 }] })
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(422)
})
it.each(["op", "crypto", "ad"])("stock/ETF launch rejects other asset type %s", async code => {
    m.quotes.mockResolvedValue({ data: [{ symbol: { ...listing, type: { code } }, ask_price: 10 }] })
    expect((await quote(req({ accountId: "a", symbol: "AAPL" }))).status).toBe(422)
})

const expiryEpoch = Date.parse("2026-11-07T20:00:00Z")
function expiryClock() { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(expiryEpoch) }
it("anchors checked review expiry before slow preview and post-preview cash reads", async () => {
    expiryClock()
    m.preview.mockImplementation(async () => { vi.setSystemTime(expiryEpoch + 90_000); return checkedTrade() })
    let balances = 0
    m.balances.mockImplementation(async () => {
        if (++balances >= 2) vi.setSystemTime(expiryEpoch + 150_000)
        return { data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 100 }] }
    })
    const r = await review(); expect(r.status).toBe(200)
    expect(Date.parse(r.body.expiresAt)).toBe(expiryEpoch + 240_000)
    expect(m.rows.get(r.body.reviewId).expires_at).toBe(r.body.expiresAt)
    expect(Date.now()).toBe(expiryEpoch + 150_000)
    expect(m.consumeCalls).toBe(0); expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it.each(["preview", "post-preview balances"])("rejects exhausted %s budget before saving any review", async slowStage => {
    expiryClock()
    if (slowStage === "preview") m.preview.mockImplementation(async () => { vi.setSystemTime(expiryEpoch + 240_000); return checkedTrade() })
    else {
        let balances = 0
        m.balances.mockImplementation(async () => {
            if (++balances >= 2) vi.setSystemTime(expiryEpoch + 240_000)
            return { data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 100 }] }
        })
    }
    const r = await review(); expect(r.status).toBe(409); expect(r.body.code).toBe("order_review_expired")
    expect(m.saved).toHaveLength(0); expect(m.rows.size).toBe(0); expect(m.consumeCalls).toBe(0)
    expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it.each([240_000, 241_000])("confirm reads crossing fixed expiry to %d reject before consume and preserve an unsubmitted review", async elapsed => {
    expiryClock(); const r = await review(); expect(r.status).toBe(200)
    vi.setSystemTime(expiryEpoch + 239_000)
    m.balances.mockImplementation(async () => {
        vi.setSystemTime(expiryEpoch + elapsed)
        return { data: [{ currency: { id: "currency-usd", code: "USD" }, cash: 100 }] }
    })
    const response = await submit(r.body); expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "order_review_expired", submissionStatus: "not_submitted_by_this_request" })
    expect(m.consumeCalls).toBe(0); expect(m.rows.get(r.body.reviewId).state).toBe("reviewing")
    expect(m.generation).toBe(0); expect(m.place).not.toHaveBeenCalled(); expect(m.force).not.toHaveBeenCalled()
})
it("accepts confirm one millisecond before the conservative cutoff, retaining the provider safety minute", async () => {
    expiryClock(); const r = await review(); expect(r.status).toBe(200)
    vi.setSystemTime(expiryEpoch + 239_999)
    expect((await submit(r.body)).status).toBe(200)
    expect(m.consumeCalls).toBe(1); expect(m.place).toHaveBeenCalledOnce(); expect(m.force).not.toHaveBeenCalled()
    expect(m.rows.get(r.body.reviewId).state).toBe("complete")
})
