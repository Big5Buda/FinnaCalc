import { NextResponse } from "next/server"
import { Resend } from "resend"

/**
 * In-app feedback endpoint.
 *   POST { message, rating?, email?, userId?, appVersion?, source? }
 *     → emails the feedback to the app owner via Resend, returns { ok: true }
 *
 * Mirrors app/api/waitlist/route.ts: uses RESEND_API_KEY + WAITLIST_FROM_EMAIL
 * (the verified sending domain). Returns 503 when those aren't configured so
 * the iOS client can surface a clear message instead of silently dropping
 * feedback. Unauthenticated on purpose — feedback works signed out, matching
 * the waitlist precedent; the reply-to address is whatever the user typed.
 */

// Where feedback lands. The owner's inbox.
const FEEDBACK_TO = "fm0291601@gmail.com"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Best-effort per-IP throttle. The route is unauthenticated, so this caps a
// trivial flood from exhausting the shared Resend quota (which the waitlist
// email also depends on). In-memory, so it's per-serverless-instance rather
// than global — a real deterrent would need a shared store, but this blunts the
// obvious abuse without new infrastructure.
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 5
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
    const now = Date.now()
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
    if (recent.length >= RATE_MAX) {
        hits.set(ip, recent)
        return true
    }
    recent.push(now)
    hits.set(ip, recent)
    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 5000) {
        for (const [key, times] of hits) {
            if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key)
        }
    }
    return false
}

function clientIp(req: Request): string {
    const fwd = req.headers.get("x-forwarded-for") ?? ""
    return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

function str(v: unknown, max: number): string {
    return typeof v === "string" ? v.trim().slice(0, max) : ""
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

export async function POST(req: Request) {
    const apiKey = process.env.RESEND_API_KEY
    const fromEnv = process.env.WAITLIST_FROM_EMAIL
    if (!apiKey || !fromEnv) {
        return NextResponse.json(
            { ok: false, error: "Feedback isn't configured yet." },
            { status: 503 }
        )
    }

    if (rateLimited(clientIp(req))) {
        return NextResponse.json(
            { ok: false, error: "You're sending feedback too quickly. Try again in a few minutes." },
            { status: 429 }
        )
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
    }

    const b = body as Record<string, unknown>
    const message = str(b?.message, 5000)
    if (!message) {
        return NextResponse.json(
            { ok: false, error: "Please include a message." },
            { status: 400 }
        )
    }

    // Optional, all sanitized/bounded.
    const ratingRaw = b?.rating
    const rating =
        typeof ratingRaw === "number" && ratingRaw >= 1 && ratingRaw <= 5
            ? Math.round(ratingRaw)
            : null
    const replyEmailRaw = str(b?.email, 254).toLowerCase()
    const replyEmail = EMAIL_RE.test(replyEmailRaw) ? replyEmailRaw : ""
    const userId = str(b?.userId, 128)
    const appVersion = str(b?.appVersion, 64)
    const source = str(b?.source, 32) || "unknown"

    // Guarantee a "FinnaCalc" display name (same reasoning as the waitlist route).
    const from = fromEnv.includes("<") ? fromEnv : `FinnaCalc <${fromEnv}>`

    const ratingLine = rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)` : "No rating"
    const subject = `FinnaCalc feedback${rating ? ` · ${rating}★` : ""} · ${source}`

    const metaRows: Array<[string, string]> = [
        ["Rating", ratingLine],
        ["From", replyEmail || "(not provided)"],
        ["User ID", userId || "(signed out / none)"],
        ["App version", appVersion || "(unknown)"],
        ["Source", source],
    ]

    const text =
        `New FinnaCalc feedback\n\n` +
        metaRows.map(([k, v]) => `${k}: ${v}`).join("\n") +
        `\n\nMessage:\n${message}\n`

    const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 16px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Finna<span style="color:#2563eb;">Calc</span> feedback</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;margin:0 0 20px;">
          ${metaRows
              .map(
                  ([k, v]) =>
                      `<tr><td style="padding:4px 0;color:#64748b;width:110px;">${escapeHtml(k)}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(v)}</td></tr>`
              )
              .join("")}
        </table>
        <div style="font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;border-top:1px solid #e2e8f0;padding-top:16px;">${escapeHtml(message)}</div>
      </td></tr>
    </table>
  </body>
</html>`

    try {
        const resend = new Resend(apiKey)
        const { error } = await resend.emails.send({
            from,
            to: FEEDBACK_TO,
            subject,
            html,
            text,
            // Let the owner reply straight to the user when they left an address.
            ...(replyEmail ? { replyTo: replyEmail } : {}),
        })
        if (error) {
            console.error("[/api/feedback] resend error", error)
            return NextResponse.json({ ok: false, error: "Couldn't send feedback." }, { status: 500 })
        }
    } catch (err) {
        console.error("[/api/feedback] send failed", err)
        return NextResponse.json({ ok: false, error: "Couldn't send feedback." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
