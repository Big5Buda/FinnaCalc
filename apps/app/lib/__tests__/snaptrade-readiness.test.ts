import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ owner: "owner" as string | null, session: { clientId: "original-owned-key" } as any,
    partner: vi.fn(), rpc: vi.fn(), select: vi.fn(), owners: [] as string[] }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => m.owner }))
vi.mock("@/lib/snaptrade-session", () => ({ loadSession: async () => m.session }))
vi.mock("@/lib/snaptrade", () => ({ activeSnapTradeClientId: () => "registration-key",
    getSnapTrade: ({ clientId }: any) => { m.owners.push(clientId); return { referenceData: { getPartnerInfo: m.partner } } } }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: m.rpc,
    from: () => ({ select: () => ({ limit: m.select }) }) }) }))
import { GET } from "../../app/api/snaptrade/trading/status/route"
import { integrationReadiness } from "../snaptrade-readiness"
const req = () => new NextRequest("https://test.invalid/api/snaptrade/trading/status")
const caps = { ETRADE: { orderTypes: ["Market", "Limit"], timeInForce: ["Day"], fractional: false, preview: true, exchanges: ["XNAS"] } }
beforeEach(() => {
    vi.resetAllMocks(); m.owner = "owner"; m.session = { clientId: "original-owned-key" }; m.owners = []
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
    m.rpc.mockResolvedValue({ data: 1, error: null }); m.select.mockResolvedValue({ error: null })
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
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
    const body = await (await GET(req())).json()
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
