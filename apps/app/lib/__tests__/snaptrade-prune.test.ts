import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({ paid: vi.fn(), rows: vi.fn(), removeVendor: vi.fn(), removeSession: vi.fn() }))
vi.mock("@/lib/paid-feature-access", () => ({ paidFeatureError: mocks.paid }))
vi.mock("@/lib/snaptrade", () => ({ isSnapTradeConfigured: true, getSnapTrade: () => ({ authentication: { deleteSnapTradeUser: mocks.removeVendor } }) }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: () => ({
    select: () => ({ lt: mocks.rows }), delete: () => ({ eq: mocks.removeSession }),
}) }) }))
import { GET } from "../../app/api/cron/prune-connections/route"
const request = () => GET(new NextRequest("https://example.test/api/cron/prune-connections", { headers: { authorization: "Bearer test-cron" } }))
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("CRON_SECRET", "test-cron")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    mocks.rows.mockResolvedValue({ data: [{ user_id: "user", st_user_id: "broker", has_investing: false }], error: null })
    mocks.paid.mockResolvedValue(Response.json({ error: "No active plan" }, { status: 403 }))
    mocks.removeVendor.mockResolvedValue({})
    mocks.removeSession.mockResolvedValue({ error: null })
})
it("keeps a paid account despite an old false device hint", async () => {
    mocks.paid.mockResolvedValue(null)
    expect((await (await request()).json()).exempt).toBe(1)
    expect(mocks.removeVendor).not.toHaveBeenCalled()
})
it("retains brokerage access during verification uncertainty", async () => {
    mocks.paid.mockResolvedValue(Response.json({ error: "Apple unavailable" }, { status: 503 }))
    expect((await (await request()).json()).errors).toEqual(["entitlement user"])
    expect(mocks.removeVendor).not.toHaveBeenCalled()
    expect(mocks.removeSession).not.toHaveBeenCalled()
})
it("requires an explicit server free result before pruning a dormant connection", async () => {
    expect((await (await request()).json()).removed).toBe(1)
    expect(mocks.paid).toHaveBeenCalledWith("user", "investing")
    expect(mocks.removeVendor).toHaveBeenCalledWith({ userId: "broker" })
    expect(mocks.removeSession).toHaveBeenCalledWith("user_id", "user")
})
it("keeps a conservative paid hint even before verification", async () => {
    mocks.rows.mockResolvedValue({ data: [{ user_id: "user", st_user_id: "broker", has_investing: true }], error: null })
    expect((await (await request()).json()).exempt).toBe(1)
    expect(mocks.removeVendor).not.toHaveBeenCalled()
})
