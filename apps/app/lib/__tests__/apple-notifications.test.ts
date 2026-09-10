import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { Environment, NotificationTypeV2, Status, Type, VerificationException, VerificationStatus } from "@apple/app-store-server-library"
const mocks = vi.hoisted(() => ({ notification: vi.fn(), transaction: vi.fn(), status: vi.fn(), owner: vi.fn(), rows: vi.fn(), rpc: vi.fn() }))
vi.mock("@apple/app-store-server-library", async (original) => ({
    ...await original<typeof import("@apple/app-store-server-library")>(),
    SignedDataVerifier: class {
        constructor(_roots: unknown, _online: boolean, private environment: string) {}
        verifyAndDecodeNotification(payload: string) { return mocks.notification(payload, this.environment) }
        verifyAndDecodeTransaction(payload: string) { return mocks.transaction(payload, this.environment) }
    },
    AppStoreServerAPIClient: class { getAllSubscriptionStatuses(id: string) { return mocks.status(id) } },
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
    from: () => { const query = { select: () => query, eq: () => query, maybeSingle: mocks.owner,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.rows()).then(resolve) }; return query },
    rpc: mocks.rpc,
}) }))
import { POST } from "../../app/api/apple/notifications/route"
const ownerID = "00000000-0000-4000-8000-000000000001"
const bundleId = "com.finnacalc.FinnaCalcIOS"
const notification = () => ({ notificationType: NotificationTypeV2.DID_RENEW, notificationUUID: "old-event", signedDate: 1,
    data: { environment: Environment.PRODUCTION, appAppleId: 6787539598, bundleId, signedTransactionInfo: "event-transaction", status: Status.ACTIVE } })
const transaction = () => ({ originalTransactionId: "original", transactionId: "latest", productId: "com.finnacalc.plus.monthly",
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION, bundleId, environment: Environment.PRODUCTION,
    expiresDate: Date.now() + 3600_000, appAccountToken: ownerID })
const stored = () => ({ user_id: ownerID, active: true, verified_at: new Date().toISOString(), original_transaction_id: "original",
    transaction_id: "old", product_id: "com.finnacalc.plus.monthly", tier: "plus", expires_at: "2099-01-01", environment: Environment.PRODUCTION, app_account_token: ownerID })
const status = (current = Status.ACTIVE) => ({ bundleId, environment: Environment.PRODUCTION,
    data: [{ lastTransactions: [{ originalTransactionId: "original", status: current, signedTransactionInfo: "current-transaction" }] }] })
const request = (body: unknown = { signedPayload: "signed-event" }) => POST(new NextRequest("https://finnacalc.com/api/apple/notifications", { method: "POST", body: JSON.stringify(body) }))
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("APP_STORE_APPLE_ID", "6787539598")
    vi.stubEnv("APP_STORE_ISSUER_ID", "fixture-issuer")
    vi.stubEnv("APP_STORE_KEY_ID", "fixture-key")
    vi.stubEnv("APP_STORE_PRIVATE_KEY", "fixture-not-a-private-key")
    vi.stubEnv("APP_STORE_ALLOW_SANDBOX", "false")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-role")
    mocks.notification.mockResolvedValue(notification())
    mocks.transaction.mockResolvedValue(transaction())
    mocks.status.mockResolvedValue(status())
    mocks.owner.mockResolvedValue({ data: { user_id: ownerID }, error: null })
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.rpc.mockResolvedValue({ error: null })
})
it.each([{}, null, { signedPayload: 1 }, { signedPayload: "" }, { signedPayload: "x".repeat(100_001) }])("rejects malformed input before Apple or storage calls", async (body) => {
    expect((await request(body)).status).toBe(400)
    expect(mocks.notification).not.toHaveBeenCalled()
    expect(mocks.owner).not.toHaveBeenCalled()
})
it("rejects a malformed JSON body", async () => {
    const response = await POST(new NextRequest("https://example.test/api/apple/notifications", { method: "POST", body: "{" }))
    expect(response.status).toBe(400)
})
it("rejects a forged notification signature before ownership lookup", async () => {
    mocks.notification.mockRejectedValue(new VerificationException(VerificationStatus.VERIFICATION_FAILURE))
    expect((await request()).status).toBe(400)
    expect(mocks.owner).not.toHaveBeenCalled()
})
it.each([{ bundleId: "foreign.app" }, { appAppleId: 123 }, { environment: Environment.XCODE }])("rejects wrong-app/environment notification metadata %j", async (change) => {
    mocks.notification.mockResolvedValue({ ...notification(), data: { ...notification().data, ...change } })
    expect((await request()).status).toBe(400)
    expect(mocks.owner).not.toHaveBeenCalled()
})
it("verifies the nested transaction independently", async () => {
    mocks.transaction.mockRejectedValue(new VerificationException(VerificationStatus.INVALID_APP_IDENTIFIER))
    expect((await request()).status).toBe(400)
    expect(mocks.owner).not.toHaveBeenCalled()
})
it("ignores verified unknown/test events without changing access", async () => {
    for (const notificationType of [NotificationTypeV2.TEST, "FUTURE_UNKNOWN_EVENT"]) {
        mocks.notification.mockResolvedValue({ ...notification(), notificationType })
        expect((await request()).status).toBe(200)
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.owner).not.toHaveBeenCalled()
})
it("never claims an unbound purchase from its signed appAccountToken", async () => {
    mocks.owner.mockResolvedValue({ data: null, error: null })
    expect((await request()).status).toBe(200)
    expect(mocks.status).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
})
it("refreshes only the database owner, ignoring a foreign caller-supplied user ID", async () => {
    const response = await request({ signedPayload: "signed-event", userId: "another-account", tier: "pro" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(mocks.rpc.mock.calls[0][1].p_user_id).toBe(ownerID)
    expect(mocks.rpc.mock.calls[0][1].p_grants[0].tier).toBe("plus")
    expect(mocks.transaction).toHaveBeenCalledWith("event-transaction", Environment.PRODUCTION)
    expect(mocks.transaction).toHaveBeenCalledWith("current-transaction", Environment.PRODUCTION)
})
it("replayed old renewal events cannot reactivate a currently revoked subscription", async () => {
    mocks.status.mockResolvedValue(status(Status.REVOKED))
    await request()
    await request()
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    for (const call of mocks.rpc.mock.calls) expect(call[1].p_grants).toEqual([])
})
it("an old refund event cannot remove a currently active renewal", async () => {
    mocks.notification.mockResolvedValue({ ...notification(), notificationType: NotificationTypeV2.REFUND,
        data: { ...notification().data, status: Status.REVOKED } })
    expect((await request()).status).toBe(200)
    expect(mocks.rpc.mock.calls[0][1].p_grants).toHaveLength(1)
})
it("returns503 without writing when live Apple status is unavailable", async () => {
    mocks.status.mockRejectedValue(new Error("Apple unavailable"))
    expect((await request()).status).toBe(503)
    expect(mocks.rpc).not.toHaveBeenCalled()
})
it("returns retryable503 for certificate-status verification outages", async () => {
    mocks.notification.mockRejectedValue(new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE))
    expect((await request()).status).toBe(503)
    expect(mocks.owner).not.toHaveBeenCalled()
})
it("accepts Sandbox only when explicitly enabled, using its own namespace", async () => {
    mocks.notification.mockImplementation(async (_payload, environment) => {
        if (environment !== Environment.SANDBOX) throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT)
        return { ...notification(), data: { ...notification().data, environment: Environment.SANDBOX } }
    })
    expect((await request()).status).toBe(400)
    vi.stubEnv("APP_STORE_ALLOW_SANDBOX", "true")
    mocks.transaction.mockResolvedValue({ ...transaction(), environment: Environment.SANDBOX })
    mocks.owner.mockResolvedValue({ data: null, error: null })
    expect((await request()).status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledWith("event-transaction", Environment.SANDBOX)
    expect(mocks.rpc).not.toHaveBeenCalled()
})
