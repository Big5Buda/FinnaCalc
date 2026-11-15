import { NextRequest } from 'next/server'
import { isAlpacaConfigured, publicMarketGet } from '@/lib/alpaca'
import { publicMany } from './cache'

export const DIVIDEND_V2_TYPES=['cash_dividend','forward_split','reverse_split','stock_dividend','unit_split','name_change'] as const
export const DIVIDEND_V2_TTL=21600
const arrays:Record<string,string>={cash_dividends:'cashDividend',forward_splits:'forwardSplit',reverse_splits:'reverseSplit',stock_dividends:'stockDividend',unit_splits:'unitSplit',name_changes:'nameChange'}
type Issue={code:string;symbol:string|null}
export interface CashDividendEventV2 {id:string;symbol:string;cusip:string|null;isin:string|null;type:'cashDividend';rate:string|null;currency:string|null;special:boolean|null;foreign:boolean|null;subType:'interest'|'return_of_capital'|null;unknownSubType:string|null;exDate:string|null;recordDate:string|null;payableDate:string|null;processDate:string|null;paymentState:'dateElapsed'|'futureDeclared'|'unknown';shareBasis:'providerRawUnattested';shareBasisAsOf:null;basisEvidenceUrl:null}
export interface ShareActionV2 {id:string;type:string;symbol:string|null;oldSymbol:string|null;newSymbol:string|null;oldCusip:string|null;newCusip:string|null;exDate:string|null;processDate:string|null;oldRate:string|null;newRate:string|null;rate:string|null}
interface Coverage {state:'available'|'partial'|'noRecord'|'unavailable';providerWindowTraversed:boolean;paymentTTMComplete:false;currencyVerified:boolean;currentShareBasisVerified:false;regularDistributionPolicy:'excludeSpecialInterestReturnOfCapital';reasons:string[]}
export interface DividendV2Data {query:{start:string;end:string;dateBasis:'processDate';region:'us';quality:'all';types:readonly string[]};pagination:{complete:boolean;pages:number;reason:string|null};events:CashDividendEventV2[];shareActions:ShareActionV2[];coverageBySymbol:Record<string,Coverage>;issues:Issue[]}
function text(v:unknown):string|null{return typeof v==='string'&&v.trim()?v.trim():null}
function object(v:unknown):v is Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v)}
function date(v:unknown):string|null{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:null}
/** Public rate parsing only; independent of all private brokerage modules. */
export function dividendRate(v:unknown):string|null {
    if(typeof v!=='string'&&typeof v!=='number'||typeof v==='number'&&!Number.isFinite(v))return null
    const m=String(v).match(/^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);if(!m)return null
    const digits=m[2]+(m[3]??''),power=Number(m[4]??0),point=m[2].length+power
    if(Math.abs(power)>38||digits.length>38)return null
    const expanded=point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point)
    const [w,f='']=expanded.split('.');const whole=w.replace(/^0+(?=\d)/,''),fraction=f.replace(/0+$/,'')
    if(whole.length+fraction.length>28||fraction.length>12)return null
    return (m[1]==='-'&&/[1-9]/.test(whole+fraction)?'-':'')+whole+(fraction?'.'+fraction:'')
}
function stable(v:unknown):string {if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v)??'null'}
export async function scanDividendEventsV2(symbols:string[],start:string,end:string,asOf:string,load:(query:URLSearchParams)=>Promise<unknown>):Promise<DividendV2Data>{
    const issues:Issue[]=[];const issue=(code:string,symbol:string|null)=>{if(!issues.some(i=>i.code===code&&i.symbol===symbol))issues.push({code,symbol})}
    const ids=new Map<string,{kind:string;raw:Record<string,unknown>;signature:string;symbols:string[]}>();const conflicts=new Set<string>();const tokens=new Set<string>(),pagesSeen=new Set<string>();let pages=0,complete=false,reason:string|null=null;let token:string|null=null
    const wanted=new Set(symbols);const associated=(raw:Record<string,unknown>)=>[...new Set([raw.symbol,raw.old_symbol,raw.new_symbol].map(text).filter((s):s is string=>s!==null).filter(s=>wanted.has(s)))]
    const deadline=Date.now()+20000
    for(let p=0;p<5;p++){
        if(Date.now()>=deadline){reason='acquisitionDeadline';break}
        const q=new URLSearchParams({symbols:symbols.join(','),types:DIVIDEND_V2_TYPES.join(','),start,end,region:'us',data_quality:'all',limit:'1000',sort:'asc'});if(token)q.set('page_token',token)
        const response=await load(q);pages++
        if(!object(response)||!object(response.corporate_actions)){reason='malformedPage';break}
        const body=response.corporate_actions;const signature=stable(body)
        if(pagesSeen.has(signature)){reason='repeatedPage';break}pagesSeen.add(signature)
        let count=0,malformed=false
        for(const [array,value]of Object.entries(body)){
            if(!Array.isArray(value)){malformed=true;continue}
            count+=value.length
            if(!(array in arrays)){if(value.length)malformed=true;continue}
            for(const raw of value){
                if(!object(raw)){malformed=true;continue}
                const names=associated(raw);const mark=(code:string)=>{if(names.length)for(const s of names)issue(code,s);else issue(code,null)}
                if(!names.length){mark('unattributedProviderRecord');continue}
                const id=text(raw.id);if(!id){mark('missingProviderID');continue}
                const fingerprint=stable({kind:arrays[array],raw:{...raw,id}});const prior=ids.get(id)
                if(prior&&prior.signature!==fingerprint){conflicts.add(id);for(const s of [...prior.symbols,...names])issue('conflictingProviderID',s);continue}
                if(!prior)ids.set(id,{kind:arrays[array],raw,signature:fingerprint,symbols:names})
            }
        }
        if(malformed||count>1000){reason='malformedActionArrays';break}
        const next=response.next_page_token
        if(next===null||next===undefined||next===''){complete=true;break}
        if(typeof next!=='string'||!next.trim()||tokens.has(next)||next===token){reason='paginationTokenDrift';break}
        if(!count){reason='emptyPageWithContinuation';break}
        tokens.add(next);token=next
    }
    if(!complete){reason??='pageBudgetExceeded';issue(reason,null)}
    const events:CashDividendEventV2[]=[],shareActions:ShareActionV2[]=[]
    for(const [id,entry]of ids){
        if(conflicts.has(id))continue
        const r=entry.raw;const mark=(code:string)=>{for(const s of entry.symbols)issue(code,s)}
        const processDate=date(r.process_date)
        if(!processDate||processDate<start||processDate>end)mark('processDateOutsideOrUnknown')
        if(entry.kind==='cashDividend'){
            const symbol=text(r.symbol);if(!symbol||!wanted.has(symbol)){mark('cashSymbolUnverified');continue}
            const rate=dividendRate(r.rate),currency=typeof r.currency==='string'&&/^[A-Z]{3}$/.test(r.currency)?r.currency:null
            const special=typeof r.special==='boolean'?r.special:null,foreign=typeof r.foreign==='boolean'?r.foreign:null
            const payableDate=date(r.payable_date),exDate=date(r.ex_date),sub=text(r.sub_type)
            if(rate===null||rate.startsWith('-')||!currency||special===null||foreign===null||!payableDate||!exDate||!text(r.cusip))mark('incompleteCashMetadata')
            if(sub&&sub!=='interest'&&sub!=='return_of_capital')mark('unknownCashSubtype')
            events.push({id,symbol,cusip:text(r.cusip),isin:text(r.isin),type:'cashDividend',rate,currency,special,foreign,subType:sub==='interest'||sub==='return_of_capital'?sub:null,unknownSubType:sub&&sub!=='interest'&&sub!=='return_of_capital'?sub:null,exDate,recordDate:date(r.record_date),payableDate,processDate,paymentState:payableDate?(payableDate<=asOf?'dateElapsed':'futureDeclared'):'unknown',shareBasis:'providerRawUnattested',shareBasisAsOf:null,basisEvidenceUrl:null})
        }else{
            const action:ShareActionV2={id,type:entry.kind,symbol:text(r.symbol),oldSymbol:text(r.old_symbol),newSymbol:text(r.new_symbol),oldCusip:text(r.old_cusip)??(entry.kind==='forwardSplit'?text(r.cusip):null),newCusip:text(r.new_cusip),exDate:date(r.ex_date),processDate,oldRate:dividendRate(r.old_rate),newRate:dividendRate(r.new_rate),rate:dividendRate(r.rate)}
            if(['forwardSplit','reverseSplit','unitSplit'].includes(entry.kind)&&(!action.oldRate||!action.newRate||Number(action.oldRate)<=0||Number(action.newRate)<=0))mark('incompleteSplitRatio')
            shareActions.push(action)
        }
    }
    events.sort((a,b)=>(a.payableDate??a.exDate??'').localeCompare(b.payableDate??b.exDate??'')||a.id.localeCompare(b.id));shareActions.sort((a,b)=>(a.exDate??a.processDate??'').localeCompare(b.exDate??b.processDate??'')||a.id.localeCompare(b.id))
    const coverageBySymbol:Record<string,Coverage>={}
    for(const s of symbols){const cash=events.filter(e=>e.symbol===s),reasons=[...new Set(issues.filter(i=>i.symbol===null||i.symbol===s).map(i=>i.code))];coverageBySymbol[s]={state:reasons.length?'partial':cash.length?'available':'noRecord',providerWindowTraversed:complete,paymentTTMComplete:false,currencyVerified:cash.length>0&&cash.every(e=>e.currency!==null)&&!reasons.length,currentShareBasisVerified:false,regularDistributionPolicy:'excludeSpecialInterestReturnOfCapital',reasons:[...reasons,'Process-date coverage does not prove a complete payment TTM.','Current share basis is unattested.']}}
    return {query:{start,end,dateBasis:'processDate',region:'us',quality:'all',types:DIVIDEND_V2_TYPES},pagination:{complete,pages,reason},events,shareActions,coverageBySymbol,issues}
}
class PartialTraversal extends Error {constructor(public value:DividendV2Data,public fetchedAt:number){super('Incomplete provider traversal')}}
export async function dividendEventsV2(symbols:string[],now=Date.now()/1000){
    const day=(n:number)=>new Date(n*1000).toISOString().slice(0,10),asOf=day(now),start=day(now-400*86400),end=day(now+120*86400)
    const key=JSON.stringify({schemaVersion:2,symbols,types:DIVIDEND_V2_TYPES,quality:'all',region:'us',start,end,asOf})
    try{
        const hit=await publicMany<DividendV2Data>([key],'Alpaca dividend events v2',DIVIDEND_V2_TTL,async()=>{
            const acquired=Date.now()/1000;const value=await scanDividendEventsV2(symbols,start,end,asOf,q=>publicMarketGet('https://data.alpaca.markets/v1/corporate-actions?'+q.toString()))
            if(!value.pagination.complete)throw new PartialTraversal(value,acquired)
            return {[key]:value}
        },now)
        return {data:hit[key].value,fetchedAt:hit[key].fetchedAt,expiresAt:hit[key].expiresAt}
    }catch(e){if(e instanceof PartialTraversal)return {data:e.value,fetchedAt:e.fetchedAt,expiresAt:e.fetchedAt};throw e}
}
export async function dividendEventsV2GET(request:NextRequest){
    const headers={'Cache-Control':'no-store'}
    if(!isAlpacaConfigured)return Response.json({error:'Market data is not configured.'},{status:503,headers})
    const symbols=[...new Set((request.nextUrl.searchParams.get('symbols')??'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))].sort()
    if(!symbols.length||symbols.length>1000||symbols.some(s=>! /^[A-Z0-9][A-Z0-9./^-]{0,24}$/.test(s)||['__PROTO__','CONSTRUCTOR','PROTOTYPE'].includes(s)))return Response.json({error:'Valid symbols are required.',maxSymbols:60},{status:400,headers})
    const requested=symbols.slice(0,60),truncated=symbols.slice(60)
    try{const result=await dividendEventsV2(requested);return Response.json({schemaVersion:2,requested,truncated,source:'Alpaca corporate actions',fetchedAt:result.fetchedAt,expiresAt:result.expiresAt,...result.data},{headers})}
    catch{return Response.json({error:'Corporate action data unavailable.',schemaVersion:2},{status:503,headers})}
}
