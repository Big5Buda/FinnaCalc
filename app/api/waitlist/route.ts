import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { Resend } from "resend"

/**
 * Pre-launch waitlist endpoint.
 *   POST { email, referralSource? }  → inserts the signup, sends a confirmation
 *                                       email (best-effort), returns the count
 *   GET                              → returns the current signup count
 *
 * Runs server-side with the SUPABASE_SERVICE_ROLE_KEY (never exposed to the
 * client) so it bypasses RLS on public.waitlist — the table has RLS enabled
 * with no policies (see supabase/waitlist.sql). Create the table by running
 * that file once in the Supabase SQL editor.
 *
 * Confirmation email is sent via Resend only when RESEND_API_KEY and
 * WAITLIST_FROM_EMAIL are set (and the from-domain is verified in Resend).
 * When unset, signups still succeed — the email is simply skipped.
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

/**
 * Best-effort waitlist confirmation email. Never throws — a mail failure must
 * not fail the signup. No-ops when Resend isn't configured yet.
 */
async function sendConfirmation(email: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY
    const fromEnv = process.env.WAITLIST_FROM_EMAIL // "FinnaCalc <finnacalc@felipejmiranda.com>" or bare address
    if (!apiKey || !fromEnv) return
    // Guarantee a "FinnaCalc" display name. Without one, mail clients fall back to
    // the address local-part and show a lowercase "finnacalc" as the sender.
    const from = fromEnv.includes("<") ? fromEnv : `FinnaCalc <${fromEnv}>`
    try {
        const resend = new Resend(apiKey)
        await resend.emails.send({
            from,
            to: email,
            subject: "You're on the FinnaCalc waitlist 🎉",
            html: CONFIRMATION_HTML,
            text: CONFIRMATION_TEXT,
        })
    } catch {
        // swallow — signup already succeeded
    }
}

const CONFIRMATION_HTML = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
      <tr><td style="padding:32px;">
        <p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Finna<span style="color:#2563eb;">Calc</span></p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;letter-spacing:-0.02em;">You're on the list. 🎉</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
          Thanks for joining the FinnaCalc waitlist. You'll be among the first to know the moment we launch on the App Store.
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
          FinnaCalc puts budgeting, investing, and taxes in one app — with an AI that actually helps you make money decisions.
        </p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#64748b;">
          No spam — just one email when we go live.
        </p>
      </td></tr>
    </table>
    <p style="max-width:480px;margin:16px auto 0;text-align:center;font-size:12px;color:#94a3b8;">© 2026 FinnaCalc</p>
  </body>
</html>`

const CONFIRMATION_TEXT = `You're on the list.

Thanks for joining the FinnaCalc waitlist. You'll be among the first to know the moment we launch on the App Store.

FinnaCalc puts budgeting, investing, and taxes in one app — with an AI that actually helps you make money decisions.

No spam — just one email when we go live.

© 2026 FinnaCalc`

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
    // Send the confirmation only for a genuinely new signup, so re-submitting
    // the same address never re-sends.
    if (!alreadyJoined) {
        await sendConfirmation(email)
    }

    try {
        return NextResponse.json({ ok: true, alreadyJoined, count: await count(supabase) })
    } catch {
        return NextResponse.json({ ok: true, alreadyJoined })
    }
}
