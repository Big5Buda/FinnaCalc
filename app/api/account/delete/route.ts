import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
    if (delErr) {
        return NextResponse.json(
            { error: delErr.message || "Failed to delete account." },
            { status: 500 }
        )
    }

    return NextResponse.json({ deleted: true })
}
