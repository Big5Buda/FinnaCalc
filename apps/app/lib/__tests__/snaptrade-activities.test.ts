import { describe,it,expect,vi } from 'vitest'
import { normalizeActivities,scanActivities,decimal } from '../snaptrade-activities-normalize'
import { ActivitiesMemory,type ActivitiesAccess } from '../snaptrade-activities-cache'
const row=(id:string,extra:Record<string,unknown>={})=>({id,type:'DIVIDEND',amount:10,currency:{code:'USD'},trade_date:'2026-10-01',...extra})
const access:ActivitiesAccess={owner:'fake-owner',fingerprint:'fake-key-user-account-generation',accountId:'acct',connectionId:'link',countedConnectionId:null,connectionState:'enabled'}
const page=(data:unknown[],offset=0,total=data.length)=>({data,pagination:{offset,total,limit:1000}})
describe('received activity evidence',()=>{
 it('sums signed dividends exactly, not REI/substitute/tax, and preserves related IDs',()=>{
  const n=normalizeActivities([row('d',{amount:'0.1',external_reference_id:'pair'}),row('d2',{amount:'0.2',external_reference_id:'pair'}),row('r',{type:'REI',amount:-10,external_reference_id:'pair'}),row('rev',{amount:'-0.05'}),row('s',{type:'SUBSTITUTE_DIVIDEND'}),row('tax',{type:'TAX',amount:-2})]);expect(n.totalsByCurrency.USD).toEqual({received:'0.25',includedCount:3});expect(n.unresolvedCount).toBe(0);expect(n.rows).toHaveLength(6)
 })
 it.each([{currency:null},{amount:null},{trade_date:null,settlement_date:null},{id:null}])('withholds scope totals for unresolved dividend %j',bad=>{const n=normalizeActivities([row('a'),row('b',bad)]);expect(n.unresolvedCount).toBe(1);expect(n.totalsByCurrency.USD.received).toBeNull()})
 it('unlinked REI is unresolved; ordinary unknown/non-dividend records are not',()=>{expect(normalizeActivities([row('a'),row('r',{type:'REI'})]).unresolvedCount).toBe(1);expect(normalizeActivities([row('a'),row('x',{type:'UNKNOWN',amount:null,currency:null,trade_date:null})]).totalsByCurrency.USD.received).toBe('10')})
 it('does not infer FX or gross/net, retains sold/unresolved security receipts',()=>{const n=normalizeActivities([row('a',{symbol:null}),row('b',{currency:{code:'CAD'}})]);expect(n.totalsByCurrency.CAD.received).toBe('10');expect(n.rows[0].gross).toBeNull();expect(n.rows[0].securityId).toBeNull()})
 it('uses only actual universal symbol IDs and keeps their namespace explicit',()=>{const n=normalizeActivities([row('transaction',{symbol:{id:'universal-symbol',symbol:'AAPL'}}),row('other',{symbol:{id:123,symbol:'MSFT'}})]);expect(n.rows.find(r=>r.id==='transaction')).toMatchObject({securityId:'universal-symbol',securityIdSource:'snaptradeUniversalSymbol'});expect(n.rows.find(r=>r.id==='other')).toMatchObject({securityId:null,securityIdSource:null});expect(normalizeActivities([row('transaction')]).rows[0].securityId).toBeNull()})
 it('preserves broker calendar date and reports fallback date basis',()=>{const n=normalizeActivities([row('a',{trade_date:'2026-10-01T00:30:00+10:00'}),row('b',{trade_date:null,settlement_date:'2026-10-02'})]);expect(n.rows.find(x=>x.id==='a')?.date).toBe('2026-10-01');expect(n.rows.find(x=>x.id==='b')?.dateBasis).toBe('settlement')})
 it('handles decimal exponents and rejects unrepresentable/invalid amounts',()=>{expect(decimal(1e-8)).toBe('0.00000001');expect(decimal('-0.00')).toBe('0');expect(decimal(NaN)).toBeNull();expect(decimal('0.0000000000001')).toBeNull()})
})
describe('complete available feed pagination',()=>{
 it.each([['source',' source '],[' source ','source']])('rejects canonical duplicate IDs %j in either order',async(first,second)=>{
  const load=vi.fn(async offset=>page([row(first),row(second,{amount:99})],offset,2))
  await expect(scanActivities(load,'2026-11-13')).rejects.toThrow('Repeated activity ID')
  expect(load).toHaveBeenCalledTimes(2)
 })
 it('detects canonical duplicates across pages without selecting a payload winner',async()=>{
  const data=[row(' shared '),...Array.from({length:999},(_,i)=>row('unique'+i)),row('shared',{amount:-5})]
  const load=vi.fn(async offset=>page(data.slice(offset,offset+1000),offset,data.length))
  await expect(scanActivities(load,'2026-11-13')).rejects.toThrow('Repeated activity ID')
  expect(load).toHaveBeenCalledTimes(4)
 })
 it('canonicalizes IDs and relation IDs separately; empty IDs remain unresolved',async()=>{
  const n=await scanActivities(async offset=>page([row(' dividend ',{external_reference_id:' relation '}),row('rei',{type:'REI',external_reference_id:'relation'}),row('   ')],offset,3),'2026-11-13')
  expect(n.rows.map(r=>r.id).sort()).toEqual(['dividend','rei']);expect(n.unresolvedCount).toBe(1)
  expect(n.rows.find(r=>r.id==='rei')?.exclusionReason).toBe('reinvestmentLeg')
  expect(n.totalsByCurrency.USD.received).toBeNull()
 })
 it('quarantines future dividend evidence and never publishes a fresh cash total',async()=>{
  const n=await scanActivities(async offset=>page([row('known'),row('future',{trade_date:'2026-12-01'})],offset,2),'2026-11-13')
  expect(n.unresolvedCount).toBe(1);expect(n.totalsByCurrency.USD.received).toBeNull()
  expect(n.rows.find(r=>r.id==='future')).toMatchObject({includedInReceived:false,exclusionReason:'futureRecordedDate'})
 })
 it('uses recorded dates, accepts the end boundary and signed reversals, rejects future settlement fallback',async()=>{
  const n=await scanActivities(async offset=>page([row('boundary',{trade_date:'2026-11-13',amount:-2}),row('future',{trade_date:null,settlement_date:'2026-11-14'}),row('unknown',{trade_date:null,settlement_date:null})],offset,3),'2026-11-13')
  expect(n.rows.find(r=>r.id==='boundary')).toMatchObject({includedInReceived:true,amount:'-2',dateBasis:'trade'})
  expect(n.rows.find(r=>r.id==='future')).toMatchObject({includedInReceived:false,dateBasis:'settlement',exclusionReason:'futureRecordedDate'})
  expect(n.unresolvedCount).toBe(2);expect(n.totalsByCurrency.USD.received).toBeNull()
 })
 it('future possible dividends are unresolved while unrelated future non-dividends remain excluded',async()=>{
  const n=await scanActivities(async offset=>page([row('known'),row('adjustment',{type:'ADJUSTMENT',description:'dividend correction',trade_date:'2026-12-01'}),row('tax',{type:'TAX',trade_date:'2026-12-01'})],offset,3),'2026-11-13')
  expect(n.unresolvedCount).toBe(1);expect(n.rows.find(r=>r.id==='tax')?.includedInReceived).toBe(false)
  expect(n.totalsByCurrency.USD.received).toBeNull()
 })
 it.each([0,1,1000,1001,2000])('scans %i rows with exact provider request budget',async n=>{const rows=Array.from({length:n},(_,i)=>row(String(i)));const load=vi.fn(async(offset:number,end:string)=>{expect(end).toBe('2026-11-13');return page(rows.slice(offset,offset+1000),offset,n)});const result=await scanActivities(load,'2026-11-13');expect(result.rows.length).toBe(n);expect(load).toHaveBeenCalledTimes(Math.max(1,Math.ceil(n/1000)))})
 it('restarts once on total drift; second drift fails atomically',async()=>{let calls=0;await expect(scanActivities(async(offset)=>{calls++;return page(Array.from({length:offset?1:1000},(_,i)=>row(String(i+offset))),offset,offset?1002:1001)},'2026-11-13')).rejects.toThrow();expect(calls).toBe(4)})
 it('rejects repeated IDs and page budget exhaustion',async()=>{await expect(scanActivities(async offset=>page(Array.from({length:1000},(_,i)=>row(String(i))),offset,1001),'2026-11-13')).rejects.toThrow();const load=vi.fn(async offset=>page(Array.from({length:1000},(_,i)=>row(String(offset+i))),offset,20001));await expect(scanActivities(load,'2026-11-13')).rejects.toThrow('budget');expect(load).toHaveBeenCalledTimes(20)})
 it('does not accept a premature empty page',async()=>{await expect(scanActivities(async offset=>page([],offset,1),'2026-11-13')).rejects.toThrow()})
})
describe('private memory snapshots',()=>{
 it('request contexts cannot be forged, rebound or reused as cross-request permission',async()=>{
  const m=new ActivitiesMemory(),check=vi.fn(async()=>access),load=vi.fn(async()=>page([]))
  await expect(m.read(access,null,check,load,{owner:access.owner})).rejects.toMatchObject({status:409})
  const context=m.beginRequest(access.owner);m.bindRequest(context,access)
  await m.read(access,null,check,load,context)
  await expect(m.read(access,null,check,load,context)).rejects.toMatchObject({status:409})
  expect(()=>m.bindRequest(context,{...access,owner:'foreign'})).toThrow()
 })
 it('secret rotation and session deletion invalidate existing request fences',()=>{
  const m=new ActivitiesMemory(),old=m.beginRequest(access.owner);m.bindRequest(old,access)
  m.invalidate(access.owner);expect(()=>m.assertRequest(old)).toThrow()
  const pending=m.beginRequest('unchanged-owner')
  for(let i=0;i<1025;i++)m.invalidate('owner-'+i)
  expect(()=>m.assertRequest(pending)).toThrow()
 })
 it('a joined caller with denied post-scan authorization cannot receive or reuse another request context',async()=>{
  const m=new ActivitiesMemory();let release!:(value:unknown)=>void
  const load=vi.fn(()=>new Promise(resolve=>{release=resolve}))
  const writer=m.beginRequest(access.owner);m.bindRequest(writer,access)
  const joiner=m.beginRequest(access.owner);m.bindRequest(joiner,access)
  const one=m.read(access,null,async()=>access,load,writer)
  const two=m.read(access,null,async()=>{throw new Error('revoked')},load,joiner)
  const denied=expect(two).rejects.toThrow('revoked')
  release(page([]));expect((await one).status).toBe('ready');await denied
 })
 it('coalesces same owner, serves 500-row stable pages with full totals and rejects foreign/restart/tampered cursors',async()=>{const m=new ActivitiesMemory();const a=async()=>access;const data=Array.from({length:1001},(_,i)=>row(String(i)));const load=vi.fn(async offset=>page(data.slice(offset,offset+1000),offset,data.length));const [one,two]=await Promise.all([m.read(access,null,a,load),m.read(access,null,a,load)]);expect(load).toHaveBeenCalledTimes(2);expect(one.revision).toBe(two.revision);expect(one.rows.length).toBe(500);expect(one.totalsByCurrency.USD.received).toBe('10010');const next=await m.read(access,one.nextCursor,a,load);expect(next.revision).toBe(one.revision);expect(next.rows.length).toBe(500);expect(load).toHaveBeenCalledTimes(2);await expect(m.read({...access,owner:'other'},one.nextCursor,async()=>({...access,owner:'other'}),load)).rejects.toMatchObject({status:409});await expect(new ActivitiesMemory().read(access,one.nextCursor,a,load)).rejects.toMatchObject({status:409});await expect(m.read(access,one.nextCursor+'x',a,load)).rejects.toMatchObject({status:409})})
 it('checks permission before joining and after awaited scan; disconnect fences old writes',async()=>{const m=new ActivitiesMemory();let finish!:(v:unknown)=>void;const load=()=>new Promise<unknown>(r=>{finish=r});const running=m.read(access,null,async()=>access,load);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));await expect(m.read(access,null,async()=>{throw new Error('denied')},load)).rejects.toThrow('denied');m.invalidate(access.owner);finish(page([row('a')]));await expect(running).rejects.toMatchObject({status:409})})
 it('daily replacement reconciles corrected/deleted IDs, failed scan only returns dated stale data',async()=>{let time=Date.parse("2026-11-13T00:00:00Z")/1000;const m=new ActivitiesMemory(()=>time);const a=async()=>access;const first=await m.read(access,null,a,async()=>page([row('a'),row('b')]));time+=86401;const corrected=await m.read(access,null,a,async()=>page([row('a',{amount:-5})]));expect(corrected.rows.length).toBe(1);expect(corrected.totalsByCurrency.USD.received).toBe('-5');expect(corrected.revision).not.toBe(first.revision);time+=86401;const stale=await m.read(access,null,a,async()=>{throw new Error('offline')});expect(stale.status).toBe('stale');expect(stale.expiresAt).toBeLessThan(time);expect(stale.fetchedAt).toBe(corrected.fetchedAt)})
 it('never reuses observations after disabled/re-enabled or counted scope change',async()=>{const m=new ActivitiesMemory();const load=vi.fn(async()=>page([row('a')]));let a=access;await m.read(a,null,async()=>a,load);a={...access,connectionState:'disabled'};expect((await m.read(a,null,async()=>a,load)).status).toBe('stale');a=access;await m.read(a,null,async()=>a,load);expect(load).toHaveBeenCalledTimes(3);a={...access,countedConnectionId:'link'};await m.read(a,null,async()=>a,load);expect(load).toHaveBeenCalledTimes(4)})
 it('evicts bounded snapshots and invalidates evicted cursors',async()=>{const m=new ActivitiesMemory(undefined,1);const rows=Array.from({length:501},(_,i)=>row(String(i)));const first=await m.read(access,null,async()=>access,async()=>page(rows));const other={...access,owner:'second'};await m.read(other,null,async()=>other,async()=>page([]));await expect(m.read(access,first.nextCursor,async()=>access,async()=>page(rows))).rejects.toMatchObject({status:409})})
})
