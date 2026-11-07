import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ owner: "owner" as string | null, session: { clientId: "original-owned-key" } as any,
    reference: vi.fn(), partner: vi.fn(), rpc: vi.fn(), select: vi.fn(), owners: [] as string[], namespace: "original" as "original" | "next", log: vi.fn() }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => m.owner }))
vi.mock("@/lib/snaptrade-session", () => ({ loadSession: async () => m.session }))
vi.mock("@/lib/snaptrade", () => ({ isTradingKeyApproved: (id: string) => (process.env.SNAPTRADE_TRADING_APPROVED_CLIENT_IDS ?? "").split(",").includes(id), snapTradeKeyNamespace: () => m.namespace, activeSnapTradeClientId: () => "registration-key",
    getSnapTrade: ({ clientId }: any) => { m.owners.push(clientId); return { referenceData: { getPartnerInfo: m.partner } } } }))
vi.mock("@/lib/snaptrade-symbol-reference", () => ({ publicSymbolReference: m.reference }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: m.rpc,
    from: () => ({ select: () => ({ limit: m.select }) }) }) }))
import { GET } from "../../app/api/snaptrade/trading/status/route"
import { integrationReadiness } from "../snaptrade-readiness"
const req = () => new NextRequest("https://test.invalid/api/snaptrade/trading/status")
const caps = { ETRADE: { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["XNAS"] } }
beforeEach(() => {
    vi.resetAllMocks(); m.owner = "owner"; m.session = { clientId: "original-owned-key" }; m.owners = []; m.namespace = "original"
    vi.spyOn(console, "info").mockImplementation(m.log)
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "false")
    vi.stubEnv("SNAPTRADE_TRADING_APPROVED_CLIENT_IDS", "original-owned-key")
    vi.stubEnv("SNAPTRADE_TRADE_CONNECTIONS_ENABLED", "true")
    vi.stubEnv("SNAPTRADE_TRADING_BROKER_CAPABILITIES", JSON.stringify(caps))
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture")
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("LIVE REQUEST FORBIDDEN") }))
    m.partner.mockResolvedValue({ data: { can_access_trades: true, allowed_brokerages: [
        { slug: "ETRADE", enabled: true, maintenance_mode: false, allows_trading: true },
        { slug: "SCHWAB", enabled: true, maintenance_mode: false, allows_trading: false },
        { slug: "UNREVIEWED", enabled: true, maintenance_mode: false, allows_trading: true },
        { slug: "PAUSED", enabled: true, maintenance_mode: true, allows_trading: true },
    ] } })
    m.rpc.mockResolvedValue({ data: 3, error: null }); m.select.mockResolvedValue({ error: null })
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
it("authenticates before provider/storage calls and never caches a user's capability", async () => {
    m.owner = null
    const res = await GET(req()); expect(res.status).toBe(401)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
    expect(m.partner).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled()
})
it("reads the original owner key even with release off and returns only safe metadata", async () => {
    const res = await GET(req()), body = await res.json()
    expect(body).toMatchObject({ enabled: false, tradeConnectionsEnabled: false, supportedBrokerages: ["ETRADE"], reasonCode: "trading_not_enabled",
        provider: { tradingEnabled: true, connectionBrokerages: ["ETRADE", "SCHWAB", "UNREVIEWED"], tradingBrokerages: ["ETRADE", "UNREVIEWED"] } })
    expect(m.owners).toEqual(["original-owned-key"])
    expect(JSON.stringify(body)).not.toMatch(/original-owned-key|registration-key|fixture|clientId|userSecret/)
    expect(m.rpc).not.toHaveBeenCalled()
    await GET(req()); expect(m.partner).toHaveBeenCalledTimes(2)
})
it("uses registration key only when this owner has no stored session", async () => {
    m.session = null; await GET(req()); expect(m.owners).toEqual(["registration-key"])
})
it("diagnostic artifact cannot claim absent execution/upgrade routes ready even with flags on", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true")
    const body = await integrationReadiness("original-owned-key")
    expect(body.enabled).toBe(false); expect(body.tradeConnectionsEnabled).toBe(false)
    expect(body.reasonCode).toBe("execution_routes_unavailable"); expect(m.rpc).not.toHaveBeenCalled()
})
it("a real execution artifact additionally requires working durable storage and exact key/broker capabilities", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true")
    const manifest = { execution: true, tradeConnections: true }
    expect(await integrationReadiness("original-owned-key", manifest)).toMatchObject({ enabled: true, tradeConnectionsEnabled: true, supportedBrokerages: ["ETRADE"] })
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
    expect(await integrationReadiness("original-owned-key", manifest)).toMatchObject({ enabled: false, tradeConnectionsEnabled: true, reasonCode: "order_storage_unavailable" })
    vi.stubEnv("SNAPTRADE_TRADING_APPROVED_CLIENT_IDS", "another-key")
    expect(await integrationReadiness("original-owned-key", manifest)).toMatchObject({ enabled: false, tradeConnectionsEnabled: false })
})
it("does not infer trading from catalog presence, malformed config, or unavailable provider metadata", async () => {
    m.partner.mockResolvedValue({ data: { can_access_trades: false, allowed_brokerages: [{ slug: "ETRADE", enabled: true, maintenance_mode: false, allows_trading: true }] } })
    expect(await (await GET(req())).json()).toMatchObject({ enabled: false, supportedBrokerages: [], reasonCode: "provider_trading_not_enabled" })
    m.partner.mockRejectedValue(new Error("SECRET-DO-NOT-EXPOSE"))
    expect(await (await GET(req())).json()).toEqual({ enabled: false, tradeConnectionsEnabled: false, supportedBrokerages: [], reasonCode: "trading_readiness_unavailable" })
})

it("logs only safe original-owner capabilities with generated correlation even while release is off", async () => {
    m.partner.mockResolvedValue({ data: { can_access_trades: true, clientId: "SECRET-CLIENT-ID", userSecret: "SECRET-USER-SECRET", consumerKey: "SECRET-KEY",
        allowed_brokerages: [{ slug: "ETRADE", enabled: true, maintenance_mode: false, allows_trading: true, accountId: "SECRET-ACCOUNT-ID", redirectURI: "https://secret.invalid/portal" },
            { slug: "INVALID/SECRET", enabled: true, maintenance_mode: false, allows_trading: true }] } })
    const res = await GET(new NextRequest("https://test.invalid/api/snaptrade/trading/status", { headers: { "X-Request-Id": "SECRET-CALLER-HEADER" } }))
    const requestId = res.headers.get("X-FinnaCalc-Request-Id")
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/)
    expect(m.log).toHaveBeenCalledExactlyOnceWith("[snaptrade_capability_status]", { requestId, keyNamespace: "original", tradingEnabled: true, connectionBrokerages: ["ETRADE"], tradingBrokerages: ["ETRADE"] })
    expect(JSON.stringify(m.log.mock.calls)).not.toMatch(/SECRET|original-owned-key|owner|registration-key|clientId|accountId|userSecret|consumerKey|redirectURI/)
    expect(await res.json()).toMatchObject({ enabled: false, tradeConnectionsEnabled: false })
    expect(m.rpc).not.toHaveBeenCalled()
})
it("labels next namespace safely and never emits success metadata for unauthorized or failed reads", async () => {
    m.namespace = "next"
    await GET(req())
    expect(m.log.mock.calls[0][1].keyNamespace).toBe("next")
    m.log.mockClear(); m.owner = null
    expect((await GET(req())).status).toBe(401); expect(m.log).not.toHaveBeenCalled()
    m.owner = "owner"; m.partner.mockRejectedValue(new Error("SECRET-SDK-ERROR"))
    const response = await GET(req())
    expect(await response.json()).toMatchObject({ reasonCode: "trading_readiness_unavailable" })
    expect(m.log).not.toHaveBeenCalled()
})

it("execution artifact reports included routes ready only with approved key, broker and working version3 storage", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true")
    expect(await (await GET(req())).json()).toMatchObject({ enabled: true, tradeConnectionsEnabled: true })
    m.rpc.mockResolvedValue({ data: 1, error: null })
    expect(await (await GET(req())).json()).toMatchObject({ enabled: false, reasonCode: "order_storage_unavailable" })
    m.rpc.mockResolvedValue({ data: 3, error: null })
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "false")
    expect(await (await GET(req())).json()).toMatchObject({ enabled: false, tradeConnectionsEnabled: false })
})

it("reads fixed public reference metadata only for an authenticated stored owner and isolates failures", async () => {
    m.reference.mockResolvedValue([{ symbol: "AAPL", currency: "USD", type: "cs", exchange: "NASDAQ", mic: "XNAS" }])
    const res = await GET(req())
    expect(m.reference).toHaveBeenCalledExactlyOnceWith("original-owned-key")
    expect(m.log.mock.calls[1]).toEqual(["[snaptrade_symbol_reference]", { requestId: res.headers.get("X-FinnaCalc-Request-Id"),
        keyNamespace: "original", symbols: [{ symbol: "AAPL", currency: "USD", type: "cs", exchange: "NASDAQ", mic: "XNAS" }] }])
    expect(await res.json()).not.toHaveProperty("symbols")
    m.reference.mockClear(); m.owner = null; await GET(req()); expect(m.reference).not.toHaveBeenCalled()
    m.owner = "owner"; m.session = null; await GET(req()); expect(m.reference).not.toHaveBeenCalled()
    m.session = { clientId: "original-owned-key" }; m.reference.mockRejectedValue(new Error("SECRET"))
    expect(await (await GET(req())).json()).toMatchObject({ reasonCode: "trading_not_enabled" })
})
it("readiness accepts storage V3 (shares) and V4 (with dollar columns) and nothing else", async () => {
    vi.stubEnv("SNAPTRADE_TRADING_RELEASE_APPROVED", "true")
    const manifest = { execution: true, tradeConnections: true }
    m.rpc.mockResolvedValue({ data: 4, error: null })
    expect(await integrationReadiness("original-owned-key", manifest)).toMatchObject({ enabled: true })
    m.select.mockResolvedValueOnce({ error: { message: "column amount_mode does not exist" } })
    expect(await integrationReadiness("original-owned-key", manifest)).toMatchObject({ enabled: false, reasonCode: "order_storage_unavailable" })
    m.rpc.mockResolvedValue({ data: 5, error: null })
    expect(await integrationReadiness("original-owned-key", manifest)).toMatchObject({ enabled: false, reasonCode: "order_storage_unavailable" })
})
