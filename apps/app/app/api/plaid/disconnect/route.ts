import { NextRequest, NextResponse } from "next/server"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"
import { deleteAllItems, deleteItem, loadItems } from "@/lib/plaid-items"
import { verifiedAppUserId } from "@/lib/supabase-auth"

/**
 * Hangs up on a linked bank, at Plaid as well as here.
 *
 * A stored access_token is a live Plaid Item, and a live Item is billed for
 * whether or not anybody reads it. Until this route existed there was no way
 * to end one: `deleteItem` forgot our copy of the token while Plaid carried on
 * counting the Item, so a user who cancelled kept costing money forever and
 * the only cure was the Plaid dashboard.
 *
 * Order matters. `/item/remove` goes first, and only a confirmed removal (or a
 * token Plaid already considers dead) lets the row go. Deleting our row first
 * and failing at Plaid would leave an Item nobody can reach: still billed,
 * with the credential to stop it thrown away.
 *
 * Idempotent by design. Plaid answers ITEM_NOT_FOUND or INVALID_ACCESS_TOKEN
 * for something already gone, and both are treated as success, because the
 * caller asked for the Item to stop existing and it does not exist. This route
 * is called on subscription lapse, and a lapse can be noticed more than once.
 *
 * Body: {} removes every item for the user, {"itemId": "..."} removes one.
 */
export const dynamic = "force-dynamic"

/** Plaid errors that mean "already gone", which is the state we wanted. */
function alreadyGone(err: any): boolean {
    const code = err?.response?.data?.error_code
    return code === "ITEM_NOT_FOUND" || code === "INVALID_ACCESS_TOKEN"
}

export async function POST(req: NextRequest) {
    if (!isPlaidConfigured()) {
        return NextResponse.json({ error: "Bank connections aren't configured." }, { status: 503 })
    }

    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to manage bank connections." }, { status: 401 })
    }

    let itemId: string | null = null
    try {
        const body = await req.json()
        itemId = typeof body?.itemId === "string" && body.itemId ? body.itemId : null
    } catch {
        // No body is the "remove everything" case, not an error.
    }

    try {
        const plaid = getPlaidClient()
        const items = await loadItems(appUserId)
        const targets = itemId ? items.filter((i) => i.itemId === itemId) : items

        // Nothing linked is a success: the caller wanted no live items and
        // there are none. Saying otherwise would make a lapse handler retry
        // forever against an account that never linked a bank.
        if (targets.length === 0) {
            return NextResponse.json({ removed: 0, remaining: items.length })
        }

        let removed = 0
        const failures: string[] = []
        for (const item of targets) {
            try {
                await plaid.itemRemove({ access_token: item.accessToken })
            } catch (err: any) {
                if (!alreadyGone(err)) {
                    // Keep the row. Its token is the only way to stop the
                    // billing, so losing it would strand a live Item.
                    failures.push(item.institution || item.itemId)
                    continue
                }
            }
            await deleteItem(appUserId, item.itemId)
            removed += 1
        }

        // Belt and braces on the remove-everything path: if Plaid took all of
        // them, make sure no orphan row survives a partial delete.
        if (!itemId && failures.length === 0) {
            await deleteAllItems(appUserId)
        }

        if (failures.length > 0) {
            return NextResponse.json(
                {
                    removed,
                    error: `Couldn't disconnect ${failures.join(", ")}. Nothing was deleted for those, so you can try again.`,
                },
                { status: 502 }
            )
        }
        return NextResponse.json({ removed })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Couldn't disconnect the bank." },
            { status: 500 }
        )
    }
}
