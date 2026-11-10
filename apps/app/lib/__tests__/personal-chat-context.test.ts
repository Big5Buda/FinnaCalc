import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ access: vi.fn() }))
vi.mock("../paid-feature-access", () => ({ paidFeatureError: mocks.access }))
import { personalChatContext } from "../personal-chat-context"
beforeEach(() => { vi.resetAllMocks() })
it("does not send free-user supplied snapshots to the model", async () => {
    mocks.access.mockResolvedValue(new Response("no", { status: 403 }))
    const result = await personalChatContext({ requested: ["budgeting", "investing"], budget: "SECRET_BUDGET", portfolio: "SECRET_HOLDINGS" }, "free")
    expect(result).not.toBeInstanceOf(Response)
    expect(result).not.toContain("SECRET_")
    expect(result).toContain("Budgeting Plus")
    expect(result).toContain("Investing Plus")
})
it("checks feature permissions separately and includes only the allowed data", async () => {
    mocks.access.mockImplementation(async (_: string, feature: string) => feature === "investing" ? null : new Response("no", { status: 403 }))
    const result = await personalChatContext({ requested: ["budgeting", "investing"], budget: "SECRET_BUDGET", portfolio: "ALLOWED_HOLDINGS" }, "trader")
    expect(result).not.toContain("SECRET_BUDGET")
    expect(result).toContain("ALLOWED_HOLDINGS")
    expect(mocks.access).toHaveBeenCalledWith("trader", "budgeting")
    expect(mocks.access).toHaveBeenCalledWith("trader", "investing")
})
it("requires authorization even when the client omits a supplied domain from requested", async () => {
    mocks.access.mockResolvedValue(new Response("no", { status: 401 }))
    const result = await personalChatContext({ requested: [], budget: "SECRET_BUDGET" }, null)
    expect(result).not.toContain("SECRET_BUDGET")
    expect(mocks.access).toHaveBeenCalledWith(null, "budgeting")
})
it("does not mistake unavailable verification for a free account", async () => {
    mocks.access.mockResolvedValue(new Response("offline", { status: 503 }))
    const result = await personalChatContext({ requested: ["budgeting"], budget: "SECRET" }, "paid")
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(503)
})
it("tells subscribed users about missing data rather than asking them to upgrade", async () => {
    mocks.access.mockResolvedValue(null)
    expect(await personalChatContext({ requested: ["budgeting"] }, "paid")).toContain("Do not tell them to upgrade")
})
it("rejects oversized context and client-supplied plan claims", async () => {
    const oversized = await personalChatContext({ requested: ["budgeting"], budget: "x".repeat(12_001) }, "paid")
    expect((oversized as Response).status).toBe(400)
    const forged = await personalChatContext({ requested: ["investing"], plan: "pro" }, "free")
    expect((forged as Response).status).toBe(400)
    expect(mocks.access).not.toHaveBeenCalled()
})
