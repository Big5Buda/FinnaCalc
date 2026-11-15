import { SEC_HEADERS } from '@/lib/sec'
import { limitedSEC, publicMany } from './cache'

export const normalizedSECTicker = (symbol:string) => symbol.trim().toUpperCase().replace(/\./g,'-')
type TickerMap = Record<string,{ticker:string;cik_str:number}>
export type SECIssuer = {status:'found';cik:string}|{status:'missing'|'ambiguous'}
export function issuerFromTickerMap(symbol:string,map:TickerMap):SECIssuer {
    const ticker=normalizedSECTicker(symbol)
    const matches=Object.values(map).filter(row=>row&&typeof row.ticker==='string'&&normalizedSECTicker(row.ticker)===ticker)
    if(!matches.length)return {status:'missing'}
    if(matches.some(row=>!Number.isSafeInteger(row.cik_str)||row.cik_str<=0||row.cik_str>9999999999))return {status:'ambiguous'}
    const ciks=new Set(matches.map(row=>String(row.cik_str).padStart(10,'0')))
    return ciks.size===1?{status:'found',cik:[...ciks][0]}:{status:'ambiguous'}
}
let mapRetryAfter=0
export async function resolveSECIssuer(symbol:string,now=Date.now()/1000,deadline=Date.now()+35000):Promise<SECIssuer> {
    if(Date.now()>=deadline)throw new Error('SEC issuer deadline exceeded.')
    // Identical public ticker-map key/TTL shared with the existing facts path.
    if(Date.now()<mapRetryAfter)throw new Error('SEC ticker map retry backoff.')
    const ticker=await publicMany<TickerMap>(['map'],'SEC ticker map v1',604800,async()=>{
        const map=await limitedSEC(async()=>{
            if(Date.now()>=deadline)throw new Error('SEC issuer deadline exceeded.')
            const response=await fetch('https://www.sec.gov/files/company_tickers.json',{headers:SEC_HEADERS,cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.min(10000,deadline-Date.now())))})
            if(!response.ok)throw new Error('SEC ticker map unavailable.')
            const data=await response.json()
            if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('SEC ticker map malformed.')
            return data as TickerMap
        })
        return {map}
    },now).catch(error=>{mapRetryAfter=Date.now()+120000;throw error})
    mapRetryAfter=0
    if(Date.now()>=deadline)throw new Error('SEC issuer deadline exceeded.')
    return issuerFromTickerMap(symbol,ticker.map.value)
}
