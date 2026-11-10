import { createHash } from "node:crypto"
import { activityAdmin } from "./connection-activity"
import { loadActiveAppleGrants } from "./apple-entitlement-store"
import { loadEntitlement, entitlementIsActive } from "./billing-entitlements"
import { developerAIAccess, developerInvestingAccess } from "./developer-access"
import { inactivityPlan, type InactivityGrant } from "./connection-inactivity-policy"
import { type CleanupIO, type CleanupTarget, type CleanupClaim } from "./annual-inactivity-runner"
import { loadItems } from "./plaid-items"
import { loadSession, deleteSession } from "./snaptrade-session"
import { getPlaidClient, isPlaidConfigured } from "./plaid"
import { getSnapTrade, isSnapTradeConfigured } from "./snaptrade"
import { SnaptradeError } from "snaptrade-typescript-sdk"

export async function verifiedInactivityPlan(user: string) {
    const developer = developerAIAccess(user) || developerInvestingAccess(user)
    if (developer) return "retain" as const
    const [apple, stripe] = await Promise.allSettled([loadActiveAppleGrants(user), loadEntitlement(user)])
    if (apple.status !== "fulfilled" || stripe.status !== "fulfilled") return "retain" as const
    const grants: InactivityGrant[] = apple.value.map(g => ({tier: g.tier,
        interval: /\.(plus|trader|pro)\.annual$/.test(g.productId) ? "annual" : /\.(plus|trader|pro)\.monthly$/.test(g.productId) ? "monthly" : null}))
    if (stripe.value && entitlementIsActive(stripe.value)) {
        const end = Date.parse(stripe.value.current_period_end ?? "")
        if (!Number.isFinite(end)) return "retain" as const
        if (end > Date.now()) grants.push({tier: stripe.value.tier, interval: stripe.value.billing_interval})
    }
    return inactivityPlan(grants, true, false)
}
const admin = () => activityAdmin()
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const {data,error} = await admin().rpc(name,args)
    if(error) throw new Error("Cleanup storage unavailable")
    return data as T
}
function args(c: CleanupClaim) {return {p_receipt_id:c.receipt,p_claim_token:c.token}}
export const annualCleanupIO: CleanupIO = {
    plan: verifiedInactivityPlan,
    async claim(user, cutoff) {
        const rows = await rpc<{receipt_id:string;claim_token:string}[]>("claim_inactive_connection_cleanup", {p_user_id:user,p_cutoff:cutoff,p_lease_seconds:300})
        return rows[0] ? {receipt:rows[0].receipt_id,token:rows[0].claim_token} : null
    },
    async targets(user) {
        const [banks, session] = await Promise.all([loadItems(user),loadSession(user)])
        const targets: CleanupTarget[] = banks.map(item=>({key:"bank:"+item.itemId,kind:"bank",identity:{itemId:item.itemId,institution:item.institution??"",tokenHash:createHash("sha256").update(item.accessToken).digest("hex")}}))
        if(session) targets.push({key:"brokerage:"+session.clientId+":"+session.userId,kind:"brokerage",identity:{clientId:session.clientId,userId:session.userId}})
        return targets
    },
    canRemove: c=>rpc<boolean>("inactive_cleanup_can_remove",args(c)),
    async confirmed(c,t) {
        const {data,error} = await admin().from("connection_cleanup_removals").select("target_key").eq("receipt_id",c.receipt).eq("target_key",t.key).maybeSingle()
        if(error) throw error
        return data!=null
    },
    async removeVendor(user,t) {
        if(t.kind==="bank") {
            if(!isPlaidConfigured()) throw new Error("Bank provider unavailable")
            const item=(await loadItems(user)).find(x=>x.itemId===t.identity.itemId)
            if(!item || createHash("sha256").update(item.accessToken).digest("hex")!==t.identity.tokenHash) throw new Error("Connection changed") // do not claim a vendor removal
            try {await getPlaidClient().itemRemove({access_token:item.accessToken})}
            catch(e:any) {if(!["ITEM_NOT_FOUND","INVALID_ACCESS_TOKEN"].includes(e?.response?.data?.error_code)) throw new Error("Bank removal unavailable")}
        } else {
            if(!isSnapTradeConfigured) throw new Error("Brokerage provider unavailable")
            const current=await loadSession(user)
            if(!current || current.userId!==t.identity.userId || current.clientId!==t.identity.clientId) throw new Error("Connection changed")
            try {await getSnapTrade(current).authentication.deleteSnapTradeUser({userId:current.userId})}
            catch(e) {if(!(e instanceof SnaptradeError) || e.status!==404) throw new Error("Brokerage removal unavailable")}
        }
    },
    async record(c,t) {
        if(!await rpc<boolean>("record_inactive_connection_removal",{...args(c),p_kind:t.kind,p_target_key:t.key,p_identity:t.identity})) throw new Error("Cleanup lease changed")
    },
    async removeLocal(user,t) {
        if(t.kind==="bank") {
            await rpc("remove_cleaned_bank_item",{p_user_id:user,p_item_id:t.identity.itemId,p_token_hash:t.identity.tokenHash})
        } else await deleteSession(user,{clientId:t.identity.clientId,userId:t.identity.userId})
    },
    async markLocal(c,t) {await rpc("finish_inactive_connection_local",{...args(c),p_target_key:t.key})},
    async finish(c,failed) {await rpc("finish_inactive_connection_cleanup",{...args(c),p_failed:failed,p_error_code:failed?"removal_retry_required":null})},
}
/** Finish only local bookkeeping of ALREADY confirmed vendor removals, even if
 * the owner returned meanwhile. Never performs another vendor mutation. */
export async function repairConfirmedCleanup(user?: string): Promise<void> {
    let query=admin().from("connection_cleanup_removals").select("receipt_id,target_key,kind,identity,user_id").eq("local_deleted",false).limit(100)
    if(user) query=query.eq("user_id",user)
    const {data,error}=await query
    if(error) throw new Error("Cleanup storage unavailable")
    for(const row of data??[]) {
        try {
            await annualCleanupIO.removeLocal(row.user_id,{key:row.target_key,kind:row.kind,identity:row.identity})
            const {error}=await admin().from("connection_cleanup_removals").update({local_deleted:true}).eq("receipt_id",row.receipt_id).eq("target_key",row.target_key)
            if(error) throw error
        } catch { /* retain journal and retry next cron; no secrets in logs */ }
    }
}
