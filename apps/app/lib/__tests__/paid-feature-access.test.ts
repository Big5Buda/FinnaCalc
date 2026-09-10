import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ apple: vi.fn(), stripe: vi.fn() }))
vi.mock("../apple-entitlement-store", () => ({ loadActiveAppleGrants: mocks.apple }))
vi.mock("../billing-entitlements", () => ({ loadEntitlement: mocks.stripe, entitlementIsActive: (row: any) => row != null && ["active", "trialing"].includes(row.status) }))
import { paidFeatureError } from "../paid-feature-access"
beforeEach(() => {
    vi.resetAllMocks()
    mocks.apple.mockResolvedValue([])
    mocks.stripe.mockResolvedValue(null)
})
it("requires identity before reading or granting a paid entitlement", async () => {
    expect((await paidFeatureError(null, "budgeting"))?.status).toBe(401)
    expect(mocks.apple).not.toHaveBeenCalled()
    expect(mocks.stripe).not.toHaveBeenCalled()
})
it("no persisted paid plan means no access", async () => {
    expect((await paidFeatureError("user", "budgeting"))?.status).toBe(403)
})
it("verifies exact feature scope from Apple grants", async () => {
    mocks.apple.mockResolvedValue([{ tier: "trader" }])
    expect(await paidFeatureError("user", "investing")).toBeNull()
    expect((await paidFeatureError("user", "budgeting"))?.status).toBe(403)
    mocks.apple.mockResolvedValue([{ tier: "pro" }])
    expect(await paidFeatureError("user", "budgeting")).toBeNull()
})
it("keeps verified active Stripe subscriptions working if Apple storage is unavailable", async () => {
    mocks.apple.mockRejectedValue(new Error("missing Apple table"))
    mocks.stripe.mockResolvedValue({ tier: "plus", status: "active", current_period_end: new Date(Date.now() + 60_000).toISOString() })
    expect(await paidFeatureError("user", "budgeting")).toBeNull()
})
it("expired Stripe access cannot grant paid APIs", async () => {
    mocks.stripe.mockResolvedValue({ tier: "pro", status: "active", current_period_end: "2000-01-01T00:00:00Z" })
    expect((await paidFeatureError("user", "budgeting"))?.status).toBe(403)
})
it("unavailable entitlement verification fails closed", async () => {
    mocks.apple.mockRejectedValue(new Error("offline"))
    expect((await paidFeatureError("user", "budgeting"))?.status).toBe(503)
})
