import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { SnaptradeError } from "snaptrade-typescript-sdk"
import { getSnapTrade, isSnapTradeConfigured } from "@/lib/snaptrade"
import { deleteSession, loadSession } from "@/lib/snaptrade-session"
import { deleteAllItems, loadItems } from "@/lib/plaid-items"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"
import { deleteAllTranscripts } from "@/lib/ai-transcript"
import { AppleIdentityMismatchError, revokeAppleAuthorization } from "@/lib/apple-revocation"

export const runtime = "nodejs"

// Permanently deletes the caller's Supabase account. Deletion can only be done
// with the service_role key, which must never reach the client — so the app
// hits this endpoint with its Supabase access token, and we resolve the user
// id from that token server-side (never trusting a client-supplied id).
export async function POST(req: NextRequest) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) {
        return NextResponse.json(
            { error: "Account deletion isn't configured. Add SUPABASE_SERVICE_ROLE_KEY." },
            { status: 503 }
        )
    }

    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    if (!token) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
    }

    // Admin client — server-only, no session persistence.
    const admin = createClient(url, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify the caller's token and resolve their user id. A revoked/expired
    // token yields no user, so deletion requires a genuinely-signed-in caller.
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) {
        return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 })
    }

    const payload: unknown = await req.json().catch(() => ({}))
    const body = payload && typeof payload === "object" ? payload as { appleAuthorizationCode?: unknown } : {}
    const appleIdentities = userData.user.identities?.filter((identity) => identity.provider === "apple") ?? []
    let appleRevocation: "not_required" | "revoked" | "manual_required" = "not_required"
    if (appleIdentities.length > 0 || userData.user.app_metadata?.provider === "apple") {
        appleRevocation = "manual_required"
        const code = body.appleAuthorizationCode
        if (typeof code === "string" && code.length > 0 && code.length <= 4096) {
            const subjects = appleIdentities.flatMap((identity) => {
                const subject = identity.identity_data?.sub ?? identity.id
                return typeof subject === "string" ? [subject] : []
            })
            try {
                await revokeAppleAuthorization(code, subjects)
                appleRevocation = "revoked"
            } catch (error) {
                if (error instanceof AppleIdentityMismatchError) {
                    return NextResponse.json({ error: error.message }, { status: 403 })
                }
                // TN3194 requires account deletion even when tokens cannot be
                // obtained. The client must explain how to revoke manually.
                // Never log authorization codes, token responses or secrets.
                console.warn("[/api/account/delete] Apple revocation unavailable; manual revocation required.")
            }
        }
    }

    // Require SnapTrade to accept deletion before the credentials cascade
    // away. Otherwise a failed request strands a live brokerage connection
    // with no stored identity available for retry. Vendor cleanup is queued.
    try {
        const session = await loadSession(userData.user.id)
        if (session && !isSnapTradeConfigured) {
            return NextResponse.json({ error: "Brokerage disconnection is temporarily unavailable. Your account has not been deleted. Please try again or contact support." }, { status: 503 })
        }
        if (session) {
            try {
                await getSnapTrade(session).authentication.deleteSnapTradeUser({ userId: session.userId })
            } catch (error) {
                // A prior accepted vendor deletion followed by a database or
                // bank failure must not prevent another deletion attempt.
                if (!(error instanceof SnaptradeError) || error.status !== 404) throw error
            }
            // Record vendor acceptance now. If a later bank or account delete
            // fails, retry must not submit this brokerage deletion again.
            await deleteSession(userData.user.id, session)
        }
    } catch {
        // SDK errors can include request credentials; keep logs non-sensitive.
        console.error("[/api/account/delete] Brokerage disconnection failed; account retained for retry.")
        return NextResponse.json({ error: "Couldn't disconnect your brokerage. Your account has not been deleted. Please try again or contact support." }, { status: 502 })
    }

    // Revoke live Plaid Items before their access tokens disappear. A failed
    // removal keeps the account and its credentials available for a retry;
    // deleting the rows first would strand a billable, still-authorized Item.
    try {
        const items = await loadItems(userData.user.id)
        if (items.length > 0) {
            if (!isPlaidConfigured()) {
                return NextResponse.json({ error: "Bank disconnection is temporarily unavailable. Your account has not been deleted. Please try again." }, { status: 503 })
            }
            const plaid = getPlaidClient()
            for (const item of items) {
                try {
                    await plaid.itemRemove({ access_token: item.accessToken })
                } catch (error) {
                    const code = (error as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code
                    if (code !== "ITEM_NOT_FOUND" && code !== "INVALID_ACCESS_TOKEN") throw error
                }
            }
        }
        await deleteAllItems(userData.user.id)
    } catch {
        console.error("[/api/account/delete] Bank disconnection failed; account retained for retry.")
        return NextResponse.json({ error: "Couldn't disconnect your banks. Your account has not been deleted. Please try again." }, { status: 502 })
    }

    // Forget every AI answer recorded for this user. Same reasoning as the
    // Plaid rows: they cascade with the auth user, but deleting first means a
    // failed user deletion never leaves a person's conversations behind.
    try {
        await deleteAllTranscripts(userData.user.id)
    } catch (err) {
        console.error("[/api/account/delete] transcript teardown failed:", err)
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
    if (delErr) {
        return NextResponse.json(
            { error: delErr.message || "Failed to delete account." },
            { status: 500 }
        )
    }

    return NextResponse.json({ deleted: true, appleRevocation })
}
