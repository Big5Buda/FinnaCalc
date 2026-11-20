import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
// Sizing V2: route-aware, account/listing-bound capabilities. SDK doubles
// only; any network access fails the test. Set SIZING_V2_FIXTURE_OUT to export
// the exact route responses as native golden fixtures.
const m = vi.hoisted(() => ({ list: vi.fn(), links: vi.fn(), quotes: vi.fn(), orders: vi.fn(), positions: vi.fn(), details: vi.fn(),
    partner: vi.fn(), balances: vi.fn(), preview: vi.fn(), place: vi.fn(), force: vi.fn(), instruments: vi.fn(), orderDetail: vi.fn(),
    storageVersion: 4 as number | null, rows: new Map<string, any>(), sequence: 0, generation: 0, client: null as any,
    instrumentOverride: null as boolean | null }))
vi.mock("@/lib/snaptrade-session", () => ({ loadSession: async () => ({ clientId: "key", userId: "vendor-user", userSecret: "fixture" }) }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "owner" }))
vi.mock("@/lib/snaptrade-access", () => ({ brokerageReadScope: async () => ({ countedConnectionId: null }) }))
vi.mock("@/lib/snaptrade", async () => ({ isTradingKeyApproved: (id: string) => id === "key",
    mapOrderRecord: (await vi.importActual<any>("../snaptrade")).mapOrderRecord, getSnapTrade: () => m.client }))
vi.mock("../snaptrade-order-capabilities", async () => {
    const actual = await vi.importActual<any>("../snaptrade-order-capabilities")
    return { ...actual, sizingInstrument: async (...a: any[]) => m.instrumentOverride ?? actual.sizingInstrument(...a) }
})
vi.mock("@/lib/snaptrade-order-reviews", () => ({
    reviewStorageVersion: async () => m.storageVersion,
    captureReviewGeneration: async () => String(m.generation),
    saveReview: async (r: any, dollar?: any) => {
        const row = { ...r, id: `review-${++m.sequence}`, state: "reviewing", dollar }; m.rows.set(row.id, row); return row
    },
    loadReview: async (id: string) => m.rows.has(id) ? { ...m.rows.get(id) } : null,
    consumeReview: async (id: string) => {
        const r = m.rows.get(id); if (!r || r.state !== "reviewing") return false
        r.state = "submitting"; m.generation++; return true
    },
    finishReview: async (id: string, _o: string, result: any, unknown: boolean) => { Object.assign(m.rows.get(id), { state: unknown ? "unknown" : "complete", result }) },
}))
vi.mock("@/lib/snaptrade-reconciliation", () => ({ prepareReviewGeneration: async () => String(m.generation), ackQuantityEvidence: () => null }))
import { impact, place, quote } from "../snaptrade-trading-routes"
import { capability, terms, sameTerms } from "../snaptrade-trading"
import { minimumBound, productBelow, requireSizingV2, sizingCapabilitiesV2 } from "../snaptrade-sizing-v2"
import { fundingModeEligible, ROUTE_SUPPORT } from "../snaptrade-route-policy"

const OUT = process.env.SIZING_V2_FIXTURE_OUT
function exportFixture(name: string, value: unknown) {
    if (!OUT) return
    mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, name), JSON.stringify(value, null, 2) + "\n")
}
const req = (body: any) => new NextRequest("https://test.invalid/api", { method: "POST", body: JSON.stringify(body) })
const json = async (res: Response) => ({ status: res.status, body: await res.json() })
const notionalBlock = { orderTypes: ["Market"], timeInForce: ["Day"], minAmount: "1.00", maxAmount: "10000.00" }
const fractionalBlock = { orderTypes: { Market: ["Day"] }, decimalPlaces: 4 }
const usd = { id: "currency-usd", code: "USD" }, cad = { id: "currency-cad", code: "CAD" }
const aapl = { id: "uid-aapl", symbol: "AAPL", type: { code: "cs" }, currency: usd, exchange: { code: "NASDAQ", mic_code: "XNAS" } }
const ry = { id: "uid-ry", symbol: "RY", type: { code: "cs" }, currency: cad, exchange: { code: "TSX", mic_code: "XTSE" } }
const lse = { id: "uid-vod", symbol: "VOD", type: { code: "cs" }, currency: { id: "currency-gbp", code: "GBP" }, exchange: { code: "LSE", mic_code: "XLON" } }

function broker(slug: string, caps: any, { paper = false, listing = aapl, balances = [{ currency: usd, cash: 100 }] }: any = {}) {
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ [slug]: caps }))
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [{ slug, allows_trading: true, enabled: true, maintenance_mode: false }] } })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: paper, cash_or_margin: "cash" } })
    m.links.mockResolvedValue({ data: [{ id: "c", type: "trade", disabled: false, brokerage: { slug, allows_trading: true } }] })
    m.quotes.mockResolvedValue({ data: [{ symbol: listing, ask_price: 10, bid_price: 9.5, last_trade_price: null }] })
    m.balances.mockResolvedValue({ data: balances })
    m.instruments.mockResolvedValue({ data: { instruments: [{ symbol: listing.symbol, exchange_mic: listing.exchange.mic_code, universal_symbol_id: listing.id, tradeable: true, fractionable: true }] } })
}
const alpaca = () => broker("ALPACA-PAPER", { orderTypes: ["Market", "Limit"], timeInForce: ["Day", "GTC"], fractional: true, preview: true,
    exchanges: ["NASDAQ"], notional: notionalBlock, fractionalOrders: fractionalBlock }, { paper: true })
const wealthsimple = () => broker("WEALTHSIMPLETRADE", { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: false,
    exchanges: ["TSX"] }, { listing: ry, balances: [{ currency: cad, cash: 250 }, { currency: usd, cash: 5 }] })
const wealthsimpleDollars = () => {
    broker("WEALTHSIMPLETRADE", { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["TSX"],
        notional: notionalBlock, selfDirectedRawTypes: ["TFSA"] }, { listing: ry, balances: [{ currency: cad, cash: 250 }, { currency: usd, cash: 5 }] })
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: "cash", raw_type: "TFSA" } })
}
const trading212 = (balances: any = [{ currency: usd, cash: 100 }]) => broker("TRADING212", { orderTypes: ["Market"], timeInForce: ["Day"], fractional: true,
    preview: true, exchanges: ["NASDAQ"], fractionalOrders: fractionalBlock }, { balances })
const checkedTrade = (changes: any = {}) => ({ data: { trade: { id: "checked-trade", account: "a", action: "BUY", units: null, order_type: "Market",
    time_in_force: "Day", price: null, symbol: { universal_symbol_id: "uid-aapl" }, ...changes },
    trade_impacts: [{ account: "a", currency: "currency-usd", estimated_commission: 0, forex_fees: 0, remaining_cash: 75 }] } })
const v2 = (currency = "USD") => ({ sizingVersion: 2, currency, minorUnit: 2 })
const dollarBuy = { accountId: "a", symbol: "AAPL", action: "BUY", amountMode: "dollars", notionalValue: "25.00", orderType: "Market", timeInForce: "Day", price: null, stop: null, ...v2() }
const fractionBuy = { accountId: "a", symbol: "AAPL", action: "BUY", amountMode: "shares", units: 0.125, orderType: "Market", timeInForce: "Day", price: null, stop: null, ...v2() }

beforeEach(() => {
    vi.resetAllMocks(); m.rows.clear(); m.sequence = 0; m.generation = 0; m.storageVersion = 4; m.instrumentOverride = null
    m.client = { accountInformation: { listUserAccounts: m.list, getAccountDetails: m.details, getUserAccountOrders: m.orders,
        getAllAccountPositions: m.positions, getUserAccountBalance: m.balances, getUserAccountOrderDetail: m.orderDetail },
        referenceData: { getPartnerInfo: m.partner, listAllBrokerageInstruments: m.instruments }, connections: { listBrokerageAuthorizations: m.links },
        trading: { getUserAccountQuotes: m.quotes, getOrderImpact: m.preview, placeOrder: m.place, placeForceOrder: m.force } }
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true"); vi.stubEnv("SNAPTRADE_TRADE_CONNECTIONS_ENABLED", "true")
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("LIVE REQUEST FORBIDDEN") }))
    m.list.mockResolvedValue({ data: [{ id: "a", brokerage_authorization: "c" }] })
    m.orders.mockResolvedValue({ data: [] })
    m.positions.mockResolvedValue({ data: { results: [] } })
    m.preview.mockResolvedValue(checkedTrade())
    m.place.mockResolvedValue({ data: { brokerage_order_id: "broker-order", status: "ACCEPTED", total_quantity: "2.5" } })
    alpaca()
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

// ---- Backwards compatibility ----------------------------------------------
it("V1 quote and terms are unchanged: no V2 keys unless the caller opts in", async () => {
    const v1 = await json(await quote(req({ accountId: "a", symbol: "AAPL" })))
    expect(v1.status).toBe(200)
    expect(v1.body).not.toHaveProperty("sizingCapabilities"); expect(v1.body).not.toHaveProperty("cashSnapshot")
    expect(v1.body.orderCapabilities.version).toBe(1)
    const legacy = { accountId: "a", symbol: "AAPL", action: "BUY", units: 2, orderType: "Market", timeInForce: "Day", price: null, stop: null }
    expect(Object.keys(terms(legacy))).not.toContain("sizingVersion")
    expect(JSON.stringify(terms({ ...dollarBuy, sizingVersion: undefined, currency: undefined, minorUnit: undefined })))
        .toBe('{"accountId":"a","symbol":"AAPL","action":"BUY","amountMode":"dollars","units":null,"notionalValue":"25.00","orderType":"Market","timeInForce":"Day","price":null,"stop":null}')
})
it("V1 still refuses non-USD listings; V2 accepts only reviewed route listings", async () => {
    wealthsimple()
    expect((await quote(req({ accountId: "a", symbol: "RY" }))).status).toBe(422)
    expect((await quote(req({ accountId: "a", symbol: "RY", sizingVersion: 2 }))).status).toBe(200)
    broker("WEALTHSIMPLETRADE", { orderTypes: ["Market"], timeInForce: ["Day"], fractional: false, preview: false, exchanges: ["LSE"] }, { listing: lse })
    expect((await quote(req({ accountId: "a", symbol: "VOD", sizingVersion: 2 }))).status).toBe(422)
})

// ---- Terms ----------------------------------------------------------------
it.each([
    ["version 3", { sizingVersion: 3 }], ["lowercase currency", { currency: "usd" }], ["unreviewed currency", { currency: "JPY", minorUnit: 0 }],
    ["wrong minor unit", { minorUnit: 3 }], ["missing currency", { currency: undefined }], ["non-canonical amount", { notionalValue: "25" }],
    ["three places", { notionalValue: "25.001" }], ["V1 body with currency", { sizingVersion: undefined, minorUnit: undefined }],
])("rejects invalid V2 terms (%s) before any provider call", async (_label, change) => {
    expect(() => terms({ ...dollarBuy, ...change })).toThrow()
    expect((await impact(req({ ...dollarBuy, ...change }))).status).toBe(400)
    expect(m.list).not.toHaveBeenCalled()
})
it("V2 terms are canonical and compare unequal across currencies", () => {
    expect(terms(dollarBuy)).toMatchObject({ notionalValue: "25.00", sizingVersion: 2, currency: "USD", minorUnit: 2 })
    expect(sameTerms(dollarBuy, { ...dollarBuy, currency: "CAD" })).toBe(false)
    expect(sameTerms(dollarBuy, { ...dollarBuy, sizingVersion: undefined, currency: undefined, minorUnit: undefined })).toBe(false)
})

// ---- Route capabilities -----------------------------------------------------
it("Alpaca (USD): Dollars and fractional Shares as exact rules with application bounds", async () => {
    const res = await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))
    expect(res.status).toBe(200)
    const caps = res.body.sizingCapabilities
    expect(caps).toMatchObject({ version: 2, accountId: "a", symbol: "AAPL", currency: "USD", minorUnit: 2, denials: [] })
    expect(caps.rules.find((r: any) => r.amountMode === "dollars" && r.action === "BUY")).toEqual({ amountMode: "dollars", action: "BUY",
        orderType: "Market", timeInForce: "Day", quantityPrecision: 0, minimum: { value: "1.00", source: "application" }, maximum: { value: "10000.00", source: "application" } })
    expect(caps.rules.find((r: any) => r.amountMode === "shares" && r.orderType === "Market").quantityPrecision).toBe(4)
    expect(caps.rules.filter((r: any) => r.amountMode === "shares" && r.orderType === "Limit").every((r: any) => r.quantityPrecision === 0)).toBe(true)
    const keys = caps.rules.map((r: any) => [r.amountMode, r.action, r.orderType, r.timeInForce].join("|"))
    expect(new Set(keys).size).toBe(keys.length)
    expect(res.body.cashSnapshot).toEqual({ accountId: "a", currency: "USD", cash: 100 })
    exportFixture("SizingV2QuoteUSD.json", res.body)
})
it("Wealthsimple (CAD): whole Shares + Dollars from account-quote identity; no fractional units; Dollars need a self-directed grant", async () => {
    wealthsimpleDollars()
    m.instruments.mockResolvedValue({ data: { instruments: [{ symbol: "RY", exchange_mic: "XTSE", universal_symbol_id: null, tradeable: null, fractionable: null }] } })
    const res = await json(await quote(req({ accountId: "a", symbol: "RY", sizingVersion: 2 })))
    const caps = res.body.sizingCapabilities
    expect(caps).toMatchObject({ currency: "CAD", minorUnit: 2, symbol: "RY", denials: [] })
    expect(caps.rules.filter((r: any) => r.amountMode === "shares").every((r: any) => r.quantityPrecision === 0 && r.timeInForce === "Day")).toBe(true)
    const buy = caps.rules.find((r: any) => r.amountMode === "dollars" && r.action === "BUY")
    const sell = caps.rules.find((r: any) => r.amountMode === "dollars" && r.action === "SELL")
    expect(buy).toEqual({ amountMode: "dollars", action: "BUY", orderType: "Market", timeInForce: "Day", quantityPrecision: 0,
        minimum: { value: "1.00", source: "application" }, maximum: { value: "10000.00", source: "application" } })
    expect({ ...sell, action: "BUY" }).toEqual(buy)
    expect(m.instruments).not.toHaveBeenCalled()
    expect(res.body.cashSnapshot).toEqual({ accountId: "a", currency: "CAD", cash: 250 })
    exportFixture("SizingV2QuoteCAD.json", res.body)
    // Without a reviewed self-directed raw_type, or without preview, Dollars are denied.
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: "cash", raw_type: "Managed TFSA" } })
    expect((await json(await quote(req({ accountId: "a", symbol: "RY", sizingVersion: 2 })))).body.sizingCapabilities.denials)
        .toEqual([{ amountMode: "dollars", code: "account_product_unverified" }])
    wealthsimple()
    expect((await json(await quote(req({ accountId: "a", symbol: "RY", sizingVersion: 2 })))).body.sizingCapabilities.denials)
        .toEqual([{ amountMode: "dollars", code: "mode_not_enabled" }])
    // Ceiling: GTC or fractional configuration for this route is refused outright.
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ WEALTHSIMPLETRADE: { orderTypes: ["Limit"], timeInForce: ["Day", "GTC"], fractional: false, preview: false, exchanges: ["TSX"] } }))
    expect(() => capability("WEALTHSIMPLETRADE")).toThrow()
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ WEALTHSIMPLETRADE: { orderTypes: ["Market"], timeInForce: ["Day"], fractional: true, preview: true, exchanges: ["TSX"] } }))
    expect(() => capability("WEALTHSIMPLETRADE")).toThrow()
})
it("Webull Canada: whole Shares in CAD; no sizing modes", async () => {
    broker("WEBULL-CANADA", { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["TSX"] },
        { listing: ry, balances: [{ currency: cad, cash: 40 }] })
    const caps = (await json(await quote(req({ accountId: "a", symbol: "RY", sizingVersion: 2 })))).body.sizingCapabilities
    expect(caps.rules.map((r: any) => [r.amountMode, r.action, r.orderType, r.timeInForce, r.quantityPrecision].join("|")))
        .toEqual(["shares|BUY|Market|Day|0", "shares|BUY|Limit|Day|0", "shares|SELL|Market|Day|0", "shares|SELL|Limit|Day|0"])
    expect(caps.denials).toEqual([{ amountMode: "dollars", code: "sizing_mode_not_supported" }])
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ "WEBULL-CANADA": { orderTypes: ["Market"], timeInForce: ["Day"], fractional: true, preview: true, exchanges: ["TSX"] } }))
    expect(() => capability("WEBULL-CANADA")).toThrow()
})
it("Trading212: fractional quantity at Market/Day; Dollars unsupported; Limit configuration refused", async () => {
    trading212([{ currency: { id: "currency-gbp", code: "GBP" }, cash: 80 }])
    const res = await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))
    const caps = res.body.sizingCapabilities
    expect(caps.rules).toEqual([
        { amountMode: "shares", action: "BUY", orderType: "Market", timeInForce: "Day", quantityPrecision: 4, minimum: null, maximum: null, fractionalMinimum: null },
        { amountMode: "shares", action: "SELL", orderType: "Market", timeInForce: "Day", quantityPrecision: 4, minimum: null, maximum: null, fractionalMinimum: null }])
    expect(caps.denials).toEqual([{ amountMode: "dollars", code: "sizing_mode_not_supported" }])
    // GBP-funded account: no USD balance, so funding is unknown, not converted.
    expect(res.body.cashSnapshot).toEqual({ accountId: "a", currency: "USD", cash: null })
    exportFixture("SizingV2QuoteT212.json", res.body)
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify({ TRADING212: { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["NASDAQ"] } }))
    expect(() => capability("TRADING212")).toThrow()
})
it("denials are explicit per mode: storage, account product, instrument", async () => {
    m.storageVersion = 3
    let caps = (await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))).body.sizingCapabilities
    expect(caps.denials).toEqual([{ amountMode: "dollars", code: "storage_upgrade_required" }])
    expect(caps.rules.some((r: any) => r.amountMode === "dollars")).toBe(false)
    m.storageVersion = 4
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: true, cash_or_margin: "unknown" } })
    caps = (await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))).body.sizingCapabilities
    expect(caps.denials).toEqual([{ amountMode: "shares", code: "account_product_unverified" }, { amountMode: "dollars", code: "account_product_unverified" }])
    expect(caps.rules.every((r: any) => r.amountMode === "shares" && r.quantityPrecision === 0)).toBe(true)
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: true, cash_or_margin: "cash" } })
    m.instrumentOverride = false
    caps = (await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))).body.sizingCapabilities
    expect(caps.denials.map((d: any) => d.code)).toEqual(["instrument_tradeability_unconfirmed", "instrument_tradeability_unconfirmed"])
})
it("bound provenance: documented broker minimums carry their source; other values are FinnaCalc's own", () => {
    expect(minimumBound("WEBULL", "5.00")).toEqual({ value: "5.00", source: "broker_documented", url: "https://support.snaptrade.com/Webull-e1afeaa69a1c839ba37c0134f951baa2" })
    expect(minimumBound("MOOMOO", "5.00")).toEqual({ value: "5.00", source: "broker_documented", url: "https://support.snaptrade.com/Moomoo-e33feaa69a1c836f891381bb17911594?pvs=21" })
    expect(minimumBound("WEBULL", "10.00")).toEqual({ value: "10.00", source: "application" })
    expect(minimumBound("ALPACA", "1.00")).toEqual({ value: "1.00", source: "application" })
})
it("Moomoo fractional units fail closed without account-region proof; Webull keeps its documented minimum on both sides", async () => {
    m.instrumentOverride = true
    const context = (slug: string, cap: any) => ({ connection: { brokerage: { slug } }, account: { id: "a", cash_or_margin: "cash", is_paper: false }, cap }) as any
    const q = { symbol: { id: "uid-aapl", symbol: "AAPL", currency: usd, exchange: { mic_code: "XNAS" } } }
    const moomoo = await sizingCapabilitiesV2(context("MOOMOO", { orderTypes: ["Market"], timeInForce: ["Day"], preview: true,
        fractionalOrders: { orderTypes: { Market: ["Day"] }, decimalPlaces: 4, minOrderValue: "5.00" } }), "key", q, { fresh: false })
    expect(moomoo.denials).toEqual([{ amountMode: "shares", code: "fractional_account_region_unverified" }, { amountMode: "dollars", code: "sizing_mode_not_supported" }])
    expect(moomoo.rules.every(r => r.quantityPrecision === 0 && !("fractionalMinimum" in r))).toBe(true)
    const webull = await sizingCapabilitiesV2(context("WEBULL", { orderTypes: ["Market"], timeInForce: ["Day"], preview: true,
        notional: { orderTypes: ["Market"], timeInForce: ["Day"], minAmount: "5.00", maxAmount: "10000.00" },
        fractionalOrders: { orderTypes: { Market: ["Day"] }, decimalPlaces: 4, minOrderValue: "5.00" } }), "key", q, { fresh: false })
    const documented = minimumBound("WEBULL", "5.00")
    for (const mode of ["shares", "dollars"] as const) {
        const [b, s] = (["BUY", "SELL"] as const).map(action => webull.rules.find(r => r.amountMode === mode && r.action === action)!)
        expect({ ...s, action: "BUY" }).toEqual(b)
    }
    expect(webull.rules.find(r => r.amountMode === "dollars")!.minimum).toEqual(documented)
    expect(webull.rules.find(r => r.amountMode === "shares")!.fractionalMinimum).toEqual(documented)
})
it("fractional minimum is compared in exact decimal, not a binary product", async () => {
    // 0.29 * 100 === 28.999999999999996 in IEEE-754; the exact value is 29.
    expect(0.29 * 100 < 29).toBe(true)
    expect(productBelow(0.29, 100, "29.00")).toBe(false)
    expect(productBelow(0.2899, 100, "29.00")).toBe(true)
    expect(productBelow(0.2901, 100, "29.00")).toBe(false)
    expect(productBelow(0.000001, 1e-7, "0.01")).toBe(true)
    expect(productBelow(2, 1e21, "5.00")).toBe(false)
    m.instrumentOverride = true
    const context = { connection: { brokerage: { slug: "WEBULL" } }, account: { id: "a", cash_or_margin: "cash", is_paper: false },
        cap: { orderTypes: ["Market"], timeInForce: ["Day"], preview: true, fractionalOrders: { orderTypes: { Market: ["Day"] }, decimalPlaces: 4, minOrderValue: "29.00" } } } as any
    const q = (ask: unknown) => ({ ask_price: ask, bid_price: 1, symbol: { id: "uid-aapl", symbol: "AAPL", currency: usd, exchange: { mic_code: "XNAS" } } })
    const order = (units: number) => terms({ ...fractionBuy, units })
    await expect(requireSizingV2(context, "key", q(100), order(0.29), { fresh: true })).resolves.toMatchObject({ fractionalMinimum: { value: "29.00", source: "application" } })
    await expect(requireSizingV2(context, "key", q(100), order(0.2899), { fresh: true })).rejects.toMatchObject({ code: "order_invalid" })
    await expect(requireSizingV2(context, "key", q(100), order(0.2901), { fresh: true })).resolves.toBeTruthy()
    for (const missing of [null, undefined, Number.NaN, 0, -1, "100"])
        await expect(requireSizingV2(context, "key", q(missing), order(0.29), { fresh: true })).rejects.toMatchObject({ code: "order_invalid" })
})
// ---- Review / confirm --------------------------------------------------------
it("V2 dollar review echoes exact canonical terms; confirm revalidates and places the checked trade only", async () => {
    const r = await json(await impact(req(dollarBuy)))
    expect(r.status).toBe(200)
    expect(r.body.terms).toEqual({ accountId: "a", symbol: "AAPL", action: "BUY", amountMode: "dollars", units: null, notionalValue: "25.00",
        orderType: "Market", timeInForce: "Day", price: null, stop: null, sizingVersion: 2, currency: "USD", minorUnit: 2 })
    expect(m.preview).toHaveBeenCalledWith(expect.objectContaining({ units: null, notional_value: "25.00" }))
    exportFixture("SizingV2TermsUSD.json", r.body.terms)
    const tampered = await place(req({ reviewId: r.body.reviewId, confirmed: true, terms: { ...r.body.terms, currency: "CAD" } }))
    expect(tampered.status).toBe(409); expect(m.place).not.toHaveBeenCalled()
    const placed = await place(req({ reviewId: r.body.reviewId, confirmed: true, terms: r.body.terms }))
    expect(placed.status).toBe(200)
    expect(m.place).toHaveBeenCalledWith(expect.objectContaining({ tradeId: "checked-trade" })); expect(m.force).not.toHaveBeenCalled()
})
it("V2 dollars are refused when withdrawn or out of bounds, with the withdrawal code the app understands", async () => {
    m.storageVersion = 3
    expect((await json(await impact(req(dollarBuy)))).body.code).toBe("dollar_orders_unavailable")
    m.storageVersion = 4
    expect((await json(await impact(req({ ...dollarBuy, notionalValue: "0.99" })))).status).toBe(400)
    expect((await json(await impact(req({ ...dollarBuy, currency: "CAD" })))).body.code).toBe("dollar_orders_unavailable")
    expect(m.preview).not.toHaveBeenCalled()
})
it("V2 fractional Shares at Trading212: precision enforced server-side, exact echo", async () => {
    trading212()
    m.preview.mockResolvedValue(checkedTrade({ units: 0.125 }))
    const r = await json(await impact(req(fractionBuy)))
    expect(r.status).toBe(200)
    expect(r.body.terms).toMatchObject({ amountMode: "shares", units: 0.125, sizingVersion: 2, currency: "USD", minorUnit: 2 })
    exportFixture("SizingV2TermsT212.json", r.body.terms)
    m.preview.mockClear()
    const tooPrecise = await json(await impact(req({ ...fractionBuy, units: 0.12345 })))
    expect(tooPrecise).toMatchObject({ status: 409, body: { code: "sizing_rule_unavailable" } })
    const limit = await json(await impact(req({ ...fractionBuy, units: 1, orderType: "Limit", price: 10 })))
    expect(limit.status).toBe(409)
    const dollars = await json(await impact(req({ ...dollarBuy })))
    expect(dollars.body.code).toBe("dollar_orders_unavailable")
    expect(m.preview).not.toHaveBeenCalled()
})
it("V2 Wealthsimple CAD whole-share review binds CAD and refuses fractional quantity", async () => {
    wealthsimple()
    m.force.mockResolvedValue({ data: { brokerage_order_id: "broker-order", status: "ACCEPTED" } })
    const whole = { ...fractionBuy, symbol: "RY", units: 2, ...v2("CAD") }
    const r = await json(await impact(req(whole)))
    expect(r.status).toBe(200)
    expect(r.body.terms).toMatchObject({ symbol: "RY", units: 2, currency: "CAD", minorUnit: 2 })
    expect((await json(await impact(req({ ...whole, units: 0.5 })))).body.code).toBe("sizing_rule_unavailable")
    expect((await json(await impact(req({ ...whole, currency: "USD" })))).body.code).toBe("sizing_rule_unavailable")
})
it("V2 Wealthsimple CAD dollar review: exact notional preview bound to the account quote's universal id", async () => {
    wealthsimpleDollars()
    m.preview.mockResolvedValue({ data: { trade: { id: "checked-trade", account: "a", action: "BUY", units: null, order_type: "Market",
        time_in_force: "Day", price: null, symbol: { universal_symbol_id: "uid-ry" } },
        trade_impacts: [{ account: "a", currency: "currency-cad", estimated_commission: 0, forex_fees: 0, remaining_cash: 225 }] } })
    const body = { ...dollarBuy, symbol: "RY", ...v2("CAD") }
    const r = await json(await impact(req(body)))
    expect(r.status).toBe(200)
    expect(m.preview).toHaveBeenCalledWith(expect.objectContaining({ universal_symbol_id: "uid-ry", units: null, notional_value: "25.00" }))
    expect(r.body.terms).toMatchObject({ amountMode: "dollars", notionalValue: "25.00", currency: "CAD", minorUnit: 2 })
    exportFixture("SizingV2TermsCAD.json", r.body.terms)
    // A preview for a different listing is refused; nothing is stored.
    m.preview.mockResolvedValue({ data: { trade: { id: "x", account: "a", action: "BUY", units: null, order_type: "Market",
        time_in_force: "Day", price: null, symbol: { universal_symbol_id: "uid-other" } }, trade_impacts: [] } })
    const before = m.rows.size
    expect((await impact(req(body))).status).toBe(502)
    expect(m.rows.size).toBe(before)
})
it("one shared funding-mode resolver across every route class (not a per-broker allowlist)", () => {
    for (const [slug, route] of Object.entries(ROUTE_SUPPORT)) {
        expect(fundingModeEligible(slug, { cash_or_margin: "cash" })).toBe(true)
        for (const mode of ["unknown", null, undefined, "MARGIN", ""]) expect(fundingModeEligible(slug, { cash_or_margin: mode })).toBe(false)
        expect(fundingModeEligible(slug, { cash_or_margin: "margin" })).toBe(route.marginAccounts === "cash_funded")
        if (route.marginAccounts) expect(route.evidence.some(u => u.startsWith("https://"))).toBe(true)
    }
    expect(fundingModeEligible("UNKNOWN-ROUTE", { cash_or_margin: "margin" })).toBe(false)
    expect(fundingModeEligible("ALPACA", null)).toBe(false)
})
it("V2 Alpaca Paper margin account: Dollars + fractional rules, both sides identical; other routes' margin denied", async () => {
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: true, cash_or_margin: "margin" } })
    const caps = (await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))).body.sizingCapabilities
    expect(caps.denials).toEqual([])
    const buy = caps.rules.find((r: any) => r.amountMode === "dollars" && r.action === "BUY")
    expect({ ...caps.rules.find((r: any) => r.amountMode === "dollars" && r.action === "SELL"), action: "BUY" }).toEqual(buy)
    expect(caps.rules.find((r: any) => r.amountMode === "shares" && r.orderType === "Market" && r.action === "BUY").quantityPrecision).toBe(4)
    trading212()
    m.details.mockResolvedValue({ data: { id: "a", connection_id: "c", status: "open", kind: "investment", is_paper: false, cash_or_margin: "margin" } })
    const t212 = (await json(await quote(req({ accountId: "a", symbol: "AAPL", sizingVersion: 2 })))).body.sizingCapabilities
    expect(t212.denials).toEqual([{ amountMode: "shares", code: "account_product_unverified" }, { amountMode: "dollars", code: "sizing_mode_not_supported" }])
})
