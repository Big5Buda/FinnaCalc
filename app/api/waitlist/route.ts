import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Pre-launch waitlist endpoint.
 *   POST { email, referralSource? }  → inserts the signup, returns the new count
 *   GET                              → returns the current signup count
 *
 * Runs server-side with the SUPABASE_SERVICE_ROLE_KEY (never exposed to the
 * client) so it bypasses RLS on public.waitlist — the table has RLS enabled
 * with no policies (see supabase/waitlist.sql). Create the table by running
 * that file once in the Supabase SQL editor.
 */

// A syntactically-strict-enough email check. Real validity is proven at send time.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function admin(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return null
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

async function count(supabase: SupabaseClient): Promise<number> {
    const { count, error } = await supabase
        .from("waitlist")
        .select("*", { count: "exact", head: true })
    if (error) throw error
    return count ?? 0
}

export async function GET() {
    const supabase = admin()
    if (!supabase) return NextResponse.json({ count: 0 }, { status: 200 })
    try {
        return NextResponse.json({ count: await count(supabase) })
    } catch {
        return NextResponse.json({ count: 0 }, { status: 200 })
    }
}

export async function POST(req: Request) {
    const supabase = admin()
    if (!supabase) {
        return NextResponse.json(
            { ok: false, error: "Waitlist is not configured yet." },
            { status: 503 }
        )
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
    }

    const raw = (body as { email?: unknown })?.email
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : ""
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return NextResponse.json(
            { ok: false, error: "Please enter a valid email address." },
            { status: 400 }
        )
    }

    const referralRaw = (body as { referralSource?: unknown })?.referralSource
    const referralSource =
        typeof referralRaw === "string" && referralRaw.length <= 120 ? referralRaw : null

    const { error } = await supabase.from("waitlist").insert({ email, referral_source: referralSource })

    // 23505 = unique_violation → already on the list. Treat as success (idempotent).
    if (error && error.code !== "23505") {
        return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 })
    }

    const alreadyJoined = Boolean(error) // only reaches here on 23505
    try {
        return NextResponse.json({ ok: true, alreadyJoined, count: await count(supabase) })
    } catch {
        return NextResponse.json({ ok: true, alreadyJoined })
    }
}
