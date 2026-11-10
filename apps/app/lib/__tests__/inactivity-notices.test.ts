import {beforeEach,expect,it,vi} from "vitest"
const m=vi.hoisted(()=>({user:"owner" as string|null,rpc:vi.fn(),error:null as any,receipts:[] as any[]}))
vi.mock("@/lib/supabase-auth",()=>({verifiedAppUserId:async()=>m.user}))
vi.mock("@/lib/connection-inactivity",()=>({repairConfirmedCleanup:vi.fn(),verifiedInactivityPlan:async()=>"annual"}))
vi.mock("@/lib/plaid-items",()=>({loadItems:async()=>[]}))
vi.mock("@/lib/snaptrade-session",()=>({loadSession:async()=>null}))
vi.mock("@/lib/connection-activity",()=>({missingActivityMigration:(e:any)=>e?.code==="PGRST202",activityAdmin:()=>({rpc:m.rpc,from:(table:string)=>{
 const filters:((r:any)=>boolean)[]=[]
 const q:any={select:()=>q,eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q},is:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q},in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q},order:()=>q,limit:()=>q,then:(r:any)=>r({data:(table==="connection_cleanup_receipts"?m.receipts:[]).filter(x=>filters.every(f=>f(x))),error:m.error})};return q
}})}))
import {GET,POST} from "../../app/api/connections/inactivity/route"
const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222"
beforeEach(()=>{vi.resetAllMocks();m.user="owner";m.error=null;m.rpc.mockResolvedValue({data:0,error:null});m.receipts=[{id,user_id:"owner",status:"completed",acknowledged_at:null,banks_removed:1,brokerages_removed:1,completed_at:"2027-02-01T00:00:00Z",secret:"PRIVATE"},{id:other,user_id:"other",status:"completed",acknowledged_at:null,banks_removed:5,brokerages_removed:0}]})
it("returns only owner-confirmed removals and no storage credentials",async()=>{const r=await GET(new Request("https://test.invalid"));expect(r.status).toBe(200);const body=await r.json();expect(body.notices).toHaveLength(1);expect(body.notices[0].id).toBe(id);expect(JSON.stringify(body)).not.toContain("PRIVATE");expect(JSON.stringify(body)).not.toContain(other);expect(r.headers.get("Cache-Control")).toBe("private, no-store")})
it("pending/zero-removal/acknowledged records never show a disconnect",async()=>{m.receipts[0].status="pending";expect((await(await GET(new Request("https://test.invalid"))).json()).notices).toEqual([]);m.receipts[0].status="completed";m.receipts[0].banks_removed=0;m.receipts[0].brokerages_removed=0;expect((await(await GET(new Request("https://test.invalid"))).json()).notices).toEqual([])})
it("refuses signed-out read and ack without any storage call",async()=>{m.user=null;expect((await GET(new Request("https://test.invalid"))).status).toBe(401);expect((await POST(new Request("https://test.invalid",{method:"POST",body:JSON.stringify({ids:[id]})}))).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled()})
it("ack is scoped to verified owner; client cannot choose another account",async()=>{const res=await POST(new Request("https://test.invalid",{method:"POST",body:JSON.stringify({ids:[other],userId:"other"})}));expect(res.status).toBe(200);expect(m.rpc).toHaveBeenCalledWith("ack_connection_cleanup_receipts",{p_user_id:"owner",p_ids:[other]})})
it("rejects malformed and oversized ack payloads",async()=>{for(const ids of [["bad"],Array(101).fill(id)]) expect((await POST(new Request("https://test.invalid",{method:"POST",body:JSON.stringify({ids})}))).status).toBe(400);expect(m.rpc).not.toHaveBeenCalled()})
it("pre-migration installs show nothing; other storage failures fail closed",async()=>{m.rpc.mockResolvedValueOnce({error:{code:"PGRST202"}});expect((await(await GET(new Request("https://test.invalid"))).json()).notices).toEqual([]);m.error={code:"offline"};expect((await GET(new Request("https://test.invalid"))).status).toBe(503)})
