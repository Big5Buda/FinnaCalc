import taxonomy from './data/analysis-taxonomy-v1.json'
import issuerPins from './data/analysis-issuer-pins-v1.json'
import { CURATED_ETFS, MARKET_INDEX_ETFS } from '@/lib/investing/catalog'
import { SEC_HEADERS } from '@/lib/sec'
import { limitedSEC, publicMany } from './cache'
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
export function classificationFromSubmission(symbol:string,pin:{cik:string;name:string;sourceUrl:string},raw:any,checkedAt:number):AnalysisClassification {
    const base=empty(checkedAt);base.cik=pin.cik;base.sourceUrl=pin.sourceUrl
    if(!raw||String(raw.cik).padStart(10,'0')!==pin.cik||typeof raw.name!=='string'||canonical(raw.name)!==canonical(pin.name)||!Array.isArray(raw.tickers)||!raw.tickers.includes(symbol))return {...base,status:'ambiguous',reason:'Current issuer identity does not match the reviewed catalog pin.'}
    const rule=industryForSIC(raw.sic)
    return {...base,rawSic:typeof raw.sic==='string'?raw.sic:null,rawIndustry:typeof raw.sicDescription==='string'?raw.sicDescription:null,
        ...(rule?{status:'classified',sectorId:rule.sectorId,industryId:rule.id,industryLabel:rule.label,method:'secSic',reason:null}:{reason:'SEC SIC unavailable or outside the reviewed mapping.'})}
}
function empty(at:number):AnalysisClassification {return {schemaVersion:1,securityId:null,assetType:'unknown',status:'unknown',sectorId:null,industryId:null,industryLabel:null,taxonomyVersion:taxonomy.version,method:'none',rawSic:null,rawIndustry:null,cik:null,sourceUrl:null,asOf:null,checkedAt:at,reason:'No reviewed issuer identity for this symbol.'}}
export async function analysisClassification(symbol:string,now=Date.now()/1000):Promise<AnalysisClassification> {
    if(quarantined.has(symbol))return {...empty(now),status:'ambiguous',reason:'Catalog ticker/issuer continuity is quarantined for review.'}
    if([...CURATED_ETFS,...MARKET_INDEX_ETFS].some(e=>e.symbol===symbol))return {...empty(now),assetType:'etf',reason:'Fund holdings classification is unavailable; ETF ingestion is disabled.'}
    const pin=(issuerPins as Record<string,{cik:string;name:string;sourceUrl:string}>)[symbol]
    if(!pin)return empty(now)
    try{
        const entries=await publicMany<AnalysisClassification>([symbol],'SEC analysis classification v1 '+taxonomy.version,86400,async()=>{
            const result=await limitedSEC(async()=>{
                const response=await fetch(pin.sourceUrl,{headers:SEC_HEADERS,cache:'no-store',signal:AbortSignal.timeout(10000)})
                if(!response.ok)throw new Error('Classification source unavailable.')
                return classificationFromSubmission(symbol,pin,await response.json(),Date.now()/1000)
            })
            return {[symbol]:result}
        },now)
        return entries[symbol].value
    }catch{return {...empty(now),status:'unavailable',cik:pin.cik,sourceUrl:pin.sourceUrl,reason:'SEC classification acquisition unavailable.'}}
}
