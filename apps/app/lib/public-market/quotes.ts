import { publicSnapshots,isCryptoSymbol,snapshotPrice,snapshotChange,FEED,toAlpacaCrypto } from "@/lib/alpaca"
import { publicMany,mapBounded } from "./cache"
import type { Unavailable } from "./protocol"
export async function viewerQuotes(symbols:string[], now=Date.now()/1000) {
    const quotes: Record<string,{price:number;change:number|null;changePct:number|null;asOf:number|null;isStale:boolean;fetchedAt:number;expiresAt:number;currency:string|null}>={}
    const unavailable:Record<string,Unavailable>={}
    const groups=[symbols.filter(s=>!isCryptoSymbol(s)),symbols.filter(isCryptoSymbol)].filter(s=>s.length)
    await mapBounded(groups,2,async group=>{
        try {
            const data=await publicMany(group,`quotes:${FEED}:${isCryptoSymbol(group[0]) ? 'cryptoUSD':'equityUSD'}`,60,publicSnapshots,now)
            for(const symbol of group) {
                const row=data[symbol], snap=row.value,price=snapshotPrice(snap)
                if(price===null) { unavailable[symbol]={status:"no-data",reason:"No quote observation."};continue }
                const stamp=snap?.latestTrade?.t ?? snap?.minuteBar?.t ?? snap?.dailyBar?.t ?? snap?.prevDailyBar?.t
                const parsed=stamp ? Date.parse(stamp)/1000 : NaN
                const asOf=Number.isFinite(parsed) ? parsed:null
                const isStale=asOf===null || asOf>now+300 || now-asOf>7*86400
                const move=snapshotChange(snap)
                quotes[symbol]={price,change:move?.change ?? null,changePct:move?.changePct ?? null,asOf,isStale,fetchedAt:row.fetchedAt,expiresAt:row.expiresAt,currency:isCryptoSymbol(symbol) ? (toAlpacaCrypto(symbol).split("/")[1] ?? null):"USD"}
            }
        } catch { for(const symbol of group) unavailable[symbol]={status:"unavailable",reason:"Quotes unavailable."} }
    })
    return {quotes,unavailable}
}
