import { NextRequest, NextResponse } from "next/server"
import { verifiedSnapTradeWebhookClient, webhookTimestampFresh } from "@/lib/snaptrade-webhook"
import { snapTradeWebhookOwner } from "@/lib/snaptrade-session"

// SnapTrade webhook receiver. Configure the URL + enable events in the
// SnapTrade Dashboard's Webhooks tab; authenticity is verified with the
// owning consumer key (original or NEXT pair), no extra secret needed.
//
// Must return 2xx quickly or SnapTrade retries (exponential backoff, 3 tries).
// We verify the signature, drop replays, log the event, and 200. Acting on
// events (push notifications, a connection-status store) can be layered on the
// switch below without changing the transport.
export async function POST(req: NextRequest) {
    const signature = req.headers.get("signature") ?? req.headers.get("Signature")

    let payload: any
    try {
        payload = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid body." }, { status: 400 })
    }

    let signingClientId: string | null
    try {
        signingClientId = verifiedSnapTradeWebhookClient(payload, signature)
    } catch {
        return NextResponse.json({ error: "Event verification is temporarily unavailable." }, { status: 503 })
    }
    if (!signingClientId) {
        // Unauthenticated — do not act on it. 401 so a misconfiguration is visible.
        return NextResponse.json({ error: "Invalid signature." }, { status: 401 })
    }
    if (!webhookTimestampFresh(payload?.eventTimestamp)) {
        return NextResponse.json({ error: "Stale event." }, { status: 400 })
    }

    const { eventType, userId, brokerageAuthorizationId } = payload
    // Unknown users (including already-deleted users) have no state to update.
    if (typeof userId !== "string" || !userId) return NextResponse.json({ received: true })
    try {
        const ownerClientId = await snapTradeWebhookOwner(userId)
        if (!ownerClientId) return NextResponse.json({ received: true })
        if (ownerClientId !== signingClientId) {
            return NextResponse.json({ error: "Invalid event owner." }, { status: 403 })
        }
    } catch {
        return NextResponse.json({ error: "Event ownership is temporarily unavailable." }, { status: 503 })
    }
    switch (eventType) {
        case "CONNECTION_BROKEN":
        case "CONNECTION_FAILED":
            console.warn("[snaptrade webhook] connection broken", { userId, brokerageAuthorizationId })
            break
        case "CONNECTION_FIXED":
        case "CONNECTION_ADDED":
        case "CONNECTION_UPDATED":
        case "CONNECTION_DELETED":
        case "ACCOUNT_HOLDINGS_UPDATED":
        case "NEW_ACCOUNT_AVAILABLE":
        case "TRADE_DETECTION":
        case "TRADE_UPDATE":
            console.info("[snaptrade webhook]", eventType, { userId, brokerageAuthorizationId })
            break
        default:
            console.info("[snaptrade webhook] unhandled event", eventType, { userId })
    }

    return NextResponse.json({ received: true })
}
