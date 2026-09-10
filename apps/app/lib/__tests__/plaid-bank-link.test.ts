import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ load: vi.fn(), owner: vi.fn(), save: vi.fn(), exchange: vi.fn(), remove: vi.fn() }))
vi.mock("@/lib/plaid", () => ({ getPlaidClient: () => ({ itemPublicTokenExchange: mocks.exchange, itemRemove: mocks.remove }) }))
vi.mock("@/lib/plaid-items", async (original) => ({
    ...await original<typeof import("@/lib/plaid-items")>(), loadItems: mocks.load, loadItemOwner: mocks.owner, saveItem: mocks.save,
}))
import { linkBankForUser } from "../plaid-bank-link"
import { BankConnectionLimitError, BankConnectionOwnershipError } from "../plaid-items"

beforeEach(() => {
    vi.resetAllMocks()
    mocks.load.mockResolvedValue([{ itemId: "first-bank", accessToken: "existing-token" }])
    mocks.exchange.mockResolvedValue({ data: { item_id: "new-bank", access_token: "new-token" } })
    mocks.save.mockResolvedValue(undefined)
    mocks.owner.mockResolvedValue(null)
    mocks.remove.mockResolvedValue({})
})
afterEach(() => vi.restoreAllMocks())

it("blocks the third login before creating a billable Plaid Item", async () => {
    mocks.load.mockResolvedValue([{ itemId: "first" }, { itemId: "second" }])
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toBeInstanceOf(BankConnectionLimitError)
    expect(mocks.exchange).not.toHaveBeenCalled()
})
it("admits the second login using the atomic database guard", async () => {
    await linkBankForUser("user", "public-token", "Bank")
    expect(mocks.save).toHaveBeenCalledWith("user", { itemId: "new-bank", accessToken: "new-token", institution: "Bank" })
    expect(mocks.remove).not.toHaveBeenCalled()
})
it("revokes a newly exchanged Item when concurrent linking reaches the database cap", async () => {
    mocks.save.mockRejectedValue(new BankConnectionLimitError())
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toBeInstanceOf(BankConnectionLimitError)
    expect(mocks.remove).toHaveBeenCalledWith({ access_token: "new-token" })
})
it("revokes a new Item when database persistence fails", async () => {
    mocks.save.mockRejectedValue(new Error("Storage unavailable"))
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toThrow("Storage unavailable")
    expect(mocks.remove).toHaveBeenCalledOnce()
})
it("does not revoke an existing saved Item if an update fails", async () => {
    mocks.exchange.mockResolvedValue({ data: { item_id: "first-bank", access_token: "existing-token" } })
    mocks.save.mockRejectedValue(new Error("Storage unavailable"))
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toThrow("Storage unavailable")
    expect(mocks.remove).not.toHaveBeenCalled()
})
it("reports failed cleanup instead of claiming the unsaved Item was disconnected", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.save.mockRejectedValue(new Error("Storage unavailable"))
    mocks.remove.mockRejectedValue(new Error("Plaid unavailable"))
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toThrow("contact support")
    expect(log.mock.calls.flat().join(" ")).not.toContain("new-token")
})
it("never revokes another account's Item on a database ownership conflict", async () => {
    mocks.save.mockRejectedValue(new BankConnectionOwnershipError())
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toBeInstanceOf(BankConnectionOwnershipError)
    expect(mocks.remove).not.toHaveBeenCalled()
})
it("preserves a committed Item when only the save response was lost", async () => {
    mocks.save.mockRejectedValue(new Error("Response lost"))
    mocks.owner.mockResolvedValue("user")
    await linkBankForUser("user", "public-token", "Bank")
    expect(mocks.remove).not.toHaveBeenCalled()
})
it("does not revoke while save status is still unknown", async () => {
    mocks.save.mockRejectedValue(new Error("Response lost"))
    mocks.owner.mockRejectedValue(new Error("Database unavailable"))
    await expect(linkBankForUser("user", "public-token", "Bank")).rejects.toThrow("couldn't be confirmed")
    expect(mocks.remove).not.toHaveBeenCalled()
})
