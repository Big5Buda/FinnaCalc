import { expect, it } from "vitest"
import { tierAllows } from "../paid-feature-access"

// The add-on buys capacity, never a feature. If this ever passes for a
// feature, an account could hold nothing but a $2 add-on and read as paid.
it("buys no paid feature", () => {
    expect(tierAllows("bank_addon", "budgeting")).toBe(false)
    expect(tierAllows("bank_addon", "investing")).toBe(false)
})
it("leaves the tiers answering exactly as before", () => {
    expect(tierAllows("plus", "budgeting")).toBe(true)
    expect(tierAllows("plus", "investing")).toBe(false)
    expect(tierAllows("trader", "investing")).toBe(true)
    expect(tierAllows("trader", "budgeting")).toBe(false)
    expect(tierAllows("pro", "budgeting")).toBe(true)
    expect(tierAllows("pro", "investing")).toBe(true)
})
