import {afterEach,beforeEach,describe,it,expect,vi}from'vitest'
import {NextRequest}from'next/server'
const f=vi.hoisted(()=>({user:'test-owner',accountId:'11111111-1111-4111-8111-111111111111',connectionId:'22222222-2222-4222-8222-222222222222',session:{userId:'fake-provider-user',userSecret:'fake-secret',clientId:'fake-client'},denied:0,owned:true,connectionDisabled:false,page:vi.fn(),auth:vi.fn(),accountAuth:vi.fn()}))
vi.mock('@/lib/supabase-auth',()=>({verifiedAppUserId:async(req:NextRequest)=>(req.headers.get("x-test-owner")??f.user)||null}))
vi.mock('@/lib/snaptrade-session',()=>({loadSession:async()=>f.session}))
vi.mock('@/lib/snaptrade-access',()=>({wantsCountedScope:()=>true,brokerageReadScope:async()=>f.denied?{denied:new Response('',{status:f.denied})}:{countedConnectionId:f.connectionId}}))
vi.mock('@/lib/snaptrade',()=>({isSnapTradeConfigured:true,snapTradeKeyNamespace:()=> 'original',getSnapTrade:()=>({connections:{listBrokerageAuthorizations:async()=>{await f.auth();return{data:[{id:f.connectionId,disabled:f.connectionDisabled,type:'read'}]}}},accountInformation:{listUserAccounts:async()=>{await f.accountAuth();return{data:f.owned?[{id:f.accountId,brokerage_authorization:f.connectionId}]:[]}},getAccountActivities:f.page}})}))
import {GET}from'../route'
import {activitiesMemory}from'@/lib/snaptrade-activities-cache'
const request=(extra='')=>new NextRequest('https://example.invalid/api/snaptrade/activities?accountId='+f.accountId+'&scope=counted&schemaVersion=1'+extra)
describe('authenticated private activities endpoint',()=>{
 afterEach(()=>vi.useRealTimers())
 beforeEach(()=>{activitiesMemory.invalidate('test-owner');f.user='test-owner';f.owned=true;f.denied=0;f.connectionDisabled=false;f.session={userId:'fake-provider-user',userSecret:'fake-secret',clientId:'fake-client'};f.connectionId='22222222-2222-4222-8222-222222222222';f.page.mockReset();f.auth.mockReset();f.accountAuth.mockReset();f.page.mockResolvedValue({data:{data:[{id:'d',type:'DIVIDEND',amount:'3.25',currency:{code:'USD'},trade_date:'2026-11-01'}],pagination:{offset:0,limit:1000,total:1}}})})
 it('checks current authorization before warm cache response and never public-caches',async()=>{const one=await GET(request());expect(one.status).toBe(200);expect(one.headers.get('Cache-Control')).toBe('private, no-store');const a=await one.json();expect(a.totalsByCurrency.USD).toEqual({received:'3.25',includedCount:1});expect(a.coverage.lifetimeComplete).toBe(false);expect(JSON.stringify(a)).not.toContain('fake-secret');const count=f.auth.mock.calls.length;expect(count).toBe(2);expect(f.accountAuth).toHaveBeenCalledTimes(2);await GET(request());expect(f.auth.mock.calls.length-count).toBe(1);expect(f.auth.mock.calls.length).toBeGreaterThan(count);expect(f.page).toHaveBeenCalledTimes(1);f.owned=false;expect((await GET(request())).status).toBe(404);expect(f.page).toHaveBeenCalledTimes(1)})
 it('fails closed on paid scope outage/denial including warm response',async()=>{await GET(request());f.denied=503;expect((await GET(request())).status).toBe(503);f.denied=403;expect((await GET(request())).status).toBe(403);expect(f.page).toHaveBeenCalledTimes(1)})
 it('rejects anonymous, invalid, and unsupported filtering without provider calls',async()=>{f.user='';expect((await GET(request())).status).toBe(401);f.user='test-owner';expect((await GET(request('&startDate=2000-01-01'))).status).toBe(400);expect(f.page).not.toHaveBeenCalled()})
 it('rejects account change during provider scan before cache publication',async()=>{f.page.mockImplementation(async()=>{f.owned=false;return{data:{data:[],pagination:{offset:0,limit:1000,total:0}}}});expect((await GET(request())).status).toBe(404);f.owned=true;f.page.mockResolvedValue({data:{data:[],pagination:{offset:0,limit:1000,total:0}}});expect((await GET(request())).status).toBe(200);expect(f.page).toHaveBeenCalledTimes(2)})
 it('never calls a refresh/order endpoint; alltypes limit/endDate passed explicitly',async()=>{await GET(request());expect(f.page.mock.calls[0][0]).toMatchObject({limit:1000,offset:0,accountId:f.accountId});expect(f.page.mock.calls[0][0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);expect(f.page.mock.calls[0][0]).not.toHaveProperty('type')})
 it('measures full10000-row traversal with entry authorization on every cursor',async()=>{
  const rows=Array.from({length:10000},(_,i)=>({id:String(i),type:'DIVIDEND',amount:'1',currency:{code:'USD'},trade_date:'2026-11-01'}))
  f.page.mockImplementation(async({offset})=>({data:{data:rows.slice(offset,offset+1000),pagination:{offset,total:rows.length,limit:1000}}}))
  let cursor:string|null=null,pages=0,received=0
  do{const before=f.auth.mock.calls.length;const response=await GET(request(cursor?'&cursor='+encodeURIComponent(cursor):''));expect(response.status).toBe(200);const data=await response.json();expect(f.auth.mock.calls.length-before).toBe(pages===0?2:1);expect(data.totalsByCurrency.USD.received).toBe('10000');received+=data.rows.length;cursor=data.nextCursor;pages++}while(cursor)
  expect(pages).toBe(20);expect(received).toBe(10000);expect(f.page).toHaveBeenCalledTimes(10)
  expect(f.auth).toHaveBeenCalledTimes(21);expect(f.accountAuth).toHaveBeenCalledTimes(21)
 })
 it('each joined request revalidates its own context exactly once after the scan',async()=>{
  let release!:(value:unknown)=>void
  f.page.mockImplementation(()=>new Promise(resolve=>{release=resolve}))
  const first=GET(request()),second=GET(request())
  await vi.waitFor(()=>expect(release).toBeTypeOf('function'))
  release({data:{data:[],pagination:{offset:0,total:0,limit:1000}}})
  expect((await first).status).toBe(200);expect((await second).status).toBe(200)
  expect(f.page).toHaveBeenCalledTimes(1);expect(f.auth).toHaveBeenCalledTimes(4);expect(f.accountAuth).toHaveBeenCalledTimes(4)
 })
 it.each(['disconnect','scope','session','owner'])('rejects %s change while scan awaited and never publishes old cache',async(change)=>{
  let release!:(value:unknown)=>void;f.page.mockImplementation(()=>new Promise(resolve=>{release=resolve}))
  const pending=GET(request());await vi.waitFor(()=>expect(release).toBeTypeOf('function'))
  if(change==='disconnect')activitiesMemory.invalidate('test-owner')
  if(change==='scope')f.connectionId='33333333-3333-4333-8333-333333333333'
  if(change==='session')f.session={...f.session,userSecret:'changed-fixture'}
  if(change==='owner')f.user='other-owner'
  release({data:{data:[],pagination:{offset:0,total:0,limit:1000}}})
  expect((await pending).status).not.toBe(200)
  f.user='test-owner';f.session={userId:'fake-provider-user',userSecret:'fake-secret',clientId:'fake-client'};f.connectionId='22222222-2222-4222-8222-222222222222'
  f.page.mockResolvedValue({data:{data:[],pagination:{offset:0,total:0,limit:1000}}})
  expect((await GET(request())).status).toBe(200);expect(f.page).toHaveBeenCalledTimes(2)
 })
 it('checks process invalidation after an awaited entry SDK authorization',async()=>{
  f.auth.mockImplementationOnce(()=>activitiesMemory.invalidate('test-owner'))
  expect((await GET(request())).status).toBe(409);expect(f.page).not.toHaveBeenCalled();expect(f.accountAuth).not.toHaveBeenCalled()
 })
 it('does not join a foreign owner acquisition or reuse a foreign warm snapshot',async()=>{
  const url=request().url
  const a=await GET(new NextRequest(url,{headers:{'x-test-owner':'owner-a'}}))
  const b=await GET(new NextRequest(url,{headers:{'x-test-owner':'owner-b'}}))
  expect(a.status).toBe(200);expect(b.status).toBe(200);expect(f.page).toHaveBeenCalledTimes(2)
 })
 it('observes disabled and re-enabled states without reusing an old successful scan',async()=>{
  expect((await GET(request())).status).toBe(200);f.connectionDisabled=true
  expect((await GET(request()).then(r=>r.json())).status).toBe('stale');f.connectionDisabled=false
  expect((await GET(request()).then(r=>r.json())).status).toBe('ready');expect(f.page).toHaveBeenCalledTimes(3)
 })
 it('stale refresh has only one entry and one post-scan check; auth outage never serves stale',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-13T12:00:00Z'))
  expect((await GET(request())).status).toBe(200);vi.setSystemTime(Date.now()+86401000)
  f.page.mockRejectedValue(new Error('offline'));const before=f.auth.mock.calls.length
  const response=await GET(request());expect(response.status).toBe(200);expect((await response.json()).status).toBe('stale');expect(f.auth.mock.calls.length-before).toBe(2)
  f.auth.mockRejectedValue(new Error('authorization outage'));expect((await GET(request())).status).toBe(503)
 })

})
