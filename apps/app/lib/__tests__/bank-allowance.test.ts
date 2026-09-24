import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ grants: vi.fn() }))
vi.mock("@/lib/apple-entitlement-store", () => ({ loadActiveAppleGrants: mocks.grants }))
import { bankConnectionAllowance, INCLUDED_BANK_CONNECTIONS } from "../bank-allowance"
import { BANK_ADDON_PRODUCT_ID } from "../apple-subscriptions"

const addOn = { productId: BANK_ADDON_PRODUCT_ID, tier: "bank_addon" }
const pro = { productId: "com.finnacalc.pro.monthly", tier: "pro" }

beforeEach(() => {
    vi.resetAllMocks()
    mocks.grants.mockResolvedValue([])
})

it("includes two bank logins with no add-on", async () => {
    mocks.grants.mockResolvedValue([pro])
    expect(await bankConnectionAllowance("user")).toBe(INCLUDED_BANK_CONNECTIONS)
})
it("adds one login per active add-on", async () => {
    mocks.grants.mockResolvedValue([pro, addOn])
    expect(await bankConnectionAllowance("user")).toBe(3)
    mocks.grants.mockResolvedValue([pro, addOn, { ...addOn }])
    expect(await bankConnectionAllowance("user")).toBe(4)
})
it("ignores a tier grant wearing the add-on product id", async () => {
    mocks.grants.mockResolvedValue([{ productId: BANK_ADDON_PRODUCT_ID, tier: "pro" }])
    expect(await bankConnectionAllowance("user")).toBe(INCLUDED_BANK_CONNECTIONS)
})
it("falls back to the included logins when entitlements cannot be read", async () => {
    mocks.grants.mockRejectedValue(new Error("storage unavailable"))
    expect(await bankConnectionAllowance("user")).toBe(INCLUDED_BANK_CONNECTIONS)
})
