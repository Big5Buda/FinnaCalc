import { symbolProfile, CURATED_ETFS, MARKET_INDEX_ETFS } from "@/lib/investing/catalog"
import { fundamentalsFrom, NO_FUNDAMENTALS, reportingCurrency } from "@/lib/investing/fundamentals"
import { SEC_HEADERS } from "@/lib/sec"
import { bucket, limitedSEC, mapBounded, publicMany } from "./cache"
import type { Unavailable } from "./protocol"

async function readSEC<T>(url:string):Promise<{status:"ok";data:T}|{status:"no-data"}> {
    return limitedSEC(async()=>{
        const response=await fetch(url,{headers:SEC_HEADERS,cache:"no-store",signal:AbortSignal.timeout(10000)})
        if(response.status===404)return {status:"no-data"}
        if(!response.ok)throw new Error("SEC unavailable.")
        return {status:"ok",data:await response.json() as T}
    })
}
function labels(symbol:string) {
    const p = symbolProfile(symbol)
    const etf = [...CURATED_ETFS,...MARKET_INDEX_ETFS].find(s=>s.symbol === symbol)
    return { symbol, name:p?.name ?? etf?.name ?? null, sector:p?.sector ?? null,
        industry:null, beta:null, high52:null, low52:null }
}
function raw(base: typeof NO_FUNDAMENTALS) {
    return { epsTTM:base.epsTTM, dividendsPerShareTTM:base.dividendsPerShareTTM, sharesOutstanding:base.sharesOutstanding,
        netMargin:base.netMargin, grossMargin:base.grossMargin, revenueGrowth:base.revenueGrowth }
}
type RawIssuer = { raw:ReturnType<typeof raw>; issuerCurrency:string|null; fiscalYear:number|null; sharesAsOf:string|null; status:string; provenance:Record<string,string> }
export async function factsBatch(symbols:string[], mode:string, now=Date.now()/1000) {
    const deadline=Date.now()+35000
    const results: Record<string, unknown> = {}
    const unavailable: Record<string, Unavailable> = {}
    await mapBounded(symbols,2,async symbol=>{
        const label = labels(symbol)
        if (mode === "classification") {
            results[symbol] = { ...label, raw:raw(NO_FUNDAMENTALS), issuerCurrency:null, fiscalYear:null, sharesAsOf:null,
                status:"no-data", source:"curated catalog", asOf:null, fetchedAt:bucket(now,86400), expiresAt:bucket(now,86400)+86400, provenance:{} }
            return
        }
        try {
            if(Date.now()>deadline)throw new Error("Facts acquisition deadline exceeded.")
            const value = await publicMany<RawIssuer>([symbol],"SEC raw issuer facts v1",86400,async()=>{
                const ticker = await publicMany<Record<string,{ticker:string;cik_str:number}>>(["map"],"SEC ticker map v1",604800,async()=>{
                    const result=await readSEC<Record<string,{ticker:string;cik_str:number}>>("https://www.sec.gov/files/company_tickers.json")
                    if(result.status!=="ok" || !result.data || typeof result.data!=="object" || Array.isArray(result.data)) throw new Error("SEC ticker map unavailable.")
                    return {map:result.data}
                },now)
                const candidates=[symbol,symbol.replace(/\./g,"-")]
                const issuer=Object.values(ticker.map.value).find(row=>row && candidates.includes(row.ticker) && Number.isInteger(row.cik_str) && row.cik_str>0)
                if (!issuer) return { [symbol]: { raw:raw(NO_FUNDAMENTALS), issuerCurrency:null, fiscalYear:null, sharesAsOf:null, status:"no-data", provenance:{} } }
                const cik = String(issuer.cik_str).padStart(10,"0")
                const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
                // Raw documents can exceed Next's2MB entry limit. Cache the SMALL derived result above,
                // not the multi-MB document. Network failures throw and never poison durable cache.
                const facts = await readSEC<any>(sourceUrl)
                if (facts.status !== "ok") return { [symbol]: {raw:raw(NO_FUNDAMENTALS),issuerCurrency:null,fiscalYear:null,sharesAsOf:null,status:"no-data",provenance:{cik,sourceUrl}} }
                if (!facts.data || typeof facts.data !== "object" || !facts.data.facts || typeof facts.data.facts !== "object") throw new Error("Malformed SEC facts.")
                const base = fundamentalsFrom(facts.data,null)
                const gaap = facts.data.facts["us-gaap"]
                const hasCurrency = gaap && Object.values(gaap).some((node:any)=>Object.keys(node?.units ?? {}).some(unit=>/^[A-Z]{3}$/.test(unit)))
                const issuerCurrency = hasCurrency ? reportingCurrency(gaap) : null
                if (issuerCurrency !== "USD") { base.epsTTM=null; base.dividendsPerShareTTM=null }
                return { [symbol]: { raw:raw(base), issuerCurrency, fiscalYear:base.fiscalYear, sharesAsOf:base.sharesAsOf,
                    status:Object.values(raw(base)).some(value=>value!==null) ? "ok" : "no-data", provenance:{ cik, sourceUrl,
                        sharesUnit:"shares", epsUnit:"USD/share", dividendsUnit:"USD/share", marginUnit:"percent" } } }
            },now)
            const entry=value[symbol]
            results[symbol]={ ...label, ...entry.value, source:"SEC company facts + curated catalog", asOf:null,
                fetchedAt:entry.fetchedAt, expiresAt:entry.expiresAt }
        } catch { unavailable[symbol]={status:"unavailable",reason:"Issuer facts unavailable. Classification can be requested separately."} }
    })
    return { schemaVersion:1,requested:symbols,results,unavailable }
}
