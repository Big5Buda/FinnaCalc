import { beforeEach, describe, expect, it, vi } from "vitest"
import { Environment, Status, Type } from "@apple/app-store-server-library"
const mocks = vi.hoisted(() => ({ decode: vi.fn(), renewal: vi.fn(), status: vi.fn() }))
vi.mock("@apple/app-store-server-library", async (original) => ({
    ...await original<typeof import("@apple/app-store-server-library")>(),
    SignedDataVerifier: class {
        constructor(_roots: unknown, _online: boolean, private environment: string) {}
        verifyAndDecodeTransaction(signed: string) { return mocks.decode(signed, this.environment) }
        verifyAndDecodeRenewalInfo(signed: string) { return mocks.renewal(signed, this.environment) }
    },
    AppStoreServerAPIClient: class { getAllSubscriptionStatuses(id: string) { return mocks.status(id) } },
}))
import { APPLE_BUNDLE_ID, grantForVerifiedTransaction, verifySubmittedTransactions } from "../apple-subscriptions"

const base = () => ({
    bundleId: APPLE_BUNDLE_ID, productId: "com.finnacalc.plus.monthly",
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION, transactionId: "current", originalTransactionId: "original",
    environment: Environment.PRODUCTION, expiresDate: Date.now() + 60_000,
    appAccountToken: "00000000-0000-4000-8000-000000000001",
})
const statuses = (status: Status, renewal = false) => ({
    bundleId: APPLE_BUNDLE_ID, environment: Environment.PRODUCTION,
    data: [{ lastTransactions: [{ status, originalTransactionId: "original", signedTransactionInfo: "latest", ...(renewal ? { signedRenewalInfo: "renewal" } : {}) }] }],
})
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("APP_STORE_APPLE_ID", "6787539598")
    vi.stubEnv("APP_STORE_ISSUER_ID", "test-issuer")
    vi.stubEnv("APP_STORE_KEY_ID", "test-key")
    vi.stubEnv("APP_STORE_PRIVATE_KEY", "test-fixture-key")
    vi.stubEnv("APP_STORE_ALLOW_SANDBOX", "false")
    mocks.decode.mockResolvedValue(base())
    mocks.status.mockResolvedValue(statuses(Status.ACTIVE))
})

describe("verified Apple subscription validity", () => {
    it("accepts only exact FinnaCalc product IDs and keeps Apple-signed ownership token", () => {
        expect(grantForVerifiedTransaction(base())).toMatchObject({ tier: "plus", appAccountToken: base().appAccountToken })
        for (const change of [
            { productId: "com.finnacalc.pro.fake" }, { bundleId: "another.app" },
            { expiresDate: Date.now() - 1 }, { expiresDate: undefined },
            { revocationDate: Date.now() }, { isUpgraded: true },
            { type: Type.CONSUMABLE }, { environment: Environment.XCODE },
            { transactionId: undefined }, { originalTransactionId: undefined },
        ]) expect(grantForVerifiedTransaction({ ...base(), ...change })).toBeNull()
    })
    it("uses live latest transaction rather than replayed pre-upgrade proof", async () => {
        mocks.decode.mockImplementation(async (signed) => signed === "latest" ? { ...base(), productId: "com.finnacalc.pro.annual" } : base())
        expect(await verifySubmittedTransactions(["old-proof"])).toMatchObject([{ tier: "pro" }])
        expect(mocks.status).toHaveBeenCalledWith("original")
        expect(mocks.decode).toHaveBeenCalledWith("latest", Environment.PRODUCTION)
    })
    it.each([Status.REVOKED, Status.EXPIRED, Status.BILLING_RETRY])("does not grant from a valid old proof when live status is %s", async (status) => {
        mocks.status.mockResolvedValue(statuses(status))
        expect(await verifySubmittedTransactions(["old-proof"])).toEqual([])
    })
    it("fails closed when live Apple status cannot be read", async () => {
        mocks.status.mockRejectedValue(new Error("offline"))
        await expect(verifySubmittedTransactions(["valid-proof"])).rejects.toMatchObject({ status: 503 })
    })
    it("rejects forged signatures before consulting purchase history", async () => {
        mocks.decode.mockRejectedValue(new Error("invalid signature"))
        await expect(verifySubmittedTransactions(["forged"])).rejects.toMatchObject({ status: 400 })
        expect(mocks.status).not.toHaveBeenCalled()
        expect(mocks.decode).toHaveBeenCalledTimes(1)
    })
    it("never attempts Sandbox unless server explicitly enables it", async () => {
        mocks.decode.mockImplementation(async (_signed, environment) => {
            if (environment !== Environment.SANDBOX) throw new Error("wrong environment")
            return { ...base(), environment: Environment.SANDBOX }
        })
        await expect(verifySubmittedTransactions(["sandbox-proof"])).rejects.toMatchObject({ status: 400 })
        vi.stubEnv("APP_STORE_ALLOW_SANDBOX", "true")
        mocks.status.mockResolvedValue({ ...statuses(Status.ACTIVE), environment: Environment.SANDBOX })
        expect(await verifySubmittedTransactions(["sandbox-proof"])).toMatchObject([{ environment: Environment.SANDBOX }])
    })
    it("honors grace only when Apple status and signed renewal expiry both permit it", async () => {
        mocks.decode.mockResolvedValue({ ...base(), expiresDate: Date.now() - 1000 })
        mocks.status.mockResolvedValue(statuses(Status.BILLING_GRACE_PERIOD, true))
        mocks.renewal.mockResolvedValue({ originalTransactionId: "original", gracePeriodExpiresDate: Date.now() + 60_000 })
        expect(await verifySubmittedTransactions(["proof"])).toHaveLength(1)
        mocks.renewal.mockResolvedValue({ originalTransactionId: "different", gracePeriodExpiresDate: Date.now() + 60_000 })
        expect(await verifySubmittedTransactions(["proof"])).toEqual([])
    })
    it("accepts empty current entitlement list without Apple configuration", async () => {
        vi.stubEnv("APP_STORE_PRIVATE_KEY", "")
        expect(await verifySubmittedTransactions([])).toEqual([])
        await expect(verifySubmittedTransactions(["proof"])).rejects.toMatchObject({ status: 503 })
    })
    it("rejects oversized proof batches", async () => {
        await expect(verifySubmittedTransactions(Array(11).fill("proof"))).rejects.toMatchObject({ status: 400 })
    })
})
