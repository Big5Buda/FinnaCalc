import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { Environment } from "@apple/app-store-server-library"
const mocks = vi.hoisted(() => ({ owner: vi.fn(), rpc: vi.fn(), rows: vi.fn(), current: vi.fn(), submitted: vi.fn() }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
    from: () => { const query = { select: () => query, eq: () => query, maybeSingle: mocks.owner, then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.rows()).then(resolve) }; return query },
    rpc: mocks.rpc,
}) }))
vi.mock("../apple-subscriptions", async (original) => ({ ...await original<typeof import("../apple-subscriptions")>(), currentAppleGrant: mocks.current, verifySubmittedTransactions: mocks.submitted }))
import { saveAppleGrants, synchronizeAppleGrants, loadActiveAppleGrants, synchronizeAppleAccount } from "../apple-entitlement-store"
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: async () => "00000000-0000-4000-8000-000000000001" }))
import { POST as syncEndpoint } from "../../app/api/subscriptions/apple/sync/route"
const user = "00000000-0000-4000-8000-000000000001"
const grant = { productId: "com.finnacalc.plus.monthly", tier: "plus" as const, originalTransactionId: "original", transactionId: "latest", expiresAt: "2099-01-01T00:00:00Z", environment: Environment.PRODUCTION as const }
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    mocks.owner.mockResolvedValue({ data: null, error: null })
    mocks.rpc.mockResolvedValue({ error: null })
    mocks.rows.mockReturnValue({ data: [], error: null })
    mocks.current.mockResolvedValue(grant)
})
it("rejects another Finna account's signed appAccountToken", async () => {
    await expect(saveAppleGrants(user, [{ ...grant, appAccountToken: "someone-else" }], true)).rejects.toMatchObject({ status: 409 })
    expect(mocks.rpc).not.toHaveBeenCalled()
})
it("requires explicit claim for legacy proof with no owner token", async () => {
    await expect(saveAppleGrants(user, [grant], false)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Confirm linking") })
    expect(mocks.rpc).not.toHaveBeenCalled()
    await saveAppleGrants(user, [grant], true)
    expect(mocks.rpc).toHaveBeenCalledOnce()
})
it("never reassigns already-linked legacy purchase, even with claim consent", async () => {
    mocks.owner.mockResolvedValue({ data: { user_id: "another-account" }, error: null })
    await expect(saveAppleGrants(user, [grant], true)).rejects.toMatchObject({ status: 409 })
    expect(mocks.rpc).not.toHaveBeenCalled()
})
it("handles concurrent ownership conflicts from the database transaction", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "purchase_owned_by_another_account" } })
    await expect(saveAppleGrants(user, [{ ...grant, appAccountToken: user }], false)).rejects.toMatchObject({ status: 409 })
})
it("empty database sync cannot deactivate an unchecked purchase", async () => {
    await saveAppleGrants(user, [], false)
    expect(mocks.rpc).toHaveBeenCalledWith("sync_apple_subscription_entitlements", { p_user_id: user, p_checked: [], p_grants: [] })
})

const stored = (active = true) => ({ user_id: user, active, verified_at: "2000-01-01T00:00:00Z", original_transaction_id: grant.originalTransactionId, transaction_id: grant.transactionId, product_id: grant.productId, tier: grant.tier, expires_at: grant.expiresAt, environment: grant.environment, app_account_token: null })
it("empty device proofs preserve account-bound access verified with Apple", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.owner.mockResolvedValue({ data: { user_id: user }, error: null })
    expect(await synchronizeAppleGrants(user, [], false)).toEqual([grant])
    expect(mocks.current).toHaveBeenCalledWith(grant.originalTransactionId, grant.environment)
    expect(mocks.rpc.mock.calls[0][1].p_grants).toHaveLength(1)
})
it("empty proofs recheck an inactive binding that renewed", async () => {
    mocks.rows.mockReturnValue({ data: [stored(false)], error: null })
    mocks.owner.mockResolvedValue({ data: { user_id: user }, error: null })
    expect(await synchronizeAppleGrants(user, [], false)).toEqual([grant])
})
it("only Apple-confirmed expiration deactivates an existing binding", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.current.mockResolvedValue(null)
    expect(await synchronizeAppleGrants(user, [], false)).toEqual([])
    expect(mocks.rpc.mock.calls[0][1]).toEqual({ p_user_id: user, p_grants: [], p_checked: [{ environment: grant.environment, original_transaction_id: grant.originalTransactionId }] })
})
it("Apple failure preserves prior database state", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.current.mockRejectedValue(new Error("Apple unavailable"))
    await expect(synchronizeAppleGrants(user, [], false)).rejects.toThrow("Apple unavailable")
    expect(mocks.rpc).not.toHaveBeenCalled()
})
it("a free account with no bindings needs no Apple API request", async () => {
    expect(await synchronizeAppleGrants(user, [], false)).toEqual([])
    expect(mocks.current).not.toHaveBeenCalled()
})
it("paid API lookup also rechecks previously inactive bindings", async () => {
    mocks.rows.mockReturnValue({ data: [stored(false)], error: null })
    mocks.owner.mockResolvedValue({ data: { user_id: user }, error: null })
    expect(await loadActiveAppleGrants(user)).toEqual([grant])
})

const foreign = { ...grant, originalTransactionId: "foreign-original", transactionId: "foreign-latest", appAccountToken: "00000000-0000-4000-8000-000000000002" }
const syncRequest = () => syncEndpoint(new NextRequest("https://example.test/api/subscriptions/apple/sync", { method: "POST", body: JSON.stringify({ transactions: ["signed-fixture"], claimLegacyPurchases: true }) }))
it("keeps A's live subscription when this device presents B's signed purchase", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.owner.mockResolvedValue({ data: { user_id: user }, error: null })
    const result = await synchronizeAppleAccount(user, [foreign], true)
    expect(result).toMatchObject({ grants: [grant], purchaseError: { code: "purchase_owned_by_another_account" } })
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.rpc.mock.calls[0][1].p_grants.map((g: any) => g.original_transaction_id)).toEqual(["original"])
})
it("never grants B's purchase when A owns no active subscription", async () => {
    await expect(synchronizeAppleAccount(user, [foreign], true)).rejects.toMatchObject({ status: 409 })
    expect(mocks.rpc.mock.calls.flatMap((call) => call[1].p_grants)).toEqual([])
})
it("does not preserve A's access if Apple confirms A expired", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.current.mockResolvedValue(null)
    await expect(synchronizeAppleAccount(user, [foreign], true)).rejects.toMatchObject({ status: 409 })
    expect(mocks.rpc.mock.calls.flatMap((call) => call[1].p_grants)).toEqual([])
})
it("does not fall back to unverified cached access when Apple's lookup fails", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.current.mockRejectedValue(new Error("Apple unavailable"))
    await expect(synchronizeAppleAccount(user, [foreign], true)).rejects.toThrow("Apple unavailable")
    expect(mocks.rpc).not.toHaveBeenCalled()
})
it("returns active A plus explicit purchaseError without claiming B through the endpoint", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.owner.mockResolvedValue({ data: { user_id: user }, error: null })
    mocks.submitted.mockResolvedValue([foreign])
    const response = await syncRequest()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ active: true, tier: "plus", purchaseError: { code: "purchase_owned_by_another_account" } })
})
it("returns conflict409 through the endpoint when A has no subscription of its own", async () => {
    mocks.submitted.mockResolvedValue([foreign])
    const response = await syncRequest()
    expect(response.status).toBe(409)
    const result = await response.json()
    expect(result.code).toBe("purchase_owned_by_another_account")
    expect(result).not.toHaveProperty("active")
})

it("does not transfer B's database-bound legacy purchase even with explicit claim", async () => {
    mocks.rows.mockReturnValue({ data: [stored()], error: null })
    mocks.owner.mockResolvedValueOnce({ data: { user_id: "another-account" }, error: null })
        .mockResolvedValue({ data: { user_id: user }, error: null })
    const { appAccountToken: _token, ...legacyForeign } = foreign
    const result = await synchronizeAppleAccount(user, [legacyForeign], true)
    expect(result).toMatchObject({ grants: [grant], purchaseError: { code: "purchase_owned_by_another_account" } })
    expect(mocks.rpc.mock.calls.flatMap((call) => call[1].p_grants).map((g: any) => g.original_transaction_id)).toEqual(["original"])
})
