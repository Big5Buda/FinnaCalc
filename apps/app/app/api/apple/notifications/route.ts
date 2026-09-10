import { NextRequest, NextResponse } from "next/server"
import { AppleSubscriptionError } from "@/lib/apple-subscriptions"
import { verifyAppleNotification } from "@/lib/apple-notifications"
import { refreshAppleNotificationOwner } from "@/lib/apple-entitlement-store"

export const runtime = "nodejs"
export const maxDuration = 60
export async function POST(req: NextRequest) {
    let body: unknown
    try { body = await req.json() } catch {
        return NextResponse.json({ error: "Invalid notification body." }, { status: 400 })
    }
    try {
        const signedPayload = body && typeof body === "object" ? (body as { signedPayload?: unknown }).signedPayload : undefined
        const reference = await verifyAppleNotification(signedPayload)
        if (!reference) return NextResponse.json({ received: true })
        await refreshAppleNotificationOwner(reference.originalTransactionId, reference.environment)
        // Do not expose account ownership, receipts or subscription details in
        // public callback responses or logs. Apple's signed payload is the auth.
        return NextResponse.json({ received: true })
    } catch (error) {
        const invalid = error instanceof AppleSubscriptionError && error.status === 400
        // Uncertain verification/storage/status checks must be retried, rather
        // than acknowledging an entitlement update that never completed.
        return NextResponse.json({ error: invalid ? "Invalid App Store notification." : "Notification processing is temporarily unavailable." }, { status: invalid ? 400 : 503 })
    }
}
