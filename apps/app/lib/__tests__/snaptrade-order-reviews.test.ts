import { beforeEach, afterEach, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ rpc: vi.fn(), select: vi.fn(), limit: vi.fn() }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: m.rpc, from: () => ({ select: m.select }) }) }))
import { saveReview, reviewStorageReady, captureReviewGeneration, resolveAcknowledgedReview, type Review } from "../snaptrade-order-reviews"
const row = { generation: "0", owner_id: "owner-fixture", client_id: "key-fixture", vendor_user_id: "vendor-fixture", symbol_id: "listing-fixture", trade_id: null,
    terms: { accountId: "account-fixture", symbol: "AAPL", action: "BUY" as const, units: 1, orderType: "Limit" as const, timeInForce: "Day" as const, price: 10, stop: null }, impact_facts: null, expires_at: "2100-01-01T00:00:00Z" }
beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture")
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("LIVE REQUEST FORBIDDEN") }))
    m.select.mockReturnValue({ limit: m.limit }); m.limit.mockResolvedValue({ error: null })
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it("creates only through the owner-serialized RPC rather than a separate check/REST insert", async () => {
    m.rpc.mockResolvedValue({ data: { state: "reviewing" }, error: null })
    const review = await saveReview(row)
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("create_snaptrade_order_review", { p_id: review.id, p_owner: row.owner_id, p_client: row.client_id,
        p_vendor_user: row.vendor_user_id, p_generation: row.generation, p_terms: row.terms, p_impact_facts: null, p_symbol: row.symbol_id, p_trade: null, p_expires: row.expires_at })
    expect(review).toMatchObject({ ...row, state: "reviewing" })
    expect(m.select).not.toHaveBeenCalled()
})
it("preserves an acknowledged reservation denial as reconciliation-required rather than creating a new review", async () => {
    m.rpc.mockResolvedValue({ data: null, error: null })
    await expect(saveReview(row)).rejects.toMatchObject({ code: "order_review_stale", status: 409 })
    expect(m.select).not.toHaveBeenCalled()
})
it("requires version3 storage and never consumes a real review as a healthcheck", async () => {
    m.rpc.mockResolvedValue({ data: 1, error: null }); expect(await reviewStorageReady()).toBe(false)
    m.rpc.mockResolvedValue({ data: 3, error: null }); expect(await reviewStorageReady()).toBe(true)
    expect(m.limit).toHaveBeenCalledWith(0)
    expect(m.rpc.mock.calls.every(([name]) => name === "snaptrade_order_review_storage_version")).toBe(true)
})

it("captures only durable string generations, never an imprecise numeric counter", async () => {
    m.rpc.mockResolvedValue({ data: "9007199254740993", error: null })
    expect(await captureReviewGeneration(row.owner_id)).toBe("9007199254740993")
    m.rpc.mockResolvedValue({ data: 9007199254740992, error: null })
    await expect(captureReviewGeneration(row.owner_id)).rejects.toThrow("Order generation unavailable")
})
it("requires routine resolution RPC to advance exactly one durable generation", async () => {
    const review = { ...row, id: "review-fixture", state: "complete", result: { brokerageOrderId: "fixture" } } as Review
    m.rpc.mockResolvedValue({ data: "9007199254740994", error: null })
    expect(await resolveAcknowledgedReview(review, "9007199254740993", {})).toBe(true)
    m.rpc.mockResolvedValue({ data: "9007199254740993", error: null })
    expect(await resolveAcknowledgedReview(review, "9007199254740993", {})).toBe(false)
})
