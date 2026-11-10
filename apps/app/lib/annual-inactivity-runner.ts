import { type InactivityPlan } from "./connection-inactivity-policy"
export interface CleanupTarget { key: string; kind: "bank" | "brokerage"; identity: Record<string, string> }
export interface CleanupClaim { receipt: string; token: string }
/** The transport/DB boundary is injectable, so tests never disconnect real accounts. */
export interface CleanupIO {
    plan(user: string): Promise<InactivityPlan>
    claim(user: string, cutoff: string): Promise<CleanupClaim | null>
    targets(user: string): Promise<CleanupTarget[]>
    canRemove(claim: CleanupClaim): Promise<boolean>
    confirmed(claim: CleanupClaim, target: CleanupTarget): Promise<boolean>
    removeVendor(user: string, target: CleanupTarget): Promise<void>
    record(claim: CleanupClaim, target: CleanupTarget): Promise<void>
    removeLocal(user: string, target: CleanupTarget): Promise<void>
    markLocal(claim: CleanupClaim, target: CleanupTarget): Promise<void>
    finish(claim: CleanupClaim, failed: boolean): Promise<void>
}
export async function runAnnualCleanup(user: string, cutoff: string, io: CleanupIO): Promise<void> {
    if (await io.plan(user) !== "annual") return
    const claim = await io.claim(user, cutoff)
    if (!claim) return
    let failed = false
    try {
        for (const target of await io.targets(user)) {
            try {
                if (!await io.confirmed(claim, target)) {
                    // Recheck activity, claim ownership AND billing immediately before each removal.
                    if (!await io.canRemove(claim) || await io.plan(user) !== "annual") break
                    await io.removeVendor(user, target)
                    // Persist vendor success BEFORE discarding the credential. The keyed journal
                    // prevents retries counting the same target twice.
                    await io.record(claim, target)
                }
                await io.removeLocal(user, target)
                await io.markLocal(claim, target)
            } catch { failed = true }
        }
    } catch { failed = true }
    finally { await io.finish(claim, failed) }
}
