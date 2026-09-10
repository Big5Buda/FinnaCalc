import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({ list: vi.fn(), paid: vi.fn(), login: vi.fn(), removeVendor: vi.fn(), removeSession: vi.fn(), holdings: vi.fn(), accounts: vi.fn() }))
vi.mock("@/lib/snaptrade", () => ({
    isSnapTradeConfigured: true, clearLegacySnapTradeCookie: vi.fn(),
    snapTradeErrorMessage: (_error: unknown, fallback: string) => fallback,
    getSnapTrade: () => ({ connections: { listBrokerageAuthorizations: mocks.list },
        authentication: { loginSnapTradeUser: mocks.login, deleteSnapTradeUser: mocks.removeVendor },
        accountInformation: { listUserAccounts: mocks.accounts, getUserHoldings: mocks.holdings } }),
}))
vi.mock("@/lib/paid-feature-access", () => ({ paidFeatureError: mocks.paid }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "user" }))
vi.mock("@/lib/snaptrade-session", () => ({
    loadSession: async () => ({ userId: "broker-user", userSecret: "test-secret" }),
    resolveOrCreateSession: async () => ({ userId: "broker-user", userSecret: "test-secret" }),
    deleteSession: mocks.removeSession,
}))
import { brokerageLimitError } from "../snaptrade-access"
import { POST as connect } from "../../app/api/snaptrade/connect/route"
import { POST as disconnect } from "../../app/api/snaptrade/disconnect/route"
import { GET as accounts } from "../../app/api/snaptrade/accounts/route"
const session = { userId: "broker-user", userSecret: "test-secret" }
const request = (body = {}) => new NextRequest("https://example.test/api/snaptrade/connect", { method: "POST", body: JSON.stringify(body) })
beforeEach(() => {
    vi.resetAllMocks()
    mocks.list.mockResolvedValue({ data: [] })
    mocks.paid.mockImplementation(async () => Response.json({ error: "No investing plan" }, { status: 403 }))
    mocks.login.mockResolvedValue({ data: { redirectURI: "https://example.test/portal" } })
    mocks.removeVendor.mockResolvedValue({})
    mocks.removeSession.mockResolvedValue(undefined)
})
it("permits the first free connection without looking up paid entitlements", async () => {
    expect((await connect(request())).status).toBe(200)
    expect(mocks.paid).not.toHaveBeenCalled()
    expect(mocks.login.mock.calls[0][0].immediateRedirect).toBe(true)
})
it("rejects a second free portal before issuing its URL", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first" }] })
    expect((await connect(request())).status).toBe(403)
    expect(mocks.login).not.toHaveBeenCalled()
})
it("allows owned reconnects and rejects a forged reconnect bypass", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first", disabled: true }] })
    expect((await connect(request({ reconnect: "first" }))).status).toBe(200)
    expect(mocks.paid).not.toHaveBeenCalled()
    expect((await connect(request({ reconnect: "foreign" }))).status).toBe(404)
    expect(mocks.login).toHaveBeenCalledOnce()
})
it("allows paid additional connections", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first" }] })
    mocks.paid.mockResolvedValue(null)
    expect((await connect(request())).status).toBe(200)
})
it("rechecks portal races before returning aggregate account data", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first" }, { id: "second" }] })
    const response = await accounts(new NextRequest("https://example.test/api/snaptrade/accounts"))
    expect(response.status).toBe(403)
    expect((await response.json()).error).toContain("Disconnect extra")
    expect(mocks.accounts).not.toHaveBeenCalled()
    expect(mocks.holdings).not.toHaveBeenCalled()
})
it("does not turn an entitlement outage into paid extra access", async () => {
    mocks.paid.mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 }))
    expect((await brokerageLimitError("user", session, [{ id: "a" }, { id: "b" }]))?.status).toBe(503)
})
it("a failed vendor disconnect preserves the credential needed to retry", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.removeVendor.mockRejectedValue(new Error("Vendor unavailable"))
    expect((await disconnect(request())).status).toBe(500)
    expect(mocks.removeSession).not.toHaveBeenCalled()
    logger.mockRestore()
})
it("a retry can clear the session after vendor deletion already succeeded", async () => {
    mocks.removeVendor.mockRejectedValue({ response: { status: 404 } })
    expect((await disconnect(request())).status).toBe(200)
    expect(mocks.removeSession).toHaveBeenCalledWith("user")
})
