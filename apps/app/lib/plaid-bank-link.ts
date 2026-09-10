import { getPlaidClient } from "./plaid"
import { BankConnectionLimitError, BankConnectionOwnershipError, loadItemOwner, loadItems, MAX_BANK_CONNECTIONS, saveItem } from "./plaid-items"

/** An exchanged token creates a live, billable Item. Roll back a new Item if
 * the atomic storage admission fails, including a concurrent third login.
 */
export async function linkBankForUser(userId: string, publicToken: string, institution: string | null) {
    const existing = await loadItems(userId)
    if (existing.length >= MAX_BANK_CONNECTIONS) throw new BankConnectionLimitError()
    const client = getPlaidClient()
    const { data } = await client.itemPublicTokenExchange({ public_token: publicToken })
    try {
        await saveItem(userId, { itemId: data.item_id, accessToken: data.access_token, institution })
    } catch (error) {
        if (error instanceof BankConnectionOwnershipError) throw error
        if (!(error instanceof BankConnectionLimitError)) {
            // A lost RPC response can hide a committed save. Never revoke an
            // Item that now belongs to this user or someone else.
            let owner: string | null
            try { owner = await loadItemOwner(data.item_id) } catch {
                throw new Error("Your bank connection's status couldn't be confirmed. Please refresh Connected accounts before linking it again.")
            }
            if (owner === userId) return
            if (owner != null) throw new BankConnectionOwnershipError()
        }
        if (!existing.some((item) => item.itemId === data.item_id)) {
            try {
                await client.itemRemove({ access_token: data.access_token })
            } catch {
                // Credentials must never appear in logs or user-facing errors.
                console.error("[plaid] Newly linked bank could not be saved or disconnected.")
                throw new Error("Your bank connection couldn't be saved or disconnected. Please contact support before linking it again.")
            }
        }
        throw error
    }
}
