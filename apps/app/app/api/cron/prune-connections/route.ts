import { NextRequest, NextResponse } from "next/server"
import { activityAdmin, missingActivityMigration } from "@/lib/connection-activity"
import { verifiedInactivityPlan, annualCleanupIO, repairConfirmedCleanup } from "@/lib/connection-inactivity"
import { runAnnualCleanup } from "@/lib/annual-inactivity-runner"
import { paidFeatureError } from "@/lib/paid-feature-access"
import { getSnapTrade, isSnapTradeConfigured } from "@/lib/snaptrade"
import { SnaptradeError } from "snaptrade-typescript-sdk"
import { deleteSession } from "@/lib/snaptrade-session"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Free brokerage: 45 days. Annual subscribers who acknowledged the policy:
 * 60 days for banks AND brokerages. Monthly paid connections are retained.
 * No subscription is canceled. All status comes from verified server billing;
 * client has_investing hints cannot prove eligibility for either rule.
 * Rollout flag stays OFF until migration and new consent UI are deployed.
 */
export async function GET(req: NextRequest) {
    const secret=process.env.CRON_SECRET
    if(!secret || req.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Not authorised."},{status:401})
    let db: ReturnType<typeof activityAdmin>
    try {db=activityAdmin()} catch {return NextResponse.json({error:"Not configured."},{status:503})}
    const now=Date.now(), freeCutoff=new Date(now-45*86400000).toISOString(), annualCutoff=new Date(now-60*86400000).toISOString()
    let freeRemoved=0, annualProcessed=0, errors=0, annualSkipped="disabled"
    if(process.env.FINNACALC_ANNUAL_INACTIVITY_CLEANUP_ENABLED==="true") {
        await db.rpc("settle_expired_connection_cleanup",{p_user_id:null})
        const {data,error}=await db.from("app_activity").select("user_id").eq("annual_policy_acknowledged",true).lte("last_seen_at",annualCutoff).order("cleanup_checked_at",{ascending:true,nullsFirst:true}).limit(100)
        if(error) {
            annualSkipped=missingActivityMigration(error)?"migration_required":"storage_unavailable"
            errors+=missingActivityMigration(error)?0:1
        } else {
            annualSkipped=""
            try {await repairConfirmedCleanup()} catch {errors++}
            for(const row of data??[]) {
                if(Date.now()-now>45000) break // bounded cron, leave untouched work for next day
                await db.from("app_activity").update({cleanup_checked_at:new Date().toISOString()}).eq("user_id",row.user_id)
                try {await runAnnualCleanup(row.user_id,annualCutoff,annualCleanupIO);annualProcessed++} catch {errors++}
            }
        }
    }
    if(isSnapTradeConfigured) {
        const {data,error}=await db.from("snaptrade_users").select("user_id,st_user_id,client_id,last_seen_at").lte("last_seen_at",freeCutoff).limit(100)
        if(error) return NextResponse.json({error:"Connection activity unavailable."},{status:503})
        for(const row of data??[]) {
            if(Date.now()-now>50000) break
            try {
                const plan=await verifiedInactivityPlan(row.user_id)
                // Annual accounts always wait for 60d and the new policy acknowledgment;
                // unknown billing and internal developers are retained.
                if(plan==="annual" || plan==="retain") continue
                if(plan==="monthly") {
                    const denied=await paidFeatureError(row.user_id,"investing")
                    if(!denied || denied.status!==403) continue
                }
                // Activity/new identity after selection cancels a free removal too.
                const {data:current,error}=await db.from("snaptrade_users").select("last_seen_at,st_user_id,client_id").eq("user_id",row.user_id).maybeSingle()
                if(error || !current || !current.last_seen_at || current.last_seen_at>freeCutoff || current.st_user_id!==row.st_user_id || current.client_id!==row.client_id) continue
                try {await getSnapTrade({clientId:row.client_id}).authentication.deleteSnapTradeUser({userId:row.st_user_id})}
                catch(e) {if(!(e instanceof SnaptradeError) || e.status!==404) throw e}
                await deleteSession(row.user_id,{userId:row.st_user_id,clientId:row.client_id});freeRemoved++
            } catch {errors++}
        }
    }
    return NextResponse.json({freeDormantDays:45,annualDormantDays:60,freeRemoved,annualProcessed,annualSkipped,errors})
}
