import { beforeEach, expect, it, vi } from "vitest"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { NextRequest } from "next/server"
import { AxiosError, AxiosHeaders } from "axios"
import { SnaptradeError } from "snaptrade-typescript-sdk"
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
    loadSession: async () => ({ userId: "broker-user", userSecret: "test-secret", clientId: "legacy-test" }),
    resolveOrCreateSession: async () => ({ userId: "broker-user", userSecret: "test-secret", clientId: "legacy-test" }),
    deleteSession: mocks.removeSession,
}))
import { brokerageLimitError } from "../snaptrade-access"
import { POST as connect } from "../../app/api/snaptrade/connect/route"
import { POST as disconnect } from "../../app/api/snaptrade/disconnect/route"
import { GET as accounts } from "../../app/api/snaptrade/accounts/route"
const session = { userId: "broker-user", userSecret: "test-secret", clientId: "legacy-test" }
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
    mocks.list.mockResolvedValue({ data: [{ id: "first", disabled: true, type: "read" }] })
    expect((await connect(request({ reconnect: "first" }))).status).toBe(200)
    expect(mocks.paid).not.toHaveBeenCalled()
    expect((await connect(request({ reconnect: "foreign" }))).status).toBe(404)
    expect(mocks.login).toHaveBeenCalledOnce()
})
it("always requests read-only access, whatever the client asks for", async () => {
    for (const body of [{}, { access: "trade" }, { access: "TRADE" }, { access: "trade-if-available" }, { connectionType: "trade" }]) {
        expect((await connect(request(body))).status).toBe(200)
    }
    mocks.list.mockResolvedValue({ data: [{ id: "first", disabled: true, type: "read" }] })
    expect((await connect(request({ reconnect: "first", access: "trade" }))).status).toBe(200)
    expect(mocks.login).toHaveBeenCalledTimes(6)
    for (const [args] of mocks.login.mock.calls) expect(args.connectionType).toBe("read")
    expect(mocks.login.mock.calls[5][0].reconnect).toBe("first")
})
it("refuses to reconnect a legacy trade or unknown-permission link", async () => {
    mocks.list.mockResolvedValue({ data: [
        { id: "trade", disabled: true, type: "trade" },
        { id: "upper", disabled: true, type: "TRADE" },
        { id: "missing", disabled: true },
        { id: "blank", disabled: true, type: "" },
        { id: "other", disabled: true, type: "trade-if-available" },
    ] })
    for (const reconnect of ["trade", "upper", "missing", "blank", "other"]) {
        const response = await connect(request({ reconnect, access: "read" }))
        expect(response.status).toBe(409)
        const body = await response.json()
        expect(body.code).toBe("connection_not_read_only")
        expect(body.error).toContain("Disconnect")
        expect(body.error).not.toMatch(/revoked/i)
    }
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.removeVendor).not.toHaveBeenCalled()
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
    const response = { status: 404, statusText: "Not Found", data: {}, headers: {}, config: { headers: new AxiosHeaders() } }
    const error = new SnaptradeError(new AxiosError("Not Found", undefined, undefined, undefined, response), {}, {})
    expect(error.status).toBe(404)
    expect(error).not.toHaveProperty("response")
    mocks.removeVendor.mockRejectedValue(error)
    expect((await disconnect(request())).status).toBe(200)
    expect(mocks.removeSession).toHaveBeenCalledWith("user", session)
})
it("ships no order placement, preview, cancellation or ticket-quote route", () => {
    const api = resolve(__dirname, "../../app/api/snaptrade")
    for (const route of ["trade/place", "trade/impact", "orders/cancel", "quote"]) {
        expect(existsSync(resolve(api, route, "route.ts"))).toBe(false)
    }
    expect(existsSync(resolve(api, "orders/route.ts"))).toBe(true)
})
