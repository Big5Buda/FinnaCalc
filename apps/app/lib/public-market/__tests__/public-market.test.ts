import { beforeEach,afterEach,describe,it,expect,vi } from "vitest"
import { NextRequest,NextResponse } from "next/server"
import ts from "typescript"
import baselineSources from "./baseline-source.json"
import { writeFileSync } from "node:fs"

const durable=vi.hoisted(()=>new Map<string,unknown>())
const cacheSize=vi.hoisted(()=>({max:0,rejected:0,writes:0,failAt:0}))
vi.mock("next/cache",()=>({unstable_cache:(load:()=>Promise<unknown>,key:string[])=>async()=>{
    const k=load.toString()+JSON.stringify(key)
    if(durable.has(k)) return durable.get(k)
    const value=await load()
    const size=Buffer.byteLength(JSON.stringify({kind:"FETCH",data:{headers:{},body:JSON.stringify(value),status:200,url:""},revalidate:60}))
    cacheSize.max=Math.max(cacheSize.max,size);cacheSize.writes++
    if(cacheSize.failAt===cacheSize.writes)throw new Error("Injected durable write failure")
    if(size>2*1024*1024){cacheSize.rejected++;return value}
    durable.set(k,value);return value
}}))
const NOW=Date.parse("2026-11-11T16:30:00Z")
const symbols=(n:number,offset=0)=>Array.from({length:n},(_,i)=>`S${String(i+offset).padStart(3,"0")}`)
type Counts={alpacaData:number;alpacaTrading:number;sec:number;snaptrade:number;bytes:number;peak:number}
let denseRowsCache=new Map<string,any[]>()
let counts:Counts,fetchCache:Map<string,{at:number;data:unknown}>,failure:string|null,pageSize:number,active:number,unknownSymbols:Set<string>,retryOnce:boolean,delayMs:number,denseMode:boolean,denseDays:number
function bars(symbol:string,timeframe:string) {
    if(denseMode) {
        const step=timeframe === "1Min" ? 60000 : timeframe.includes("Min") ? 300000 : 86400000
        const n=timeframe.includes("Min") ? Math.floor(denseDays*86400000/step) : 370
        return Array.from({length:n},(_,i)=>({t:new Date(NOW-(n-i)*step).toISOString(),o:100.123456,h:101.234567,l:99.234567,c:100.765432,v:12345,n:50,vw:100.765432}))
    }
    const n=timeframe.includes("Min") ? 60 : 270
    return Array.from({length:n},(_,i)=>({t:new Date(NOW-(n-i)*(timeframe.includes("Min") ? 300000:86400000)).toISOString(),o:100,h:102,l:99,c:101+(i%5),v:1000}))
}
const factDoc={facts:{"us-gaap":{
    Assets:{units:{USD:[{val:100,end:"2025-12-31",form:"10-K"}]}},
    Revenues:{units:{USD:[{val:100,end:"2025-12-31",start:"2025-01-01",form:"10-K",filed:"2026-02-01"},{val:90,end:"2024-12-31",start:"2024-01-01",form:"10-K",filed:"2025-02-01"}]}},
    EarningsPerShareDiluted:{units:{"USD/shares":[{val:5.555,end:"2025-12-31",start:"2025-01-01",form:"10-K",filed:"2026-02-01"}]}},
    CommonStockDividendsPerShareDeclared:{units:{"USD/shares":[{val:1,end:"2025-12-31",start:"2025-01-01",form:"10-K",filed:"2026-02-01"}]}}
}}}
function resetProvider() {
    denseRowsCache=new Map()
    counts={alpacaData:0,alpacaTrading:0,sec:0,snaptrade:0,bytes:0,peak:0};fetchCache=new Map();failure=null;pageSize=10000;active=0;unknownSymbols=new Set();retryOnce=false;delayMs=0;denseMode=false;denseDays=4
}
async function fakeFetch(input: string|URL|Request,init:any={}) {
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url)
    const key=url.href,ttl=init.next?.revalidate ?? 0,hit=fetchCache.get(key)
    if(ttl>0 && hit && Date.now()-hit.at<ttl*1000) return Response.json(hit.data)
    if(url.hostname.includes("alpaca")) {
        if(url.pathname.startsWith("/v2/assets"))counts.alpacaTrading++;else counts.alpacaData++
    } else if(url.hostname.includes("sec.gov")) counts.sec++
    else throw new Error(`Forbidden fake network destination ${url.hostname}`)
    active++;counts.peak=Math.max(counts.peak,active)
    if(delayMs) await new Promise(r=>setTimeout(r,delayMs))
    active--
    if(retryOnce) { retryOnce=false;return new Response("retry",{status:429,headers:{"retry-after":"0"}}) }
    if(failure==="outage" || failure==="second" && url.searchParams.has("page_token")) return new Response("outage",{status:503})
    let data:any
    const wanted=(url.searchParams.get("symbols")??"").split(",").filter(Boolean)
    if(url.pathname.includes("/bars")) {
        const rowsKey=new URL(url);rowsKey.searchParams.delete("page_token")
        const all=(denseMode?denseRowsCache.get(rowsKey.href):undefined) ?? wanted.flatMap(s=>unknownSymbols.has(s)?[]:bars(s,url.searchParams.get("timeframe")??"1Day").filter(b=>b.t >= (url.searchParams.get("start")??"") && b.t <= (url.searchParams.get("end")??"9999")).map(b=>({s,b})))
        if(denseMode)denseRowsCache.set(rowsKey.href,all)
        const offset=Number(url.searchParams.get("page_token")??0),limit=Math.min(pageSize,Number(url.searchParams.get("limit")??1000))
        const page=all.slice(offset,offset+limit),result:Record<string,unknown[]>={}
        for(const {s,b} of page)(result[s]??=[]).push(b)
        data={bars:result,...(offset+limit<all.length?{next_page_token:failure==="repeat"?"0":String(offset+limit)}:{})}
        if(failure==="malformed") data={bars:{[wanted[0]]:[{t:"bad",c:1}]}}
    } else if(url.pathname.includes("snapshots")) {
        data=Object.fromEntries(wanted.filter(s=>!unknownSymbols.has(s)).map(s=>[s,{latestTrade:{p:100,t:new Date(Date.now()-1000).toISOString()},dailyBar:{o:99,c:100,t:new Date(NOW).toISOString()},prevDailyBar:{c:99,t:new Date(NOW-86400000).toISOString()}}]))
        if(url.pathname.includes("crypto"))data={snapshots:data}
    } else if(url.pathname==="/v2/assets")data=symbols(120).concat(["AAPL","MSFT"]).map(s=>({symbol:s,status:"active"}))
    else if(url.pathname.startsWith("/v2/assets/"))data={name:"Fake name",symbol:url.pathname.split("/").at(-1),status:"active"}
    else if(url.pathname.includes("company_tickers"))data=Object.fromEntries(symbols(120).concat(["AAPL","MSFT"]).map((s,i)=>[i,{ticker:s,cik_str:i+1}]))
    else if(url.pathname.includes("submissions/CIK0000320193"))data={cik:320193,name:"Apple Inc.",tickers:["AAPL"],sic:"3571",sicDescription:"Electronic Computers"}
    else if(url.pathname.includes("companyfacts"))data=factDoc
    else if(url.pathname.includes("corporate-actions"))data={corporate_actions:{cash_dividends:[]}}
    else throw new Error(`Unhandled fake path ${url.pathname}`)
    counts.bytes+=JSON.stringify(data).length
    if(ttl>0)fetchCache.set(key,{at:Date.now(),data})
    return Response.json(data)
}
function baseline() {
    const loaded=new Map<string,any>()
    function load(path:string):any {
        if(loaded.has(path))return loaded.get(path)
        const source=(baselineSources as Record<string,string>)[path]
        if(!source)throw new Error(`Missing baseline source ${path}`)
        const module={exports:{} as any};loaded.set(path,module.exports)
        const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
        new Function("require","module","exports",js)((id:string)=>id==="next/server"?{NextRequest,NextResponse}:id.startsWith("@/")?load(id.slice(2)+".ts"):(()=>{throw new Error(id)})(),module,module.exports)
        return module.exports
    }
    return load
}
const request=(path:string)=>new NextRequest(`https://fake.invalid${path}`)
beforeEach(()=>{vi.resetModules();durable.clear();cacheSize.max=0;cacheSize.rejected=0;cacheSize.writes=0;cacheSize.failAt=0;resetProvider();vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(NOW);vi.stubEnv("ALPACA_API_KEY_ID","offline-fixture");vi.stubEnv("ALPACA_API_SECRET_KEY","offline-fixture");vi.stubEnv("SEC_CONTACT","offline fixture");vi.stubGlobal("fetch",vi.fn(fakeFetch))})
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals()})

describe("public protocol",()=>{
    it("advertises without any provider sends and rejects >120",async()=>{
        const cap=await import("@/app/api/market-capabilities/route");expect((await cap.GET().then(r=>r.json())).schemaVersion).toBe(1)
        expect(counts.alpacaData+counts.sec+counts.alpacaTrading).toBe(0)
        const route=await import("@/app/api/history-batch/route");expect((await route.GET(request(`/api/history-batch?symbols=${symbols(121)}`))).status).toBe(400)
    })
    it("classification fetches only SEC issuer metadata, facts remain SEC-only and durable",async()=>{
        const {factsBatch}=await import("../facts")
        const c=await factsBatch(["AAPL","QQQ","UNKNOWN"],"classification")
        expect(Object.keys(c.results)).toHaveLength(3);expect(counts.sec).toBe(2);expect(counts.alpacaData+counts.alpacaTrading).toBe(0);expect((c.results.AAPL as any).analysisClassification.status).toBe("classified")
        const f:any=await factsBatch(["AAPL"],"facts");expect(f.results.AAPL.raw.epsTTM).toBe(5.555);expect(f.results.AAPL.raw.dividendsPerShareTTM).toBe(1)
        expect(counts.alpacaData+counts.alpacaTrading).toBe(0);expect(counts.sec).toBe(3)
        const stamp=f.results.AAPL.fetchedAt;vi.setSystemTime(NOW+10000);vi.resetModules()
        const again:any=await(await import("../facts")).factsBatch(["AAPL"],"facts");expect(again.results.AAPL.fetchedAt).toBe(stamp);expect(counts.sec).toBe(3)
    })
    it("keeps legacy stock P/E and yield formulas with currency guards",async()=>{
        const old=baseline()("lib/investing/fundamentals.ts").fundamentalsFrom(factDoc,100)
        const {factsBatch}=await import("../facts");const f:any=await factsBatch(["AAPL"],"facts")
        expect((100/f.results.AAPL.raw.epsTTM).toFixed(2)).toBe(old.peRatio.toFixed(2))
        expect(f.results.AAPL.raw.dividendsPerShareTTM/100*100).toBe(old.dividendYield)
    })
    it("accounts for every100 symbols and joins same-process overlap with preserved expiry",async()=>{
        delayMs=1
        const {historyBatch}=await import("../history")
        const [a,b]=await Promise.all([historyBatch(symbols(100),"1Y",null,"split"),historyBatch(symbols(10,5),"1Y",null,"split")])
        expect(Object.keys(a.results)).toHaveLength(100);expect(Object.keys(b.results)).toHaveLength(10);expect(counts.alpacaData).toBe(4);expect(counts.peak).toBeLessThanOrEqual(2)
        const prior=a.results.S005;vi.setSystemTime(NOW+10000)
        const warm=await historyBatch(symbols(10,5),"1Y",null,"split")
        expect(warm.results.S005.fetchedAt).toBe(prior.fetchedAt);expect(warm.results.S005.expiresAt).toBe(prior.expiresAt);expect(counts.alpacaData).toBe(4)
    })
    it("follows short pages, isolates adjustment and cannot silently truncate",async()=>{
        pageSize=100
        const {historyBatch}=await import("../history")
        const a=await historyBatch(symbols(10),"1Y",null,"split")
        expect(Object.keys(a.results)).toHaveLength(10);expect(a.results.S009.points).toHaveLength(270);expect(counts.alpacaData).toBe(27)
        await historyBatch(symbols(10),"1Y",null,"all");expect(counts.alpacaData).toBe(54)
    })
    it.each(["repeat","second","malformed","outage"])("does not publish complete history on %s",async f=>{
        pageSize=100;failure=f
        const {historyBatch}=await import("../history");const r=await historyBatch(symbols(10),"1Y",null,"split")
        expect(Object.keys(r.results)).toHaveLength(0);expect(Object.keys(r.unavailable)).toHaveLength(10)
        failure=null;const retry=await historyBatch(symbols(10),"1Y",null,"split");expect(Object.keys(retry.results)).toHaveLength(10)
    })
    it("quote metadata preserves missing-move prices without breaking stats and names0 skips assets",async()=>{
        const route=await import("@/app/api/market-stats/route")
        const r=await route.GET(request(`/api/market-stats?symbols=${symbols(100)}&names=0`)).then(r=>r.json())
        expect(r.stats).toHaveLength(100);expect(Object.keys(r.metadataBySymbol)).toHaveLength(100)
        expect(counts.alpacaData).toBe(1);expect(counts.alpacaTrading).toBe(1)
        const before=r.metadataBySymbol.S000;vi.setSystemTime(NOW+10000)
        const warm=await route.GET(request(`/api/market-stats?symbols=${symbols(10)}&names=0`)).then(r=>r.json())
        expect(warm.metadataBySymbol.S000.expiresAt).toBe(before.expiresAt);expect(counts.alpacaData).toBe(1)
    })
    it("retries429 within bound and exposes unknown symbols rather than0",async()=>{
        retryOnce=true;unknownSymbols.add("S005")
        const {historyBatch}=await import("../history");const r=await historyBatch(symbols(10),"1Y",null,"split")
        expect(counts.alpacaData).toBe(2);expect(r.unavailable.S005.status).toBe("no-data");expect(Object.keys(r.results)).toHaveLength(9)
    })
    it("fresh bucket refreshes and canonical durable chunks survive process restart",async()=>{
        let {historyBatch}=await import("../history");const a=await historyBatch(symbols(10),"1Y",null,"split")
        vi.resetModules();historyBatch=(await import("../history")).historyBatch
        const b=await historyBatch(symbols(10),"1Y",null,"split");expect(counts.alpacaData).toBe(1);expect(b.results.S000.expiresAt).toBe(a.results.S000.expiresAt)
        await historyBatch(symbols(10,5),"1Y",null,"split");expect(counts.alpacaData).toBe(2) // cross-instance differently overlapping chunks can miss
        vi.setSystemTime(NOW+61000);await historyBatch(symbols(10),"1Y",null,"split");expect(counts.alpacaData).toBe(3)
    })
})

describe("legacy math parity and currentSession",()=>{
    function row(stamp:number,c=100){return{t:new Date(stamp).toISOString(),c,o:c,h:c,l:c,v:1}}
    it("golden legacy points/session/previousClose parity with extra current-session only",async()=>{
        const prior=Array.from({length:12},(_,i)=>row(Date.parse("2026-11-10T15:00:00Z")+i*300000))
        const today=[row(NOW-300000),row(NOW-100000)]
        const timed={value:[...prior,...today],fetchedAt:NOW/1000,expiresAt:NOW/1000+60}
        const {processHistory}=await import("../history")
        const r=processHistory("AAPL","1D",timed,4,NOW/1000)
        expect(r.session).toBe("2026-11-10");expect(r.points).toHaveLength(12);expect(r.previousClose).toBe(null)
        expect(r.currentSession?.session).toBe("2026-11-11");expect(r.currentSession?.points).toHaveLength(2);expect(counts.alpacaData).toBe(0)
        const old=baseline()("app/api/candles/route.ts")
        vi.stubGlobal("fetch",async()=>Response.json({bars:{AAPL:timed.value}}))
        const expected=await old.GET(request("/api/candles?symbol=AAPL&range=1D")).then((r:Response)=>r.json())
        expect(r.points).toEqual(expected.points);expect(r.session).toEqual(expected.session);expect(r.previousClose).toEqual(expected.previousClose)
    })
    it("omits currentSession for onebar, future, prior-only, expiry or NY midnight",async()=>{
        const {processHistory}=await import("../history")
        for(const rows of [[row(NOW-1000)],[row(NOW+1000),row(NOW+2000)],[row(NOW-86400000),row(NOW-86000000)]]) {
            expect(processHistory("AAPL","1D",{value:rows,fetchedAt:NOW/1000,expiresAt:NOW/1000+60},4,NOW/1000).currentSession).toBeUndefined()
        }
        const rows=[row(NOW-1000),row(NOW-2000)]
        expect(processHistory("AAPL","1D",{value:rows,fetchedAt:NOW/1000,expiresAt:NOW/1000},4,NOW/1000).currentSession).toBeUndefined()
        const midnight=Date.parse("2026-11-12T05:00:00Z")/1000
        expect(processHistory("AAPL","1D",{value:rows,fetchedAt:midnight,expiresAt:midnight+60},4,midnight).currentSession).toBeUndefined()
    })
})

it("records actual immutable-baseline vs candidate fake-provider counts10/100",async()=>{
    const report:any[]=[]
    for(const n of [10,100]) {
        resetProvider();vi.resetModules();durable.clear();vi.setSystemTime(NOW);delayMs=1
        const old=baseline(),candle=old("app/api/candles/route.ts"),stock=old("app/api/stock/route.ts"),quote=old("app/api/market-stats/route.ts")
        const wanted=symbols(n)
        for(let i=0;i<n;i+=6)await quote.GET(request(`/api/market-stats?symbols=${wanted.slice(i,i+6)}`))
        for(const s of wanted){await candle.GET(request(`/api/candles?symbol=${s}&range=1Y`));await stock.GET(request(`/api/stock?symbol=${s}`))}
        const before={...counts}
        for(let user=1;user<=5;user++){
            vi.setSystemTime(NOW+user*10000)
            for(let i=0;i<n;i+=6)await quote.GET(request(`/api/market-stats?symbols=${wanted.slice(i,i+6)}`))
            for(const symbol of wanted){await candle.GET(request(`/api/candles?symbol=${symbol}&range=1Y`));await stock.GET(request(`/api/stock?symbol=${symbol}`))}
        }
        const beforeFiveWarmUsers={...counts}
        resetProvider();vi.resetModules();durable.clear();vi.setSystemTime(NOW);delayMs=1
        const {historyBatch}=await import("../history"),{factsBatch}=await import("../facts"),q=await import("@/app/api/market-stats/route")
        await q.GET(request(`/api/market-stats?symbols=${wanted}&names=0`));const h=await historyBatch(wanted,"1Y",null,"split");await factsBatch(wanted,"facts")
        const after={...counts};const stamp=h.results.S000.expiresAt
        for(let user=1;user<=5;user++){vi.setSystemTime(NOW+user*10000);await q.GET(request(`/api/market-stats?symbols=${wanted}&names=0`));await historyBatch(wanted,"1Y",null,"split");await factsBatch(wanted,"facts")}
        const warm={...counts}
        expect(counts).toEqual(warm);expect(warm.alpacaData).toBe(after.alpacaData);expect(warm.sec).toBe(after.sec)
        expect(Object.keys(h.results)).toHaveLength(n);expect(h.results.S000.expiresAt).toBe(stamp)
        report.push({n,scenario:"quotes names default + main1Y + analysis stock; after names0 + shared1Y + SECfacts",before,beforeFiveWarmUsers,after,afterFiveWarmUsers:warm,coverage:Object.keys(h.results).length})
    }
    writeFileSync("/private/tmp/finnacalc-api-opt-provider-counters.json",JSON.stringify(report,null,2))
    console.log(JSON.stringify(report))
},20000)

it("handles SEC failure/recovery, no-data and foreigncurrency without fake ratios",async()=>{
    let {factsBatch}=await import("../facts")
    failure="outage";const failed=await factsBatch(["AAPL"],"facts")
    expect(failed.unavailable.AAPL.status).toBe("unavailable");expect(failed.results.AAPL).toBeUndefined()
    failure=null;const backedOff:any=await factsBatch(["AAPL"],"facts")
    expect(backedOff.unavailable.AAPL.status).toBe("unavailable")
    vi.setSystemTime(NOW+120001)
    const recovered:any=await factsBatch(["AAPL","UNKNOWN"],"facts")
    expect(recovered.results.AAPL.raw.epsTTM).toBe(5.555);expect(recovered.results.UNKNOWN.status).toBe("no-data")
    vi.resetModules();durable.clear();fetchCache.clear()
    const foreign=JSON.parse(JSON.stringify(factDoc).replaceAll('USD','EUR'))
    vi.stubGlobal("fetch",async(input:any,init:any)=>String(input).includes("companyfacts")?Response.json(foreign):fakeFetch(input,init))
    factsBatch=(await import("../facts")).factsBatch
    const result:any=await factsBatch(["AAPL"],"facts")
    expect(result.results.AAPL.issuerCurrency).toBe("EUR");expect(result.results.AAPL.raw.epsTTM).toBeNull();expect(result.results.AAPL.raw.dividendsPerShareTTM).toBeNull()
})

it("shares viewer quotes after caller cancellation without transferring abort to other consumers",async()=>{
    delayMs=5
    const {viewerQuotes}=await import("../quotes")
    const controller=new AbortController()
    const a=viewerQuotes(symbols(10)),b=viewerQuotes(symbols(10));controller.abort()
    const [x,y]=await Promise.all([a,b]);expect(Object.keys(x.quotes)).toHaveLength(10);expect(y.quotes.S009.price).toBe(100);expect(counts.alpacaData).toBe(1)
    // Public acquisition deliberately accepts no caller AbortSignal. Native removes its
    // own interest; provider work required by a remaining caller is never cancelled.
})

it("missing previousClose retains valid price metadata while legacy stats omit row",async()=>{
    const original=fakeFetch
    vi.stubGlobal("fetch",async(input:any,init:any)=>{
        const r=await original(input,init)
        if(String(input).includes("snapshots")) {const data=await r.json();for(const s of Object.keys(data))delete data[s].prevDailyBar;return Response.json(data)}
        return r
    })
    const route=await import("@/app/api/market-stats/route")
    const r=await route.GET(request("/api/market-stats?symbols=S000&names=0")).then(r=>r.json())
    expect(r.stats).toHaveLength(0);expect(r.metadataBySymbol.S000.price).toBe(100);expect(r.metadataBySymbol.S000.changePct).toBeNull()
})

it("does not turn dividend outage/later-page failure into successful noRecord",async()=>{
    const {cashDividends}=await import("@/lib/alpaca")
    vi.stubGlobal("fetch",async(input:any)=>new URL(String(input)).searchParams.has("page_token")?new Response("outage",{status:503}):Response.json({corporate_actions:{cash_dividends:[{symbol:"AAPL",rate:1}]},next_page_token:"next"}))
    await expect(cashDividends(["AAPL"],new Date(NOW-86400000),new Date(NOW))).rejects.toThrow("unavailable")
})

it.each(["1D","1W","1M","1Y","5Y","ALL","BOGUS"])("preserves legacy processed %s fields",async range=>{
    const old=baseline()("app/api/candles/route.ts")
    const legacy=await old.GET(request(`/api/candles?symbol=AAPL&range=${range}`)).then((r:Response)=>r.json())
    const {historyBatch}=await import("../history")
    const batch=await historyBatch(["AAPL"],range,null,"split")
    const candidate=batch.results.AAPL
    expect(candidate.points).toEqual(legacy.points);expect(candidate.range).toBe(legacy.range);expect(candidate.session).toBe(legacy.session);expect(candidate.previousClose).toBe(legacy.previousClose)
    expect(candidate.coversAllHistory).toBe(legacy.coversAllHistory);expect(candidate.earliest).toBe(legacy.earliest)
})

it("does not label unsupported quote currencies USD or acquire nonUSDhistory",async()=>{
    const {viewerQuotes}=await import("../quotes"),{historyBatch}=await import("../history")
    const q=await viewerQuotes(["BTCUSDT"])
    expect(q.quotes.BTCUSDT.currency).toBe("USDT")
    const count=counts.alpacaData
    const h=await historyBatch(["BTCUSDT"],"1D",null,"split")
    expect(h.unavailable.BTCUSDT.status).toBe("unsupported");expect(counts.alpacaData).toBe(count)
})

it("reuses original60s acquisition across minute rollover without renewing age",async()=>{
    vi.setSystemTime(NOW+59000)
    const {historyBatch}=await import("../history"),{viewerQuotes}=await import("../quotes")
    const h=await historyBatch(symbols(10),"1Y",null,"split"),q=await viewerQuotes(symbols(10))
    expect(h.results.S000.expiresAt-h.results.S000.fetchedAt).toBe(60)
    const sends=counts.alpacaData
    vi.setSystemTime(NOW+61000)
    const h2=await historyBatch(symbols(10),"1Y",null,"split"),q2=await viewerQuotes(symbols(10))
    expect(counts.alpacaData).toBe(sends);expect(h2.results.S000.expiresAt).toBe(h.results.S000.expiresAt);expect(q2.quotes.S000.expiresAt).toBe(q.quotes.S000.expiresAt)
})

it("rejects malformed dividend collection rather than successful noRecord",async()=>{
    const {cashDividends}=await import("@/lib/alpaca")
    vi.stubGlobal("fetch",async()=>Response.json({corporate_actions:{cash_dividends:"bad"}}))
    await expect(cashDividends(["AAPL"],new Date(NOW-86400000),new Date(NOW))).rejects.toThrow("Malformed")
})


it("durably caches dense25/100-symbol histories below actual Next entry byte budget",async()=>{
    const report:any[]=[]
    for(const n of [25,100]) for(const scenario of [{range:"1D",interval:null},{range:"1D",interval:"1min"},{range:"1Y",interval:null}]) {
        resetProvider();denseMode=true;vi.resetModules();durable.clear();cacheSize.max=0;cacheSize.rejected=0;cacheSize.writes=0
        const {historyBatch,processHistory}=await import("../history")
        const wanted=symbols(n)
        const first=await historyBatch(wanted,scenario.range,scenario.interval,"split")
        const cold=counts.alpacaData,original=first.results.S000
        expect(Object.keys(first.results)).toHaveLength(n);expect(Object.keys(first.unavailable)).toHaveLength(0)
        const raw=bars("S000",scenario.interval==="1min" ? "1Min":scenario.range==="1D"?"5Min":"1Day")
        const expected=processHistory("S000",scenario.range,{value:raw,fetchedAt:NOW/1000,expiresAt:NOW/1000+60},scenario.range==="1D"?4:370,NOW/1000)
        for(const symbol of wanted)expect(first.results[symbol].points).toEqual(expected.points)
        expect(first.results[wanted[n-1]].points.at(-1)?.t).toBe(expected.points.at(-1)?.t)
        expect(cacheSize.rejected).toBe(0);expect(cacheSize.max).toBeLessThanOrEqual(1024*1024)
        vi.resetModules()
        const restart=await(await import("../history")).historyBatch(wanted,scenario.range,scenario.interval,"split")
        expect(counts.alpacaData).toBe(cold);expect(Object.keys(restart.results)).toHaveLength(n);expect(restart.unavailable).toEqual({})
        expect(restart.results[wanted[n-1]].points).toEqual(first.results[wanted[n-1]].points)
        expect(restart.results.S000.fetchedAt).toBe(original.fetchedAt);expect(restart.results.S000.expiresAt).toBe(original.expiresAt)
        report.push({symbols:n,...scenario,coldProviderPages:cold,warmRestartAdditionalPages:counts.alpacaData-cold,coverage:Object.keys(restart.results).length,rawObservationsPerSymbol:raw.length,processedObservationsPerSymbol:expected.points.length,maxNextEntryBytes:cacheSize.max,rejectedWrites:cacheSize.rejected,durableEntries:durable.size})
    }
    writeFileSync("/private/tmp/finnacalc-api-opt-cache-size-counters.json",JSON.stringify(report,null,2))
},120000)


it("fragments a large single-symbol32day minute history without point loss",async()=>{
    denseMode=true;denseDays=32
    const {historyBatch}=await import("../history")
    const a=await historyBatch(["S000"],"1M","1min","split")
    expect(a.results.S000.points).toHaveLength(32*1440)
    expect(counts.alpacaData).toBe(5)
    expect(cacheSize.max).toBeLessThanOrEqual(1024*1024);expect(cacheSize.rejected).toBe(0)
    vi.resetModules()
    const b=await(await import("../history")).historyBatch(["S000"],"1M","1min","split")
    expect(counts.alpacaData).toBe(5);expect(b.results.S000.points).toEqual(a.results.S000.points)
    expect(b.results.S000.expiresAt).toBe(a.results.S000.expiresAt)
},30000)

it("does not publish a manifest or partial success after a fragment write failure",async()=>{
    denseMode=true;cacheSize.failAt=2
    const {historyBatch}=await import("../history")
    const a=await historyBatch(symbols(25),"1D","1min","split")
    expect(a.results).toEqual({});expect(Object.keys(a.unavailable)).toHaveLength(25)
    expect([...durable.values()].some((v:any)=>v?.format==="fragments")).toBe(false)
    cacheSize.failAt=0
    const b=await historyBatch(symbols(25),"1D","1min","split")
    expect(Object.keys(b.results)).toHaveLength(25);expect(b.unavailable).toEqual({})
    const sends=counts.alpacaData
    vi.resetModules()
    const c=await(await import("../history")).historyBatch(symbols(25),"1D","1min","split")
    expect(counts.alpacaData).toBe(sends);expect(c.results.S024.points).toEqual(b.results.S024.points)
},30000)

it("budgets escaped Unicode payloads using the outer Next serialization",async()=>{
    const value=('\\\"\u0000🙂').repeat(150000)
    let loads=0
    const {publicMany}=await import("../cache")
    const a=await publicMany(["S000"],"escaped-fixture",60,async()=>{loads++;return{S000:value}})
    expect(a.S000.value).toBe(value);expect(cacheSize.max).toBeLessThanOrEqual(1024*1024);expect(cacheSize.rejected).toBe(0)
    vi.resetModules()
    const b=await(await import("../cache")).publicMany(["S000"],"escaped-fixture",60,async()=>{loads++;return{S000:value}})
    expect(b.S000.value).toBe(value);expect(loads).toBe(1);expect(b.S000.expiresAt).toBe(a.S000.expiresAt)
})
