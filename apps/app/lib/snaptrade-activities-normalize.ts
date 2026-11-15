/** Private broker records only. No company distributions/current-share reconstruction. */
export type ActivityKind = 'dividend'|'substitute'|'reinvestment'|'stockDividend'|'tax'|'adjustment'|'other'
export interface ActivityRow {
    id:string; securityId:string|null; securityIdSource:'snaptradeUniversalSymbol'|null; symbol:string|null; kind:ActivityKind;
    date:string|null; dateBasis:'trade'|'settlement'|'unknown'; amount:string|null; currency:string|null;
    amountBasis:'brokerReported'; gross:null; withholding:null; net:null;
    relationId:string|null; includedInReceived:boolean; exclusionReason:string|null;
}
export type ActivityTotals = Record<string,{received:string|null;includedCount:number}>
const SCALE = BigInt('1000000000000')
export function decimal(value:unknown):string|null {
    if (typeof value!=='number' && typeof value!=='string') return null
    if (typeof value==='number' && !Number.isFinite(value)) return null
    const m=String(value).match(/^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
    if (!m) return null
    const power=Number(m[4]??0), digits=m[2]+(m[3]??''); const point=m[2].length+power
    if (!Number.isInteger(power)||Math.abs(power)>38||digits.length>38) return null
    const expanded=point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point)
    const [whole,fraction='']=expanded.split('.'); const w=whole.replace(/^0+(?=\d)/,''); const f=fraction.replace(/0+$/,'')
    if (f.length>12 || w.length+f.length>28) return null
    return (m[1]==='-' && (/[1-9]/.test(w+f))?'-':'')+w+(f?'.'+f:'')
}
function scaled(s:string):bigint { const neg=s.startsWith('-');const [w,f='']=s.replace(/^-/, '').split('.');const n=BigInt(w)*SCALE+BigInt(f.padEnd(12,'0'));return neg?-n:n }
function unscaled(n:bigint):string {const sign=n<BigInt(0)?'-':'';if(n<BigInt(0))n=-n;return sign+(n/SCALE).toString()+((n%SCALE)?'.'+(n%SCALE).toString().padStart(12,'0').replace(/0+$/,''):'')}
function text(v:unknown):string|null { return typeof v==='string' && v.trim() ? v.trim():null }
function day(v:unknown):string|null {
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v))return null
    if(v.length>10&&!Number.isFinite(Date.parse(v)))return null
    const d=v.slice(0,10);const parsed=new Date(d+'T00:00:00Z');return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===d?d:null
}
const kinds:Record<string,ActivityKind>={DIVIDEND:'dividend',SUBSTITUTE_DIVIDEND:'substitute',REI:'reinvestment',STOCK_DIVIDEND:'stockDividend',TAX:'tax',ADJUSTMENT:'adjustment'}
export function normalizeActivities(raw:Record<string,unknown>[],endDate?:string) {
    const rows:ActivityRow[]=[];const reasons=new Set<string>();let unresolvedCount=0
    const dividends=new Set(raw.filter(r=>String(r.type).toUpperCase()==='DIVIDEND').flatMap(r=>{const id=text(r.external_reference_id);return id?[id]:[]}))
    for(const r of raw){
        const type=typeof r.type==='string'?r.type.toUpperCase():'';const kind=kinds[type]??'other'
        const possible=kind==='dividend'||kind==='reinvestment'||((!type||kind==='adjustment'||kind==='other')&&/dividend|reinvest/i.test(String(r.description??'')))
        const id=text(r.id)
        if(!id){if(possible){unresolvedCount++;reasons.add('Dividend evidence has no stable provider ID.')}continue}
        const date=day(r.trade_date)??day(r.settlement_date);const dateBasis=day(r.trade_date)?'trade':date?'settlement':'unknown'
        const amount=decimal(r.amount);const c=r.currency as {code?:unknown}|null;const currency=typeof c?.code==='string'&&/^[A-Z]{3}$/.test(c.code)?c.code:null
        const relationId=text(r.external_reference_id);let exclusionReason:string|null=null
        const future=possible&&date!==null&&endDate!==undefined&&date>endDate
        const valid=kind==='dividend'&&amount!==null&&currency!==null&&date!==null&&!future
        if(future){unresolvedCount++;reasons.add('Dividend evidence is dated after the requested snapshot end.');exclusionReason='futureRecordedDate'}
        else if(kind==='dividend'&&!valid){unresolvedCount++;reasons.add('Dividend amount, currency or recorded date unavailable.');exclusionReason='incompleteDividend'}
        else if(kind==='reinvestment'&&(!relationId||!dividends.has(relationId))){unresolvedCount++;reasons.add('Unlinked reinvestment may represent a dividend.');exclusionReason='unresolvedReinvestment'}
        else if(possible&&kind!=='dividend'&&kind!=='reinvestment'){unresolvedCount++;reasons.add('Uncategorized dividend-related evidence.');exclusionReason='unresolvedDividendEvidence'}
        else if(!valid)exclusionReason=kind==='reinvestment'?'reinvestmentLeg':'notCashDividend'
        const symbol=r.symbol as {id?:unknown;symbol?:unknown}|null
        rows.push({id,securityId:text(symbol?.id),securityIdSource:text(symbol?.id)?'snaptradeUniversalSymbol':null,symbol:text(symbol?.symbol),kind,date,dateBasis,amount,currency,amountBasis:'brokerReported',gross:null,withholding:null,net:null,relationId,includedInReceived:valid,exclusionReason})
    }
    rows.sort((a,b)=>(b.date??'').localeCompare(a.date??'')||a.id.localeCompare(b.id))
    const totalsByCurrency:ActivityTotals={};const sums=new Map<string,bigint>()
    for(const r of rows)if(r.includedInReceived){const c=r.currency!;const total=totalsByCurrency[c]??={received:null,includedCount:0};total.includedCount++;sums.set(c,(sums.get(c)??BigInt(0))+scaled(r.amount!))}
    for(const [c,sum]of sums)totalsByCurrency[c].received=unresolvedCount?null:unscaled(sum)
    return {rows,totalsByCurrency,unresolvedCount,reasons:[...reasons]}
}
export class ActivityScanError extends Error {}
class Drift extends ActivityScanError {}
export async function scanActivities(load:(offset:number,endDate:string)=>Promise<unknown>,endDate:string) {
    for(let attempt=0;attempt<2;attempt++){
        try {
            let offset=0,total:number|null=null;const rows:Record<string,unknown>[]=[];const ids=new Set<string>()
            for(let page=0;page<20;page++){
                const raw=await load(offset,endDate) as {data?:unknown;pagination?:{total?:unknown;offset?:unknown;limit?:unknown}}
                if(!raw||!Array.isArray(raw.data)||!raw.data.every(r=>r&&typeof r==='object'&&!Array.isArray(r))||!raw.pagination)throw new ActivityScanError('Malformed activities page.')
                const p=raw.pagination
                if(!Number.isSafeInteger(p.total)||Number(p.total)<0||p.offset!==offset||p.limit!==1000||raw.data.length>1000)throw new Drift('Invalid activities pagination.')
                if(total!==null&&total!==p.total)throw new Drift('Activities changed during pagination.')
                total=Number(p.total)
                for(const r of raw.data as Record<string,unknown>[]){const id=text(r.id);if(id&&ids.has(id))throw new Drift('Repeated activity ID.');if(id)ids.add(id);rows.push({...r,id,external_reference_id:text(r.external_reference_id)})}
                offset+=raw.data.length
                if(offset>total)throw new Drift('Activities total mismatch.')
                if(offset===total)return normalizeActivities(rows,endDate)
                if(!raw.data.length)throw new Drift('Premature empty activities page.')
            }
            throw new ActivityScanError('Activity pagination budget exceeded.')
        }catch(e){if(e instanceof Drift&&attempt===0)continue;throw e}
    }
    throw new ActivityScanError('Incomplete activities scan.')
}
