import { verifiedAppUserId } from "@/lib/supabase-auth"
import { activityAdmin, missingActivityMigration } from "@/lib/connection-activity"
import { repairConfirmedCleanup, verifiedInactivityPlan } from "@/lib/connection-inactivity"
import { loadItems } from "@/lib/plaid-items"
import { loadSession } from "@/lib/snaptrade-session"
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"}
export const dynamic="force-dynamic"
export async function GET(req:Request) {
    const user=await verifiedAppUserId(req)
    if(!user) return Response.json({error:"Sign in to view connection notices."},{status:401,headers})
    try {
        const db=activityAdmin()
        const settled=await db.rpc("settle_expired_connection_cleanup",{p_user_id:user})
        if(missingActivityMigration(settled.error)) return Response.json({notices:[]},{headers})
        if(settled.error) throw settled.error
        const {data,error}=await db.from("connection_cleanup_receipts").select("id,banks_removed,brokerages_removed,completed_at")
            .eq("user_id",user).eq("status","completed").is("acknowledged_at",null).order("completed_at",{ascending:true}).limit(100)
        if(missingActivityMigration(error)) return Response.json({notices:[]},{headers})
        if(error) throw error
        const notices=(data??[]).filter(r=>r.banks_removed+r.brokerages_removed>0)
        if(!notices.length) return Response.json({notices:[]},{headers})
        await repairConfirmedCleanup(user)
        const [banks,session,plan,removed]=await Promise.all([loadItems(user),loadSession(user),verifiedInactivityPlan(user),
            db.from("connection_cleanup_removals").select("identity").eq("user_id",user).eq("kind","bank").in("receipt_id",notices.map(n=>n.id))])
        if(removed.error) throw removed.error
        const liveNames=new Set(banks.map(x=>(x.institution??"").toLowerCase()))
        const inactiveBankInstitutions=Array.from(new Set((removed.data??[]).map(r=>String(r.identity?.institution??"")).filter(x=>x&&!liveNames.has(x.toLowerCase()))))
        return Response.json({notices:notices.map(r=>({id:r.id,banksRemoved:r.banks_removed,brokeragesRemoved:r.brokerages_removed,completedAt:r.completed_at})),
            banksRemaining:banks.length,inactiveBankInstitutions,brokerageConnected:session!=null,subscriptionActive:plan==="annual"||plan==="monthly"},{headers})
    } catch {return Response.json({error:"Connection notices are temporarily unavailable."},{status:503,headers})}
}
export async function POST(req:Request) {
    const user=await verifiedAppUserId(req)
    if(!user) return Response.json({error:"Sign in to manage connection notices."},{status:401,headers})
    try {
        const body=await req.json(), ids=body?.ids
        if(!Array.isArray(ids)||ids.length>100||!ids.every(x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x))) return Response.json({error:"Invalid notice IDs."},{status:400,headers})
        const {error}=await activityAdmin().rpc("ack_connection_cleanup_receipts",{p_user_id:user,p_ids:ids})
        if(error) throw error
        return Response.json({acknowledged:true},{headers})
    } catch {return Response.json({error:"Notices could not be acknowledged."},{status:503,headers})}
}
