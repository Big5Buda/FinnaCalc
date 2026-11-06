import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import { TradingError, type Terms, type ImpactFacts } from "./snaptrade-trading"
export type Review = { id: string; owner_id: string; client_id: string; vendor_user_id: string; terms: Terms;
    generation: string; impact_facts: ImpactFacts | null; symbol_id: string; trade_id: string | null; expires_at: string; state: "reviewing" | "submitting" | "complete" | "unknown" | "invalidated" | "resolved"; result: any }
function db() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Order review storage unavailable")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
export async function reviewStorageReady(): Promise<boolean> {
    const { data, error } = await db().rpc("snaptrade_order_review_storage_version")
    if (error || data !== 3) return false
    const { error: tableError } = await db().from("snaptrade_order_reviews").select("id,impact_facts,generation").limit(0)
    const { error: ownerError } = await db().from("snaptrade_order_review_owners").select("owner_id,generation").limit(0)
    return !tableError && !ownerError
}
export async function saveReview(row: Omit<Review, "id" | "state" | "result">): Promise<Review> {
    const review = { ...row, id: randomUUID(), state: "reviewing" as const, result: null }
    const { data, error } = await db().rpc("create_snaptrade_order_review", {
        p_id: review.id, p_owner: row.owner_id, p_client: row.client_id, p_vendor_user: row.vendor_user_id,
        p_generation: row.generation, p_terms: row.terms, p_impact_facts: row.impact_facts, p_symbol: row.symbol_id,
        p_trade: row.trade_id, p_expires: row.expires_at,
    })
    if (error) throw new Error("Order review storage unavailable")
    if (!data) throw new TradingError("order_review_stale", "Trading state changed while this review was prepared. Check order history and review again.", 409)

    return review
}
export async function loadReview(id: string, owner: string): Promise<Review | null> {
    const { data, error } = await db().from("snaptrade_order_reviews").select("*").eq("id", id).eq("owner_id", owner).maybeSingle()
    if (error) throw new Error("Order review storage unavailable")
    return data
}
export async function consumeReview(id: string, owner: string, client: string, vendorUser: string): Promise<boolean> {
    const { data, error } = await db().rpc("consume_snaptrade_order_review", { review_id: id, owner: owner, client, vendor_user: vendorUser })
    if (error) throw new Error("Order review storage unavailable")
    return data === true
}
export async function finishReview(id: string, owner: string, result: any, unknown: boolean) {
    const { error } = await db().from("snaptrade_order_reviews").update({ state: unknown ? "unknown" : "complete", result })
        .eq("id", id).eq("owner_id", owner).eq("state", "submitting")
    if (error) throw new Error("Order status persistence unavailable")
}

export async function captureReviewGeneration(owner: string): Promise<string> {
    const { data, error } = await db().rpc("snaptrade_review_generation", { p_owner: owner })
    if (error || typeof data !== "string" || !/^\d+$/.test(data)) throw new Error("Order generation unavailable")
    return data
}
export async function ownerReservation(owner: string): Promise<Review | null> {
    const { data, error } = await db().from("snaptrade_order_reviews").select("*").eq("owner_id", owner).in("state", ["submitting", "unknown", "complete"]).limit(2)
    if (error || !Array.isArray(data)) throw new Error("Order reservation unavailable")
    if (data?.length > 1) throw new TradingError("order_status_unknown", "Earlier submissions need reconciliation. Check order history.", 409)
    return data?.[0] ?? null
}
export async function resolveAcknowledgedReview(review: Review, generation: string, evidence: Record<string, unknown>): Promise<boolean> {
    const { data, error } = await db().rpc("resolve_acknowledged_snaptrade_review", {
        p_id: review.id, p_owner: review.owner_id, p_client: review.client_id, p_vendor_user: review.vendor_user_id,
        p_generation: generation, p_expected_result: review.result, p_expected_terms: review.terms,
        p_expected_symbol: review.symbol_id, p_evidence: evidence,
    })
    if (error) throw new Error("Order reconciliation storage unavailable")
    return typeof data === "string" && /^\d+$/.test(data) && BigInt(data) === BigInt(generation) + BigInt(1)
}
