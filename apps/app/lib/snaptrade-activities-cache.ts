import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { scanActivities, type ActivityRow, type ActivityTotals } from './snaptrade-activities-normalize'
export interface ActivitiesAccess {owner:string; fingerprint:string;accountId:string;connectionId:string;countedConnectionId:string|null;connectionState:'enabled'|'disabled'|'unknown'}
export interface ActivitiesSnapshot {schemaVersion:1;accountId:string;connectionId:string;scope:{kind:'account';countedConnectionId:string|null};revision:string;status:'ready'|'partial'|'stale';fetchedAt:number;expiresAt:number;providerAsOf:number|null;connectionState:ActivitiesAccess['connectionState'];coverage:{requestedStart:null;requestedEnd:string;earliestObserved:string|null;latestObserved:string|null;paginationComplete:true;lifetimeComplete:false;periodCompleteness:'providerAvailableOnly'|'incomplete';unresolvedCount:number;reasons:string[]};rows:ActivityRow[];totalsByCurrency:ActivityTotals}
export class ActivitiesHTTPError extends Error {constructor(public status:number,public code:string){super(code)}}
export interface ActivitiesRequestContext {readonly owner:string}
/** Process random secret: no new environment key, restart invalidates old cursors. */
export class ActivitiesMemory {
    private secret=randomBytes(32)
    private snapshots=new Map<string,{owner:string;value:ActivitiesSnapshot;bytes:number}>()
    private pending=new Map<string,Promise<ActivitiesSnapshot>>()
    private epochs=new Map<string,number>()
    private observed=new Map<string,string>()
    private active=0
    private retryAfter=new Map<string,number>()
    private requests=new WeakMap<ActivitiesRequestContext,{owner:string;fence:string;key?:string;used?:boolean}>()
    constructor(private clock=()=>Date.now()/1000,private maxEntries=32,private maxBytes=16*1024*1024){}
    digest(value:unknown){return createHmac('sha256',this.secret).update(JSON.stringify(value)).digest('hex')}
    invalidate(owner:string){this.epochs.set(owner,(this.epochs.get(owner)??0)+1);if(this.epochs.size>1024){this.secret=randomBytes(32);this.epochs.clear();this.snapshots.clear();this.retryAfter.clear()}for(const[k,v]of this.snapshots)if(v.owner===owner)this.snapshots.delete(k)}
    private key(a:ActivitiesAccess){return this.digest([a.owner,a.fingerprint,a.accountId,a.connectionId,a.countedConnectionId,a.connectionState,this.epochs.get(a.owner)??0,1])}
    private fence(owner:string){return this.digest(['request',owner,this.epochs.get(owner)??0])}
    beginRequest(owner:string):ActivitiesRequestContext {const context={owner};this.requests.set(context,{owner,fence:this.fence(owner)});return context}
    assertRequest(context:ActivitiesRequestContext){const state=this.requests.get(context);if(!state||state.owner!==context.owner||state.fence!==this.fence(state.owner))throw new ActivitiesHTTPError(409,'activities_identity_changed')}
    bindRequest(context:ActivitiesRequestContext,a:ActivitiesAccess){
        this.assertRequest(context);const state=this.requests.get(context)!
        if(a.owner!==context.owner)throw new ActivitiesHTTPError(409,'activities_identity_changed')
        if(state.key){if(state.key!==this.key(a))throw new ActivitiesHTTPError(409,'activities_identity_changed');return}
        const secret=this.secret
        const observation=this.digest([a.owner,a.accountId]);const observed=this.digest([a.fingerprint,a.connectionState,a.countedConnectionId]);const previous=this.observed.get(observation)
        if(previous&&previous!==observed)this.invalidate(a.owner)
        this.observed.delete(observation);this.observed.set(observation,observed)
        if(this.observed.size>128){this.secret=randomBytes(32);this.observed.clear();this.epochs.clear();this.snapshots.clear();this.retryAfter.clear()}
        if(secret!==this.secret)throw new ActivitiesHTTPError(409,'activities_identity_changed')
        // This request has just verified the new access. Rebase only its own
        // local observation invalidation; other old contexts remain fenced.
        state.fence=this.fence(a.owner);state.key=this.key(a)
    }
    private assertBound(context:ActivitiesRequestContext,a:ActivitiesAccess,key:string){this.assertRequest(context);if(this.requests.get(context)?.key!==key||this.key(a)!==key)throw new ActivitiesHTTPError(409,'activities_identity_changed')}
    private async verify(context:ActivitiesRequestContext,a:ActivitiesAccess,check:()=>Promise<ActivitiesAccess>,key:string){
        this.assertBound(context,a,key);const current=await check();this.assertBound(context,a,key)
        if(this.key(current)!==key||current.owner!==a.owner){this.invalidate(a.owner);throw new ActivitiesHTTPError(409,'activities_identity_changed')}
    }
    private remember(key:string,owner:string,value:ActivitiesSnapshot){
        const bytes=Buffer.byteLength(JSON.stringify(value));if(bytes>this.maxBytes)throw new ActivitiesHTTPError(503,'activities_snapshot_too_large')
        this.snapshots.delete(key);this.snapshots.set(key,{owner,value,bytes})
        let total=[...this.snapshots.values()].reduce((n,s)=>n+s.bytes,0)
        while(this.snapshots.size>this.maxEntries||total>this.maxBytes){const k=this.snapshots.keys().next().value!;total-=this.snapshots.get(k)!.bytes;this.snapshots.delete(k)}
    }
    private cursor(key:string,s:ActivitiesSnapshot,index:number){const data=Buffer.from(JSON.stringify([key,s.revision,index,Math.min(s.expiresAt+86400,this.clock()+86400)])).toString('base64url');return data+'.'+this.digest(data)}
    async read(a:ActivitiesAccess,cursor:string|null,check:()=>Promise<ActivitiesAccess>,load:(offset:number,endDate:string)=>Promise<unknown>,request?:ActivitiesRequestContext){
        // The route supplies a context freshly authorized for THIS response.
        // Standalone callers must perform the same entry check here.
        const context=request??this.beginRequest(a.owner)
        if(!request){this.assertRequest(context);const current=await check();this.assertRequest(context);if(current.owner!==a.owner||this.key(current)!==this.key(a)){this.invalidate(a.owner);throw new ActivitiesHTTPError(409,'activities_identity_changed')}this.bindRequest(context,a)}
        const requestState=this.requests.get(context)
        if(!requestState||requestState.used)throw new ActivitiesHTTPError(409,'activities_identity_changed')
        requestState.used=true
        const key=this.key(a);this.assertBound(context,a,key);const now=this.clock();let s=this.snapshots.get(key)?.value;let index=0
        let postAttempted=false,postValidated=false
        const afterAcquisition=async()=>{postAttempted=true;await this.verify(context,a,check,key);postValidated=true}
        if(cursor){
            if(!/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(cursor))throw new ActivitiesHTTPError(409,'activities_cursor_expired')
            const parts=cursor.split('.');const expected=parts.length===2?this.digest(parts[0]):''
            if(!expected||parts[1].length!==expected.length||!timingSafeEqual(Buffer.from(parts[1]),Buffer.from(expected)))throw new ActivitiesHTTPError(409,'activities_cursor_expired')
            let decoded:unknown;try{decoded=JSON.parse(Buffer.from(parts[0],'base64url').toString())}catch{throw new ActivitiesHTTPError(409,'activities_cursor_expired')}
            if(!Array.isArray(decoded)||decoded.length!==4||decoded[0]!==key||!s||decoded[1]!==s.revision||typeof decoded[3]!=='number'||decoded[3]>s.expiresAt+86400||now>=Number(decoded[3])||!Number.isSafeInteger(decoded[2])||decoded[2]<=0||decoded[2]%500||decoded[2]>=s.rows.length)throw new ActivitiesHTTPError(409,'activities_cursor_expired')
            index=decoded[2]
        }else if(!s||(s.expiresAt<=now&&(this.retryAfter.get(key)??0)<=now)){
            let pending=this.pending.get(key);let created=false
            if(!pending){
                if(this.active>=2||this.pending.size>=32)throw new ActivitiesHTTPError(503,'activities_busy')
                this.active++
                created=true
                pending=(async()=>{
                    const endDate=new Date(this.clock()*1000).toISOString().slice(0,10)
                    const normalized=await scanActivities(async(offset,end)=>{this.assertBound(context,a,key);const value=await load(offset,end);this.assertBound(context,a,key);return value},endDate)
                    await afterAcquisition();this.assertBound(context,a,key)
                    const at=this.clock();const dates=normalized.rows.flatMap(r=>r.date?[r.date]:[]).sort()
                    const value:ActivitiesSnapshot={schemaVersion:1,accountId:a.accountId,connectionId:a.connectionId,scope:{kind:'account',countedConnectionId:a.countedConnectionId},revision:randomUUID(),status:a.connectionState!=='enabled'?'stale':normalized.unresolvedCount?'partial':'ready',fetchedAt:at,expiresAt:at+86400,providerAsOf:null,connectionState:a.connectionState,coverage:{requestedStart:null,requestedEnd:endDate,earliestObserved:dates[0]??null,latestObserved:dates.at(-1)??null,paginationComplete:true,lifetimeComplete:false,periodCompleteness:normalized.unresolvedCount?'incomplete':'providerAvailableOnly',unresolvedCount:normalized.unresolvedCount,reasons:normalized.reasons},rows:normalized.rows,totalsByCurrency:normalized.totalsByCurrency}
                    if(a.connectionState!=='enabled')value.coverage.reasons.push('Connection is disabled or its freshness is unknown.')
                    this.assertBound(context,a,key);this.remember(key,a.owner,value);return value
                })().finally(()=>{this.pending.delete(key);this.active--})
                this.pending.set(key,pending)
            }
            try{s=await pending;this.assertBound(context,a,key);if(!created)await afterAcquisition()}catch(e){
                if(postAttempted&&!postValidated)throw e
                this.assertBound(context,a,key)
                if(!postAttempted)await afterAcquisition()
                // Keep an old complete scan for a bounded extra day, explicitly stale.
                if(!s||this.clock()-s.expiresAt>86400)throw e
                this.retryAfter.set(key,now+120);while(this.retryAfter.size>32)this.retryAfter.delete(this.retryAfter.keys().next().value!)
                s={...s,status:'stale',coverage:{...s.coverage,reasons:[...s.coverage.reasons,'Refresh failed; showing previous available feed.']}}
            }
        }
        this.assertBound(context,a,key)
        if(s&&s.expiresAt<=this.clock()){if(this.clock()-s.expiresAt>86400)throw new ActivitiesHTTPError(503,'activities_unavailable');s={...s,status:'stale',coverage:{...s.coverage,reasons:[...s.coverage.reasons,'Cached available feed is out of date.']}}}
        if(!s)throw new ActivitiesHTTPError(503,'activities_unavailable')
        return {...s,rows:s.rows.slice(index,index+500),nextCursor:index+500<s.rows.length?this.cursor(key,s,index+500):null}
    }
}
export const activitiesMemory=new ActivitiesMemory()
