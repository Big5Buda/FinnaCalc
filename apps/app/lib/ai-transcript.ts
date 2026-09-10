import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { extractSymbols, type Removal } from "./advice-guard"

/**
 * Server-side record of what the language models told each reader.
 *
 * One row per answer, in `ai_transcripts` (supabase/ai_transcripts.sql),
 * keyed to the verified Supabase user when there is one and readable only
 * with the service_role key — the same arrangement as plaid_items and
 * snaptrade_users. Before this existed nothing the model said was kept
 * anywhere, so "what did FinnaCalc tell me about NVDA on the 12th" had no
 * answer for the reader and none for anyone asking on their behalf.
 *
 * A row contains the latest question (or budget-finding text), the answer
 * shown after screening, removed text and metadata. Portfolio context embedded
 * in the latest message is stored too. The full structured budget snapshot is
 * sent to Google as model context but is not separately stored in this table;
 * questions, findings and answers may still contain budget or identifying data.
 * A null user_id means no account association, not anonymized content.
 *
 * The 30-day cleanup is installed separately using
 * supabase/ai_transcript_retention.sql. Application deployment alone does not
 * activate it; see docs/ai-transcript-retention.md for verification.
 *
 * Failure here is logged and swallowed. A record that could not be written
 * must never turn into an answer that could not be given.
 */

const TABLE = "ai_transcripts"

export type TranscriptRoute = "chat" | "budget-advisor" | "budget-fixes"
export type TranscriptSurface = "finnabot" | "portfolio_chat" | "budget_analysis"

export interface TranscriptRow {
    userId: string | null
    route: TranscriptRoute
    surface: TranscriptSurface | null
    turnCount: number
    question: string
    answer: string
    removed: Removal[]
    model: string
    finishReason?: string | null
}

let admin: SupabaseClient | null = null
let warnedUnconfigured = false

function adminClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) {
        if (!warnedUnconfigured) {
            warnedUnconfigured = true
            console.warn("[ai-transcript] SUPABASE_SERVICE_ROLE_KEY missing — AI answers are not being recorded.")
        }
        return null
    }
    if (!admin) {
        admin = createClient(url, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
    }
    return admin
}

/**
 * Write one row. Resolves when the write has settled, never rejects. Routes
 * await this before closing their stream: on a serverless host, work left
 * running after the response ends is not guaranteed to finish, and a record
 * that silently never landed would defeat the point.
 */
export async function recordTranscript(row: TranscriptRow): Promise<void> {
    const client = adminClient()
    if (!client) return
    try {
        const { error } = await client.from(TABLE).insert({
            user_id: row.userId,
            route: row.route,
            surface: row.surface,
            turn_count: row.turnCount,
            question: row.question,
            answer: row.answer,
            removed: row.removed,
            symbols: extractSymbols(`${row.question}\n${row.answer}`),
            model: row.model,
            finish_reason: row.finishReason ?? null,
        })
        if (error) {
            if (error.code === "42P01") {
                console.error(
                    "[ai-transcript] the ai_transcripts table doesn't exist yet — run supabase/ai_transcripts.sql in the Supabase SQL editor."
                )
            } else {
                console.error("[ai-transcript] insert failed:", error.message)
            }
        }
    } catch (err) {
        console.error("[ai-transcript] insert threw:", err)
    }
}

/** Forgets every answer given to this user — used when an account is deleted. */
export async function deleteAllTranscripts(appUserId: string): Promise<void> {
    const client = adminClient()
    if (!client) return
    const { error } = await client.from(TABLE).delete().eq("user_id", appUserId)
    if (error) throw new Error(error.message || "Transcript store error.")
}

/** The last thing the reader typed, or an empty string. */
export function lastUserMessage(messages: Array<{ role: string; content: string }>): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return messages[i].content
    }
    return ""
}
