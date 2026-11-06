import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const OWNER = "35245322-f950-4f2a-a980-80a17bd134ab"
const OTHER = "afe2cd26-12e5-4eda-b96e-dbe0830bcecc"
const m = vi.hoisted(() => ({ user: null as string | null, apple: vi.fn(), stripe: vi.fn(), links: vi.fn(), login: vi.fn() }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => m.user }))
vi.mock("@/lib/apple-entitlement-store", () => ({ loadActiveAppleGrants: m.apple }))
vi.mock("@/lib/billing-entitlements", () => ({ loadEntitlement: m.stripe, entitlementIsActive: (row: any) => row?.status === "active" }))
vi.mock("@/lib/snaptrade", () => ({ isSnapTradeConfigured: true, clearLegacySnapTradeCookie: vi.fn(),
    getSnapTrade: () => ({ connections: { listBrokerageAuthorizations: m.links }, authentication: { loginSnapTradeUser: m.login } }) }))
vi.mock("@/lib/snaptrade-session", () => ({ resolveOrCreateSession: async () => ({ userId: "vendor-fixture", userSecret: "fixture", clientId: "key-fixture" }) }))
import { developerInvestingAccess } from "../developer-access"
import { paidFeatureError } from "../paid-feature-access"
import { POST as connect } from "../../app/api/snaptrade/connect/route"
import { brokerageReadScope } from "../snaptrade-access"
import { GET } from "../../app/api/access/developer/route"
beforeEach(() => {
    vi.resetAllMocks(); m.user = OWNER
    vi.stubEnv("FINNACALC_DEVELOPER_INVESTING_USER_IDS", OWNER)
    m.apple.mockResolvedValue([]); m.stripe.mockResolvedValue(null)
    m.links.mockResolvedValue({ data: [{ id: "first", type: "read" }] }); m.login.mockResolvedValue({ data: { redirectURI: "https://fixture.invalid/portal" } })
})
afterEach(() => vi.unstubAllEnvs())
it("authorizes only the exact verified configured UUID without billing reads or fabricated tiers", async () => {
    expect(await paidFeatureError(OWNER, "investing")).toBeNull()
    expect(m.apple).not.toHaveBeenCalled(); expect(m.stripe).not.toHaveBeenCalled()
    const res = await GET(new NextRequest("https://test.invalid/api/access/developer"))
    expect(await res.json()).toEqual({ investingDeveloperAccess: true, unlimitedBrokerageConnections: true })
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
})
it("leaves budgeting and ordinary free investing policy unchanged", async () => {
    expect((await paidFeatureError(OWNER, "budgeting"))?.status).toBe(403)
    expect((await paidFeatureError(OTHER, "investing"))?.status).toBe(403)
})
it("does not grant another verified user through a query parameter, body-like field or debug header", async () => {
    m.user = OTHER
    const req = new NextRequest(`https://test.invalid/api/access/developer?userId=${OWNER}&developer=true`, { headers: { "X-Developer": "true", "X-User-Id": OWNER } })
    expect(await (await GET(req)).json()).toEqual({ investingDeveloperAccess: false, unlimitedBrokerageConnections: false })
})
it("requires verified authentication even if the request claims the allowlisted UUID", async () => {
    m.user = null
    const res = await GET(new NextRequest(`https://test.invalid/api/access/developer?userId=${OWNER}`))
    expect(res.status).toBe(401); expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect((await paidFeatureError(null, "investing"))?.status).toBe(401)
})
it.each(["", "*", "@example.com", "developer", "35245322", "[\"" + OWNER + "\"]"])("defaults invalid or absent operator config to no grant: %s", config => {
    vi.stubEnv("FINNACALC_DEVELOPER_INVESTING_USER_IDS", config)
    expect(developerInvestingAccess(OWNER)).toBe(false)
})
it("accepts canonical UUID case/whitespace and rechecks configuration without cached cross-user state", async () => {
    vi.stubEnv("FINNACALC_DEVELOPER_INVESTING_USER_IDS", ` ${OWNER.toUpperCase()}, invalid `)
    expect(developerInvestingAccess(OWNER)).toBe(true)
    expect(developerInvestingAccess(OTHER)).toBe(false)
    expect(developerInvestingAccess("owner@example.com")).toBe(false)
    vi.stubEnv("FINNACALC_DEVELOPER_INVESTING_USER_IDS", "")
    expect(developerInvestingAccess(OWNER)).toBe(false)
    expect(await (await GET(new NextRequest("https://test.invalid/api/access/developer"))).json()).toEqual({ investingDeveloperAccess: false, unlimitedBrokerageConnections: false })
})
it("preserves verified paid access for ordinary users", async () => {
    m.stripe.mockResolvedValue({ tier: "trader", status: "active", current_period_end: "2100-01-01T00:00:00Z" })
    expect(await paidFeatureError(OTHER, "investing")).toBeNull()
})

it("permits developer additional brokerage portal and full read scope while preserving connection ownership", async () => {
    const req = (body: any) => new NextRequest("https://test.invalid/api/snaptrade/connect", { method: "POST", body: JSON.stringify(body) })
    expect((await connect(req({ platform: "ios" }))).status).toBe(200)
    expect(m.login.mock.calls[0][0].connectionType).toBe("read")
    expect((await connect(req({ reconnect: "foreign" }))).status).toBe(404)
    expect(m.login).toHaveBeenCalledOnce()
    const session = { userId: "vendor-fixture", userSecret: "fixture", clientId: "key-fixture" }
    expect(await brokerageReadScope(OWNER, session, [{ id: "first" }, { id: "second" }], true)).toEqual({ countedConnectionId: null })
})
it("does not turn client developer assertions into a second connection allowance", async () => {
    m.user = OTHER
    const res = await connect(new NextRequest("https://test.invalid/api/snaptrade/connect", { method: "POST",
        body: JSON.stringify({ developer: true, plan: "developer", userId: OWNER }), headers: { "X-Developer": "true" } }))
    expect(res.status).toBe(403); expect((await res.json()).code).toBe("brokerage_connection_limit")
    expect(m.login).not.toHaveBeenCalled()
})
