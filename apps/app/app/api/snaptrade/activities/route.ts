import { NextRequest } from 'next/server'
import { verifiedAppUserId } from '@/lib/supabase-auth'
import { loadSession } from '@/lib/snaptrade-session'
import { getSnapTrade, isSnapTradeConfigured, snapTradeKeyNamespace } from '@/lib/snaptrade'
import { brokerageReadScope, wantsCountedScope } from '@/lib/snaptrade-access'
import { activitiesMemory, ActivitiesHTTPError, type ActivitiesAccess } from '@/lib/snaptrade-activities-cache'
export const dynamic='force-dynamic'
export const maxDuration=60
const headers={'Cache-Control':'private, no-store'}
function failure(status:number,code:string){return Response.json({code,error:'Brokerage activity history is unavailable.'},{status,headers})}
export async function GET(req:NextRequest){
    try{
        const deadline=Date.now()+45000
        const owner=await verifiedAppUserId(req)
        if(!owner)return failure(401,'unauthenticated')
        const q=req.nextUrl.searchParams;const accountId=q.get('accountId')??''
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)||q.get('schemaVersion')!=='1'||[...q.keys()].some(k=>!['accountId','scope','schemaVersion','cursor'].includes(k))||q.getAll('accountId').length!==1||q.getAll('cursor').length>1||(q.has('scope')&&q.get('scope')!=='counted')||(q.get('cursor')?.length??0)>2048)return failure(400,'invalid_activities_request')
        if(!isSnapTradeConfigured)return failure(503,'brokerage_unavailable')
        const context=activitiesMemory.beginRequest(owner)
        const fenced=async<T>(operation:()=>Promise<T>):Promise<T>=>{activitiesMemory.assertRequest(context);try{return await operation()}finally{activitiesMemory.assertRequest(context)}}
        const authorize=async()=>{
            if(await fenced(()=>verifiedAppUserId(req))!==owner){activitiesMemory.invalidate(owner);throw new ActivitiesHTTPError(401,'unauthenticated')}
            const session=await fenced(()=>loadSession(owner))
            if(!session){activitiesMemory.invalidate(owner);throw new ActivitiesHTTPError(401,'brokerage_session_missing')}
            const st=getSnapTrade(session)
            const {data:connections}=await fenced(()=>st.connections.listBrokerageAuthorizations({userId:session.userId,userSecret:session.userSecret},{timeout:8000}))
            if(!Array.isArray(connections))throw new ActivitiesHTTPError(503,'brokerage_authorizations_unavailable')
            const scope=await fenced(()=>brokerageReadScope(owner,session,connections,wantsCountedScope(req.url)))
            if('denied'in scope){activitiesMemory.invalidate(owner);throw new ActivitiesHTTPError(scope.denied.status,'brokerage_scope_denied')}
            const {data:accounts}=await fenced(()=>st.accountInformation.listUserAccounts({userId:session.userId,userSecret:session.userSecret},{timeout:8000}))
            if(!Array.isArray(accounts))throw new ActivitiesHTTPError(503,'brokerage_accounts_unavailable')
            const account=accounts.find((a:any)=>a.id===accountId)
            const connectionId=account?.brokerage_authorization
            const connection=connections.find((c:any)=>c.id===connectionId)
            if(typeof connectionId!=='string'||!connection||!account||(scope.countedConnectionId&&scope.countedConnectionId!==connectionId)){
                activitiesMemory.invalidate(owner);throw new ActivitiesHTTPError(404,'brokerage_account_unavailable')
            }
            const state=connection.disabled===true?'disabled':connection.disabled===false?'enabled':'unknown'
            // HMAC hides credential material. This is an observed authorization/session
            // fingerprint, NOT a database generation or a distributed revocation claim.
            const access:ActivitiesAccess={owner,accountId,connectionId,countedConnectionId:scope.countedConnectionId,connectionState:state,
                fingerprint:activitiesMemory.digest([owner,snapTradeKeyNamespace(session.clientId),session.clientId,session.userId,session.userSecret,accountId,connectionId,connection,scope.countedConnectionId])}
            return {access,session,st}
        }
        const initial=await authorize()
        activitiesMemory.bindRequest(context,initial.access)
        const result=await activitiesMemory.read(initial.access,q.get('cursor'),async()=>(await authorize()).access,async(offset,endDate)=>{
            if(Date.now()>=deadline)throw new ActivitiesHTTPError(503,'activities_deadline')
            const {data}=await fenced(()=>initial.st.accountInformation.getAccountActivities({userId:initial.session.userId,userSecret:initial.session.userSecret,accountId,offset,limit:1000,endDate},{timeout:Math.min(10000,deadline-Date.now())}))
            return data
        },context)
        activitiesMemory.assertRequest(context)
        return Response.json(result,{headers})
    }catch(e){
        if(e instanceof ActivitiesHTTPError)return failure(e.status,e.code)
        return failure(503,'activities_unavailable')
    }
}
