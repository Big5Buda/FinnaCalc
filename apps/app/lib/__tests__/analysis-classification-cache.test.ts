import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const disk=vi.hoisted(()=>new Map<string,unknown>())
vi.mock('next/cache',()=>({unstable_cache:(load:()=>Promise<unknown>,keys:string[])=>async()=>{
 const key=JSON.stringify(keys);if(disk.has(key))return disk.get(key);const value=await load();disk.set(key,value);return value
}}))
const MU={cik:'0000723125',name:'MICRON TECHNOLOGY INC',tickers:['MU'],sic:'3674',sicDescription:'Semiconductors & Related Devices'}
const NOW=1794571200000
let map:Record<string,unknown>,submission:any,calls:string[],failure=false
beforeEach(()=>{
 vi.resetModules();disk.clear();vi.useFakeTimers();vi.setSystemTime(NOW)
 map={'0':{ticker:'MU',cik_str:723125}};submission={...MU};calls=[];failure=false
 vi.stubGlobal('fetch',vi.fn(async(input:unknown)=>{
  const url=String(input);calls.push(url)
  if(!url.startsWith('https://www.sec.gov/files/company_tickers.json')&&!url.startsWith('https://data.sec.gov/submissions/'))throw new Error('non-SEC classification fetch forbidden')
  if(failure)throw new Error('offline')
  return Response.json(url.includes('company_tickers')?map:submission)
 }))
})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
describe('shared exact SEC issuer classification',()=>{
 it('classifies captured real MU SIC3674 and publishes broad label/current name with original cache stamps',async()=>{
  const {factsBatch}=await import('../public-market/facts')
  const first:any=await factsBatch(['MU'],'classification');const row=first.results.MU
  expect(row.name).toBe(MU.name);expect(row.sector).toBe('Technology')
  expect(row.analysisClassification).toMatchObject({status:'classified',cik:MU.cik,rawSic:'3674',rawIndustry:MU.sicDescription,sectorId:'technology',method:'secSic',securityId:null,assetType:'unknown',checkedAt:NOW/1000})
  expect(row.raw.epsTTM).toBeNull();expect(row.issuerCurrency).toBeNull();expect(calls).toHaveLength(2)
  vi.setSystemTime(NOW+60000);const again:any=await factsBatch(['MU'],'classification')
  expect(again.results.MU).toEqual(row);expect(calls).toHaveLength(2)
  vi.setSystemTime(NOW+86400001);await factsBatch(['MU'],'classification');expect(calls).toHaveLength(3)
  expect(calls.filter(u=>u.includes('company_tickers'))).toHaveLength(1)
 })
 it('shares one map acquisition concurrently and across facts; no per-symbol map request',async()=>{
  const {analysisClassification}=await import('../public-market/classification')
  const values=await Promise.all(Array.from({length:12},()=>analysisClassification('MU')))
  expect(values.every(v=>v.status==='classified')).toBe(true);expect(calls).toHaveLength(2)
  const {resolveSECIssuer}=await import('../public-market/sec-issuer')
  expect(await resolveSECIssuer('MU')).toEqual({status:'found',cik:MU.cik});expect(calls).toHaveLength(2)
  // Facts uses the same resolver; fail ONLY companyfacts to prove no map reload.
  vi.stubGlobal('fetch',vi.fn(async(input:unknown)=>{calls.push(String(input));throw new Error('companyfacts deliberately offline')}))
  const {factsBatch}=await import('../public-market/facts');await factsBatch(['MU'],'facts')
  expect(calls).toHaveLength(3);expect(calls[2]).toContain('/companyfacts/CIK0000723125.json')
 })
 it.each([
  ['wrong CIK',{...MU,cik:999},'ambiguous'],
  ['wrong exact ticker',{...MU,tickers:['MUA']},'ambiguous'],
  ['missing name',{...MU,name:''},'ambiguous'],
  ['missing SIC',{...MU,sic:''},'unknown'],
  ['outside mapping',{...MU,sic:'9999'},'unknown'],
 ])('fails safely for %s',async(_case,raw,status)=>{
  submission=raw;const {factsBatch}=await import('../public-market/facts');const result:any=await factsBatch(['MU'],'classification')
  const row=result.results.MU;expect(row.analysisClassification.status).toBe(status);expect(row.analysisClassification.sectorId).toBeNull();expect(row.sector).toBeNull();expect(row.raw.epsTTM).toBeNull()
 })
 it('uses dynamic current SEC name, without treating stale/fuzzy names as identity',async()=>{
  submission={...MU,name:'CURRENT SEC ISSUER NAME'}
  const {factsBatch}=await import('../public-market/facts');const result:any=await factsBatch(['MU'],'classification')
  expect(result.results.MU.name).toBe('CURRENT SEC ISSUER NAME');expect(result.results.MU.analysisClassification.status).toBe('classified')
 })
 it('rejects conflicting exact ticker mappings before submissions and never fuzzy joins names',async()=>{
  map['1']={ticker:'MU',cik_str:99}
  const {analysisClassification}=await import('../public-market/classification');expect((await analysisClassification('MU')).status).toBe('ambiguous');expect(calls).toHaveLength(1)
  expect((await analysisClassification('MUA')).status).toBe('unknown');expect(calls).toHaveLength(1)
 })
 it('normalizes dot/dash listing syntax only and rejects invalid conflicting CIK rows',async()=>{
  const {issuerFromTickerMap}=await import('../public-market/sec-issuer')
  expect(issuerFromTickerMap(' brk.b ',{'0':{ticker:'BRK-B',cik_str:1067983}})).toEqual({status:'found',cik:'0001067983'})
  expect(issuerFromTickerMap('MU',{'0':{ticker:'MU',cik_str:723125},'1':{ticker:'MU',cik_str:-1}})).toEqual({status:'ambiguous'})
  expect(issuerFromTickerMap('MU',{'0':{ticker:'MU',cik_str:723125},'1':{ticker:'MU',cik_str:723125}})).toEqual({status:'found',cik:MU.cik})
 })
 it('preserves reviewed pin name/CIK checks, quarantine and ETF zero-call behavior',async()=>{
  const {analysisClassification}=await import('../public-market/classification')
  for(const symbol of ['XOM','HES','EA','WBD','PARA','VOO','SPY','QQQ'])expect((await analysisClassification(symbol)).status).not.toBe('classified')
  expect(calls).toHaveLength(0)
  submission={...MU,cik:320193,tickers:['AAPL'],name:'Different issuer'}
  expect((await analysisClassification('AAPL')).status).toBe('ambiguous');expect(calls).toHaveLength(1);expect(calls[0]).toContain('/submissions/CIK0000320193.json')
 })
 it('backs off failed acquisitions without daily negative poisoning and bounds batch deadline',async()=>{
  const {analysisClassification,analysisClassificationEntry}=await import('../public-market/classification')
  failure=true;expect((await analysisClassification('MU')).status).toBe('unavailable');expect(calls).toHaveLength(1)
  expect((await analysisClassification('UNPINNED')).status).toBe('unavailable');expect(calls).toHaveLength(1) // shared map outage backoff across symbols
  failure=false;vi.setSystemTime(NOW+60000);expect((await analysisClassification('MU')).status).toBe('unavailable');expect(calls).toHaveLength(1)
  vi.setSystemTime(NOW+120001);expect((await analysisClassification('MU')).status).toBe('classified');expect(calls).toHaveLength(3)
  const expired=await analysisClassificationEntry('OTHER',Date.now()/1000,Date.now()-1);expect(expired.value.classification.status).toBe('unavailable');expect(calls).toHaveLength(3)
 })
})
