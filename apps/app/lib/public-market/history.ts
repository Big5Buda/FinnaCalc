import { FEED, isCryptoSymbol, toAlpacaCrypto, publicBars, type AlpacaBar, type BarAdjustment } from "@/lib/alpaca"
import { bucket, chunks, mapBounded, publicMany, type Timed } from "./cache"
import { RANGES, INTERVALS, exchangeDate, latestDrawableSession } from "./candle-processing"
import type { Unavailable } from "./protocol"

export async function historyBatch(symbols: string[], range: string, interval: string | null, adjustment: BarAdjustment,
    now = Date.now() / 1000) {
    const served = RANGES[range] ? range : "1M"
    const preset = RANGES[served]
    const timeframe = interval && INTERVALS[interval] ? INTERVALS[interval] : preset.timeframe
    // Widen stable provider bounds, then trim to the EXACT legacy rolling start.
    const slot = bucket(now, 60)
    const start = new Date((slot - preset.days * 86400) * 1000).toISOString()
    const end = new Date((slot + 60) * 1000 - 1).toISOString()
    const results: Record<string, ReturnType<typeof processHistory>> = {}
    const unavailable: Record<string, Unavailable> = {}
    const eligible = symbols.filter(s=>{
        if (isCryptoSymbol(s) && toAlpacaCrypto(s).split("/")[1] !== "USD") {
            unavailable[s]={status:"unsupported",reason:"Only USD history is supported."}; return false
        }
        return true
    })
    const groups = [eligible.filter(s=>!isCryptoSymbol(s)), eligible.filter(isCryptoSymbol)].flatMap(s=>chunks(s,25))
    await mapBounded(groups, 2, async group => {
        try {
            const key = JSON.stringify(["bars", FEED, isCryptoSymbol(group[0]) ? "cryptoUSD" : "equityUSD", served, timeframe, adjustment, start, end])
            const data = await publicMany(group, key, 60, missing=>publicBars(missing,timeframe,start,end,adjustment),now,JSON.stringify(["bars",FEED,isCryptoSymbol(group[0]) ? "cryptoUSD":"equityUSD",served,timeframe,adjustment]))
            for (const symbol of group) {
                const value = processHistory(symbol, served, data[symbol], preset.days, now)
                if (!value.points.length) unavailable[symbol] = { status: "no-data", reason: "No drawable history observations." }
                else results[symbol] = value
            }
        } catch { for (const symbol of group) unavailable[symbol] = { status: "unavailable", reason: "History unavailable or incomplete." } }
    })
    return { schemaVersion: 1, requested: symbols, results, unavailable }
}

export function processHistory(symbol: string, served: string, timed: Timed<AlpacaBar[]>, days:number, now:number) {
    const start = now - days * 86400
    const series = timed.value.filter(b=> Date.parse(b.t)/1000 >= start && Date.parse(b.t)/1000 <= Math.min(now,timed.fetchedAt))
    const chosen = served === "1D" ? latestDrawableSession(series) : null
    const points = (chosen ? chosen.bars : series).map(b=>({t:Math.round(Date.parse(b.t)/1000),c:b.c,o:b.o,h:b.h,l:b.l}))
        .filter(p=>Number.isFinite(p.t) && Number.isFinite(p.c) && p.t<=Math.min(now,timed.fetchedAt))
    const currentDate = exchangeDate(new Date(now*1000))
    const current = [...new Map(series.filter(b=> exchangeDate(new Date(b.t)) === currentDate && [b.c,b.o,b.h,b.l].every(n=>Number.isFinite(n) && n>0))
        .map(b=>[Date.parse(b.t),b])).values()].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t))
        .map(b=>({t:Math.round(Date.parse(b.t)/1000),c:b.c,o:b.o,h:b.h,l:b.l})).filter(p=>p.t<=Math.min(now,timed.fetchedAt))
    const currentSession = served === "1D" && timed.expiresAt > now && current.length >= 2
        ? {session:currentDate,points:current,asOf:current[current.length-1].t} : undefined
    const first = points[0]?.t
    return {
        symbol, range: served, points,
        ...(chosen ? { session: chosen.date, previousClose: chosen.previousClose } : {}),
        ...((served === "5Y" || served === "ALL") && first !== undefined ? {
            coversAllHistory: first > start + 14 * 86400, earliest: exchangeDate(new Date(first*1000))
        } : {}),
        ...(currentSession ? {currentSession} : {}),
        complete: true, source: isCryptoSymbol(symbol) ? "Alpaca crypto USD" : "Alpaca IEX",
        asOf: points.at(-1)?.t ?? null, fetchedAt: timed.fetchedAt, expiresAt: timed.expiresAt,
    }
}
