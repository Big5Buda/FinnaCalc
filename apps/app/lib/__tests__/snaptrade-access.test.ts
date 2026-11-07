import { beforeEach, expect, it, vi } from "vitest"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { NextRequest } from "next/server"
import { AxiosError, AxiosHeaders } from "axios"
import { SnaptradeError } from "snaptrade-typescript-sdk"
const mocks = vi.hoisted(() => ({ list: vi.fn(), paid: vi.fn(), login: vi.fn(), removeVendor: vi.fn(), removeSession: vi.fn(), holdings: vi.fn(), accounts: vi.fn(), balance: vi.fn(), refresh: vi.fn() }))
vi.mock("@/lib/snaptrade", () => ({
    isSnapTradeConfigured: true, clearLegacySnapTradeCookie: vi.fn(),
    snapTradeErrorMessage: (_error: unknown, fallback: string) => fallback,
    getSnapTrade: () => ({ connections: { listBrokerageAuthorizations: mocks.list, refreshBrokerageAuthorization: mocks.refresh },
        authentication: { loginSnapTradeUser: mocks.login, deleteSnapTradeUser: mocks.removeVendor },
        accountInformation: { listUserAccounts: mocks.accounts, getAllAccountPositions: mocks.holdings, getUserAccountBalance: mocks.balance } }),
}))
vi.mock("@/lib/paid-feature-access", () => ({ paidFeatureError: mocks.paid }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "user" }))
vi.mock("@/lib/snaptrade-session", () => ({
    loadSession: async () => ({ userId: "broker-user", userSecret: "test-secret", clientId: "legacy-test" }),
    resolveOrCreateSession: async () => ({ userId: "broker-user", userSecret: "test-secret", clientId: "legacy-test" }),
    deleteSession: mocks.removeSession,
}))
import { brokerageLimitError, brokerageReadScope, countedConnectionId } from "../snaptrade-access"
import { POST as connect } from "../../app/api/snaptrade/connect/route"
import { POST as disconnect } from "../../app/api/snaptrade/disconnect/route"
import { GET as accounts } from "../../app/api/snaptrade/accounts/route"
import { POST as refresh } from "../../app/api/snaptrade/refresh/route"
const counted = "https://example.test/api/snaptrade/accounts?scope=counted"
const refreshCounted = () => refresh(new NextRequest("https://example.test/api/snaptrade/refresh?scope=counted", { method: "POST" }))
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
it("defaults to read and never silently grants a trade request without explicit consent", async () => {
    expect((await connect(request({}))).status).toBe(200)
    expect((await connect(request({ connectionType: "trade" }))).status).toBe(200)
    for (const body of [{ access: "trade" }, { access: "trade", broker: "BROKER" }])
        expect((await connect(request(body))).status).toBe(400)
    for (const access of ["TRADE", "trade-if-available", "unexpected"])
        expect((await connect(request({ access }))).status).toBe(400)
    expect(mocks.login).toHaveBeenCalledTimes(2)
    for (const [args] of mocks.login.mock.calls) expect(args.connectionType).toBe("read")
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
        expect(body.error).toContain("Manage connections")
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
it("over the free limit, reads only the first connection made and never the extra one", async () => {
    // Listed newest first on purpose: the counted one is chosen by created_date.
    mocks.list.mockResolvedValue({ data: [
        { id: "second", created_date: "2026-08-21T00:00:00Z" },
        { id: "first", created_date: "2026-08-15T00:00:00Z" },
    ] })
    mocks.accounts.mockResolvedValue({ data: [
        { id: "acct-first", brokerage_authorization: "first", balance: { total: { amount: 100, currency: "USD" } } },
        { id: "acct-second", brokerage_authorization: "second", balance: { total: { amount: 900, currency: "USD" } } },
        { id: "acct-unattributed", balance: { total: { amount: 50, currency: "USD" } } },
    ] })
    mocks.holdings.mockResolvedValue({ data: { results: [] } })
    mocks.balance.mockResolvedValue({ data: [] })
    const response = await accounts(new NextRequest(counted))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.limitedToConnection).toBe("first")
    expect(body.accounts.map((a: any) => a.id)).toEqual(["acct-first"])
    expect(body.totalValue).toBe(100)
    // No holding or balance is even requested for the extra or unattributed accounts.
    expect(mocks.holdings.mock.calls.map(([args]) => args.accountId)).toEqual(["acct-first"])
    expect(mocks.balance.mock.calls.map(([args]) => args.accountId)).toEqual(["acct-first"])
})
it("a paid plan reads every connection and reports no limit", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first" }, { id: "second" }] })
    mocks.paid.mockResolvedValue(null)
    mocks.accounts.mockResolvedValue({ data: [
        { id: "a1", brokerage_authorization: "first" }, { id: "a2", brokerage_authorization: "second" },
    ] })
    mocks.holdings.mockResolvedValue({ data: { results: [] } })
    mocks.balance.mockResolvedValue({ data: [] })
    const body = await (await accounts(new NextRequest("https://example.test/api/snaptrade/accounts"))).json()
    expect(body.accounts).toHaveLength(2)
    expect(body.limitedToConnection).toBeUndefined()
})
it("counts the first connection made, disabled or not, and never guesses an unknowable order", () => {
    expect(countedConnectionId([{ id: "b", created_date: "2026-08-21" }, { id: "a", created_date: "2026-08-15" }])).toBe("a")
    expect(countedConnectionId([{ id: "late" , created_date: "2026-09-01" }, { id: "old-disabled", created_date: "2026-07-01" }])).toBe("old-disabled")
    expect(countedConnectionId([{ id: "z" }, { id: "y" }])).toBeNull()
    expect(countedConnectionId([{ id: "dated", created_date: "2026-08-01" }, { id: "undated" }])).toBeNull()
    expect(countedConnectionId([{ id: "a", created_date: "not a date" }, { id: "b", created_date: "2026-08-01" }])).toBeNull()
    expect(countedConnectionId([{ id: "a", created_date: "2026-08-01T00:00:00Z" }, { id: "b", created_date: "2026-08-01T00:00:00Z" }])).toBeNull()
    expect(countedConnectionId([])).toBeNull()
})
it("without the opt-in, an over-limit read is still refused and reads nothing", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first", created_date: "2026-08-15" }, { id: "second", created_date: "2026-08-21" }] })
    const response = await accounts(new NextRequest("https://example.test/api/snaptrade/accounts"))
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe("brokerage_connection_limit")
    expect(mocks.accounts).not.toHaveBeenCalled()
    expect(mocks.holdings).not.toHaveBeenCalled()
})
it("with the opt-in but no knowable first connection, the read is refused and reads nothing", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first" }, { id: "second", created_date: "2026-08-21" }] })
    const response = await accounts(new NextRequest(counted))
    expect(response.status).toBe(403)
    expect(mocks.accounts).not.toHaveBeenCalled()
})
it("refresh over the limit syncs only the counted connection, and never a disabled one", async () => {
    mocks.refresh.mockResolvedValue({})
    mocks.list.mockResolvedValue({ data: [
        { id: "first", created_date: "2026-08-15" }, { id: "second", created_date: "2026-08-21" },
    ] })
    let body = await (await refreshCounted()).json()
    expect(body).toEqual({ refreshed: 1, total: 1 })
    expect(mocks.refresh.mock.calls.map(([a]) => a.authorizationId)).toEqual(["first"])

    mocks.refresh.mockClear()
    mocks.list.mockResolvedValue({ data: [
        { id: "first", created_date: "2026-08-15", disabled: true }, { id: "second", created_date: "2026-08-21" },
    ] })
    body = await (await refreshCounted()).json()
    expect(body).toEqual({ refreshed: 0, total: 0 })
    expect(mocks.refresh).not.toHaveBeenCalled()
})
it("refresh without the opt-in, or with an entitlement outage, is refused before any sync", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "first", created_date: "2026-08-15" }, { id: "second", created_date: "2026-08-21" }] })
    expect((await refresh(new NextRequest("https://example.test/api/snaptrade/refresh", { method: "POST" }))).status).toBe(403)
    mocks.paid.mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 }))
    expect((await refreshCounted()).status).toBe(503)
    expect(mocks.refresh).not.toHaveBeenCalled()
})
it("refresh accepts the opt-in as a JSON body, the way the iOS app sends it", async () => {
    mocks.refresh.mockResolvedValue({})
    mocks.list.mockResolvedValue({ data: [{ id: "first", created_date: "2026-08-15" }, { id: "second", created_date: "2026-08-21" }] })
    const response = await refresh(new NextRequest("https://example.test/api/snaptrade/refresh",
        { method: "POST", body: JSON.stringify({ scope: "counted" }) }))
    expect(await response.json()).toEqual({ refreshed: 1, total: 1 })
})
it("refresh on a paid plan syncs every active connection", async () => {
    mocks.paid.mockResolvedValue(null)
    mocks.refresh.mockResolvedValue({})
    mocks.list.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }, { id: "c", disabled: true }] })
    expect(await (await refreshCounted()).json()).toEqual({ refreshed: 2, total: 2 })
})
it("an entitlement outage still fails closed for reads", async () => {
    mocks.paid.mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 }))
    const scope = await brokerageReadScope("user", session,
        [{ id: "a", created_date: "2026-08-01" }, { id: "b", created_date: "2026-08-02" }], true)
    expect("denied" in scope && scope.denied.status).toBe(503)
})
it("one connection needs no entitlement lookup to read", async () => {
    expect(await brokerageReadScope("user", session, [{ id: "only" }])).toEqual({ countedConnectionId: null })
    expect(mocks.paid).not.toHaveBeenCalled()
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
it("keeps cancellation absent while trading restoration is separately gated", () => {
    const api = resolve(__dirname, "../../app/api/snaptrade")
    for (const route of ["orders/cancel"]) {
        expect(existsSync(resolve(api, route, "route.ts"))).toBe(false)
    }
    expect(existsSync(resolve(api, "orders/route.ts"))).toBe(true)
})
