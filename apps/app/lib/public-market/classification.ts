import taxonomy from './data/analysis-taxonomy-v1.json'
import issuerPins from './data/analysis-issuer-pins-v1.json'
import { CURATED_ETFS, MARKET_INDEX_ETFS } from '@/lib/investing/catalog'
import { SEC_HEADERS } from '@/lib/sec'
import { limitedSEC, publicMany, type Timed } from './cache'
import { normalizedSECTicker, resolveSECIssuer } from './sec-issuer'
export interface AnalysisClassification {
    schemaVersion:1; securityId:null; assetType:string; status:'classified'|'unknown'|'ambiguous'|'unavailable';
    sectorId:string|null;industryId:string|null;industryLabel:string|null;taxonomyVersion:string;method:'secSic'|'none';
    rawSic:string|null;rawIndustry:string|null;cik:string|null;sourceUrl:string|null;asOf:null;checkedAt:number;reason:string|null;
}
export function industryForSIC(sic:unknown) {
    if(typeof sic!=='string'||!/^\d{3,4}$/.test(sic))return null
    const n=Number(sic);return taxonomy.rules.find(r=>r.sicRanges.some(([lo,hi])=>lo<=n&&n<=hi))??null
}
const quarantined=new Set(['XOM','HES','EA','WBD','PARA'])
const canonical=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9]/g,'')
export function classificationFromSubmission(symbol:string,pin:{cik:string;name?:string;sourceUrl:string},raw:any,checkedAt:number):AnalysisClassification {
    const base=empty(checkedAt);base.cik=pin.cik;base.sourceUrl=pin.sourceUrl
    if(!raw||String(raw.cik).padStart(10,'0')!==pin.cik||typeof raw.name!=='string'||!raw.name.trim()||(pin.name!==undefined&&canonical(raw.name)!==canonical(pin.name))||!Array.isArray(raw.tickers)||!raw.tickers.some((ticker:unknown)=>typeof ticker==='string'&&normalizedSECTicker(ticker)===normalizedSECTicker(symbol)))return {...base,status:'ambiguous',reason:'Current SEC issuer identity does not match the exact ticker and expected CIK/name.'}
    const rule=industryForSIC(raw.sic)
    return {...base,rawSic:typeof raw.sic==='string'?raw.sic:null,rawIndustry:typeof raw.sicDescription==='string'?raw.sicDescription:null,
        ...(rule?{status:'classified',sectorId:rule.sectorId,industryId:rule.id,industryLabel:rule.label,method:'secSic',reason:null}:{reason:'SEC SIC unavailable or outside the reviewed mapping.'})}
}
function empty(at:number):AnalysisClassification {return {schemaVersion:1,securityId:null,assetType:'unknown',status:'unknown',sectorId:null,industryId:null,industryLabel:null,taxonomyVersion:taxonomy.version,method:'none',rawSic:null,rawIndustry:null,cik:null,sourceUrl:null,asOf:null,checkedAt:at,reason:'No verified SEC issuer identity for this symbol.'}}
type ClassificationValue = {classification:AnalysisClassification;issuerName:string|null}
const failures=new Map<string,{until:number;entry:Timed<ClassificationValue>}>()
export async function analysisClassificationEntry(symbol:string,now=Date.now()/1000,deadline=Date.now()+35000):Promise<Timed<ClassificationValue>> {
    const local=(classification:AnalysisClassification):Timed<ClassificationValue>=>({value:{classification,issuerName:null},fetchedAt:now,expiresAt:now})
    if(quarantined.has(symbol))return local({...empty(now),status:'ambiguous',reason:'Catalog ticker/issuer continuity is quarantined for review.'})
    if([...CURATED_ETFS,...MARKET_INDEX_ETFS].some(e=>e.symbol===symbol))return local({...empty(now),assetType:'etf',reason:'Fund holdings classification is unavailable; ETF ingestion is disabled.'})
    const failure=failures.get(symbol)
    if(failure&&failure.until>now)return failure.entry
    let identity:{cik:string;name?:string;sourceUrl:string}|undefined=(issuerPins as Record<string,{cik:string;name:string;sourceUrl:string}>)[symbol]
    try {
        const entries=await publicMany<ClassificationValue>([symbol],'SEC analysis classification v2 '+taxonomy.version,86400,async()=>{
            if(Date.now()>=deadline)throw new Error('Classification deadline exceeded.')
            if(!identity){
                const resolved=await resolveSECIssuer(symbol,now,deadline)
                if(resolved.status!=='found')return {[symbol]:{classification:{...empty(Date.now()/1000),status:resolved.status==='ambiguous'?'ambiguous':'unknown',reason:resolved.status==='ambiguous'?'Exact SEC ticker maps to conflicting issuer identities.':'Exact ticker not found in SEC issuer map.'},issuerName:null}}
                identity={cik:resolved.cik,sourceUrl:`https://data.sec.gov/submissions/CIK${resolved.cik}.json`}
            }
            const pin=identity
            const result=await limitedSEC(async()=>{
                if(Date.now()>=deadline)throw new Error('Classification deadline exceeded.')
                const response=await fetch(pin.sourceUrl,{headers:SEC_HEADERS,cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.min(10000,deadline-Date.now())))})
                if(!response.ok)throw new Error('Classification source unavailable.')
                const raw=await response.json()
                if(Date.now()>=deadline)throw new Error('Classification deadline exceeded.')
                const classification=classificationFromSubmission(symbol,pin,raw,Date.now()/1000)
                return {classification,issuerName:classification.status!=='ambiguous'?raw.name.trim():null}
            })
            return {[symbol]:result}
        },now)
        failures.delete(symbol)
        return entries[symbol]
    }catch{
        const entry=local({...empty(now),status:'unavailable',cik:identity?.cik??null,sourceUrl:identity?.sourceUrl??null,reason:'SEC classification acquisition unavailable.'})
        failures.set(symbol,{until:now+120,entry});while(failures.size>256)failures.delete(failures.keys().next().value!)
        return entry
    }
}
export async function analysisClassification(symbol:string,now=Date.now()/1000):Promise<AnalysisClassification> {
    return (await analysisClassificationEntry(symbol,now)).value.classification
}
