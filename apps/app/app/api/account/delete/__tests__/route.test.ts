import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(), deleteUser: vi.fn(), revoke: vi.fn(), items: vi.fn(), transcripts: vi.fn(),
    loadItems: vi.fn(), itemRemove: vi.fn(), plaidConfigured: vi.fn(),
    loadSession: vi.fn(), deleteSnapTradeUser: vi.fn(), snaptradeConfigured: true,
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
    auth: { getUser: mocks.getUser, admin: { deleteUser: mocks.deleteUser } },
}) }))
vi.mock("@/lib/snaptrade", () => ({
    get isSnapTradeConfigured() { return mocks.snaptradeConfigured },
    getSnapTrade: () => ({ authentication: { deleteSnapTradeUser: mocks.deleteSnapTradeUser } }),
}))
vi.mock("@/lib/snaptrade-session", () => ({ loadSession: mocks.loadSession }))
vi.mock("@/lib/plaid-items", () => ({ deleteAllItems: mocks.items, loadItems: mocks.loadItems }))
vi.mock("@/lib/plaid", () => ({ getPlaidClient: () => ({ itemRemove: mocks.itemRemove }), isPlaidConfigured: mocks.plaidConfigured }))
vi.mock("@/lib/ai-transcript", () => ({ deleteAllTranscripts: mocks.transcripts }))
vi.mock("@/lib/apple-revocation", async (original) => ({
    ...await original<typeof import("@/lib/apple-revocation")>(), revokeAppleAuthorization: mocks.revoke,
}))
import { POST } from "../route"
import { AppleIdentityMismatchError } from "@/lib/apple-revocation"

function request(body: unknown = {}, authenticated = true) {
    return new NextRequest("https://app.finnacalc.com/api/account/delete", {
        method: "POST", headers: {
            "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer verified-session" } : {}),
        }, body: JSON.stringify(body),
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-test-key")
    mocks.getUser.mockResolvedValue({ data: { user: {
        id: "account-being-deleted", identities: [{ provider: "apple", id: "linked-subject", identity_data: { sub: "linked-subject" } }],
    } }, error: null })
    mocks.deleteUser.mockResolvedValue({ error: null })
    mocks.revoke.mockResolvedValue(undefined)
    mocks.items.mockResolvedValue(undefined)
    mocks.loadItems.mockResolvedValue([])
    mocks.itemRemove.mockResolvedValue({})
    mocks.plaidConfigured.mockReturnValue(true)
    mocks.transcripts.mockResolvedValue(undefined)
    mocks.snaptradeConfigured = true
    mocks.loadSession.mockResolvedValue(null)
    mocks.deleteSnapTradeUser.mockResolvedValue({ data: { status: "deleted" } })
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("account deletion", () => {
    it("rejects unsigned requests before deleting any data", async () => {
        expect((await POST(request({}, false))).status).toBe(401)
        expect(mocks.deleteUser).not.toHaveBeenCalled()
        expect(mocks.items).not.toHaveBeenCalled()
    })
    it("revokes the caller's verified Apple identity before deleting their account", async () => {
        const response = await POST(request({ appleAuthorizationCode: "fresh-code" }))
        expect(await response.json()).toEqual({ deleted: true, appleRevocation: "revoked" })
        expect(mocks.revoke).toHaveBeenCalledWith("fresh-code", ["linked-subject"])
        expect(mocks.deleteUser).toHaveBeenCalledWith("account-being-deleted")
        expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0])
    })
    it("rejects another Apple account without deleting either account's data", async () => {
        mocks.revoke.mockRejectedValue(new AppleIdentityMismatchError())
        expect((await POST(request({ appleAuthorizationCode: "other-account-code" }))).status).toBe(403)
        expect(mocks.items).not.toHaveBeenCalled()
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
    it("fulfills deletion without an Apple token and reports manual revocation", async () => {
        const response = await POST(request())
        expect(await response.json()).toEqual({ deleted: true, appleRevocation: "manual_required" })
        expect(mocks.revoke).not.toHaveBeenCalled()
    })
    it("treats a null JSON body as a deletion without an Apple token", async () => {
        const response = await POST(request(null))
        expect(await response.json()).toEqual({ deleted: true, appleRevocation: "manual_required" })
    })
    it("fulfills deletion when Apple is unavailable without claiming revocation", async () => {
        mocks.revoke.mockRejectedValue(new Error("Apple unavailable"))
        const response = await POST(request({ appleAuthorizationCode: "fresh-code" }))
        expect(await response.json()).toEqual({ deleted: true, appleRevocation: "manual_required" })
        expect(mocks.deleteUser).toHaveBeenCalledOnce()
    })
    it("does not request Apple authorization for an email-only account", async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { id: "email-user", identities: [{ provider: "email" }] } }, error: null })
        const response = await POST(request())
        expect(await response.json()).toEqual({ deleted: true, appleRevocation: "not_required" })
        expect(mocks.revoke).not.toHaveBeenCalled()
    })
    it("never returns success when account removal fails", async () => {
        mocks.deleteUser.mockResolvedValue({ error: { message: "Database unavailable" } })
        const response = await POST(request())
        expect(response.status).toBe(500)
        expect(await response.json()).not.toHaveProperty("deleted", true)
    })
    it("retains brokerage credentials and the account when SnapTrade rejects deletion", async () => {
        mocks.loadSession.mockResolvedValue({ userId: "linked-brokerage", userSecret: "private-user-secret" })
        mocks.deleteSnapTradeUser.mockRejectedValue(new Error("Vendor failure with private-user-secret"))
        const response = await POST(request())
        expect(response.status).toBe(502)
        expect(mocks.deleteUser).not.toHaveBeenCalled()
        expect(mocks.items).not.toHaveBeenCalled()
        expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-user-secret")
    })
    it("retains an existing brokerage when vendor credentials are unavailable", async () => {
        mocks.snaptradeConfigured = false
        mocks.loadSession.mockResolvedValue({ userId: "linked-brokerage", userSecret: "private-user-secret" })
        expect((await POST(request())).status).toBe(503)
        expect(mocks.deleteSnapTradeUser).not.toHaveBeenCalled()
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
    it("does not discard the account when its brokerage store cannot be read", async () => {
        mocks.loadSession.mockRejectedValue(new Error("Storage unavailable"))
        expect((await POST(request())).status).toBe(502)
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
    it("requires accepted brokerage deletion before deleting the account", async () => {
        mocks.loadSession.mockResolvedValue({ userId: "linked-brokerage", userSecret: "private-user-secret" })
        expect((await POST(request())).status).toBe(200)
        expect(mocks.deleteSnapTradeUser).toHaveBeenCalledWith({ userId: "linked-brokerage" })
        expect(mocks.deleteSnapTradeUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0])
    })
    it("allows deletion to be retried after SnapTrade already removed its user", async () => {
        mocks.loadSession.mockResolvedValue({ userId: "removed-brokerage", userSecret: "private-user-secret" })
        mocks.deleteSnapTradeUser.mockRejectedValue({ response: { status: 404 } })
        expect((await POST(request())).status).toBe(200)
        expect(mocks.deleteUser).toHaveBeenCalledOnce()
    })
    it("allows an account with no brokerage to delete without SnapTrade configuration", async () => {
        mocks.snaptradeConfigured = false
        expect((await POST(request())).status).toBe(200)
        expect(mocks.deleteSnapTradeUser).not.toHaveBeenCalled()
    })
    it("removes live Plaid Items before discarding access tokens or deleting the account", async () => {
        mocks.loadItems.mockResolvedValue([{ itemId: "bank", accessToken: "bank-token" }])
        expect((await POST(request())).status).toBe(200)
        expect(mocks.itemRemove).toHaveBeenCalledWith({ access_token: "bank-token" })
        expect(mocks.itemRemove.mock.invocationCallOrder[0]).toBeLessThan(mocks.items.mock.invocationCallOrder[0])
        expect(mocks.items.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0])
    })
    it("retains bank credentials and account when Plaid removal fails, so deletion can be retried", async () => {
        mocks.loadItems.mockResolvedValue([{ itemId: "bank", accessToken: "bank-token" }])
        mocks.itemRemove.mockRejectedValue(new Error("Plaid unavailable"))
        expect((await POST(request())).status).toBe(502)
        expect(mocks.items).not.toHaveBeenCalled()
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
    it.each(["ITEM_NOT_FOUND", "INVALID_ACCESS_TOKEN"])("accepts Plaid's already-removed %s during a retry", async (code) => {
        mocks.loadItems.mockResolvedValue([{ itemId: "bank", accessToken: "old-bank-token" }])
        mocks.itemRemove.mockRejectedValue({ response: { data: { error_code: code } } })
        expect((await POST(request())).status).toBe(200)
        expect(mocks.deleteUser).toHaveBeenCalledOnce()
    })
})
