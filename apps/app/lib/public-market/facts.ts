import { analysisClassificationEntry } from "./classification"
import { resolveSECIssuer } from "./sec-issuer"
import { symbolProfile, sectorById, CURATED_ETFS, MARKET_INDEX_ETFS } from "@/lib/investing/catalog"
import { fundamentalsFrom, NO_FUNDAMENTALS, reportingCurrency } from "@/lib/investing/fundamentals"
import { SEC_HEADERS } from "@/lib/sec"
import { limitedSEC, mapBounded, publicMany } from "./cache"
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
            const entry=await analysisClassificationEntry(symbol,now,deadline)
            const classification=entry.value.classification
            const sector=classification.status==="classified"&&classification.sectorId?sectorById(classification.sectorId)?.name??null:null
            results[symbol] = { ...label, name:entry.value.issuerName??label.name, sector:sector??label.sector, raw:raw(NO_FUNDAMENTALS), issuerCurrency:null, fiscalYear:null, sharesAsOf:null,
                analysisClassification:classification, status:"no-data", source:entry.value.issuerName?"SEC submissions + SIC taxonomy":"curated catalog", asOf:null, fetchedAt:entry.fetchedAt, expiresAt:entry.expiresAt, provenance:{} }
            return
        }
        try {
            if(Date.now()>deadline)throw new Error("Facts acquisition deadline exceeded.")
            const value = await publicMany<RawIssuer>([symbol],"SEC raw issuer facts v1",86400,async()=>{
                const issuer=await resolveSECIssuer(symbol,now,deadline)
                if (issuer.status!=='found') return { [symbol]: { raw:raw(NO_FUNDAMENTALS), issuerCurrency:null, fiscalYear:null, sharesAsOf:null, status:"no-data", provenance:{} } }
                const cik = issuer.cik
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
            results[symbol]={ ...label, ...entry.value, analysisClassification:null, source:"SEC company facts + curated catalog", asOf:null,
                fetchedAt:entry.fetchedAt, expiresAt:entry.expiresAt }
        } catch { unavailable[symbol]={status:"unavailable",reason:"Issuer facts unavailable. Classification can be requested separately."} }
    })
    return { schemaVersion:1,requested:symbols,results,unavailable }
}
