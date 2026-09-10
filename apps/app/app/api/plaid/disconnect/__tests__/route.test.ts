import { beforeEach, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
    configured: vi.fn(), user: vi.fn(), load: vi.fn(), remove: vi.fn(), deleteOne: vi.fn(), deleteAll: vi.fn(),
}))
vi.mock("@/lib/plaid", () => ({ isPlaidConfigured: mocks.configured, getPlaidClient: () => ({ itemRemove: mocks.remove }) }))
vi.mock("@/lib/supabase-auth", () => ({ verifiedAppUserId: mocks.user }))
vi.mock("@/lib/plaid-items", () => ({ loadItems: mocks.load, deleteItem: mocks.deleteOne, deleteAllItems: mocks.deleteAll }))
import { POST } from "../route"

const item = { itemId: "first-item", accessToken: "private-token", institution: "First bank" }
function request(body: unknown = {}) {
    return new Request("https://app.finnacalc.com/api/plaid/disconnect", {
        method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
    }) as NextRequest
}
beforeEach(() => {
    vi.resetAllMocks()
    mocks.configured.mockReturnValue(true)
    mocks.user.mockResolvedValue("account-a")
    mocks.load.mockResolvedValue([item])
    mocks.remove.mockResolvedValue({})
    mocks.deleteOne.mockResolvedValue(undefined)
    mocks.deleteAll.mockResolvedValue(undefined)
})
it("requires authentication before loading or revoking any bank", async () => {
    mocks.user.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(401)
    expect(mocks.load).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
})
it("removes vendor access before deleting that item's credential", async () => {
    const order: string[] = []
    mocks.remove.mockImplementation(async () => { order.push("vendor") })
    mocks.deleteOne.mockImplementation(async () => { order.push("credential") })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ removed: 1 })
    expect(order).toEqual(["vendor", "credential"])
    expect(mocks.deleteOne).toHaveBeenCalledWith("account-a", "first-item")
})
it("preserves a bank linked concurrently after the removal snapshot", async () => {
    const stored = new Set(["first-item"])
    mocks.remove.mockImplementation(async () => { stored.add("new-concurrent-item") })
    mocks.deleteOne.mockImplementation(async (_user, itemId) => { stored.delete(itemId) })
    mocks.deleteAll.mockImplementation(async () => { stored.clear() })
    expect((await POST(request())).status).toBe(200)
    expect(stored).toEqual(new Set(["new-concurrent-item"]))
    expect(mocks.deleteAll).not.toHaveBeenCalled()
})
it("retains the credential when the vendor cannot disconnect so the user can retry", async () => {
    mocks.remove.mockRejectedValue(new Error("temporarily unavailable"))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ removed: 0 })
    expect(mocks.deleteOne).not.toHaveBeenCalled()
    expect(mocks.deleteAll).not.toHaveBeenCalled()
})
it("treats an already revoked item as a completed explicit disconnect", async () => {
    mocks.remove.mockRejectedValue({ response: { data: { error_code: "INVALID_ACCESS_TOKEN" } } })
    expect((await POST(request({ itemId: "first-item" }))).status).toBe(200)
    expect(mocks.deleteOne).toHaveBeenCalledWith("account-a", "first-item")
})
