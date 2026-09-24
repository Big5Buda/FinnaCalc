// Shared live-quote lookup. Alpaca is the only provider: equities come from
// the stock snapshots endpoint, crypto pairs from the crypto one.
//
// A quote is only returned when Alpaca actually has one. Callers render "—"
// otherwise rather than showing a figure nobody can stand behind.

import {
    asset,
    cryptoSnapshots,
    isCryptoSymbol,
    snapshotChange,
    snapshotPrice,
    activeAssets,
    stockSnapshots,
} from "@/lib/alpaca"

export type LiveQuote = {
    price: number
    /** Timestamp of the observation used for `price`. */
    asOf: string | null
    /** True when provider has no timestamp or last observation is over 7 days old. */
    isStale: boolean
    /**
     * The day's move, or null when Alpaca has no previous close to measure
     * against. Nullable rather than zero: these used to fall back to 0, which
     * states that a stock finished the day exactly flat. BRK.A is the live
     * example. It trades a few shares a day, IEX carries no daily bar for it
     * at all, and the row read "$477,207.28, 0.00%" as though we had checked.
     * A price we have and a move we do not are different facts.
     */
    change: number | null
    changePct: number | null
    /** Instrument name, when the assets endpoint knows it. */
    name: string | null
}

// A week tolerates weekends, exchange holidays and quiet IEX trading while
// rejecting retired symbols whose snapshots keep their final trade forever.
const MAX_QUOTE_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Current Alpaca listings, or null when the trading-API catalogue is
 * unavailable. Callers must fall back to timestamp checks on null; an empty
 * provider response must never be interpreted as "everything delisted".
 */
export async function activeSymbolSet(revalidate = 900): Promise<Set<string> | null> {
    const assets = await activeAssets(revalidate)
    if (assets.length === 0) return null
    return new Set(assets.filter((asset) => asset.status.toLowerCase() === "active").map((asset) => asset.symbol.toUpperCase()))
}

function observationTime(snapshot: {
    latestTrade?: { t: string }
    minuteBar?: { t: string }
    dailyBar?: { t: string }
    prevDailyBar?: { t: string }
} | undefined): string | null {
    return snapshot?.latestTrade?.t ?? snapshot?.minuteBar?.t ?? snapshot?.dailyBar?.t ?? snapshot?.prevDailyBar?.t ?? null
}

function isStale(asOf: string | null, now = Date.now()): boolean {
    if (!asOf) return true
    const time = Date.parse(asOf)
    return !Number.isFinite(time) || time > now + 5 * 60 * 1000 || now - time > MAX_QUOTE_AGE_MS
}

/**
 * Live quotes for a batch of symbols, keyed by the caller's own symbol form.
 * Equities and crypto are fetched in one request each rather than one per
 * symbol.
 */
export async function fetchQuotes(
    symbols: string[],
    revalidate = 60
): Promise<Record<string, LiveQuote>> {
    const wanted = symbols.map((symbol) => symbol.toUpperCase().trim()).filter(Boolean)
    if (wanted.length === 0) return {}

    const equities = wanted.filter((symbol) => !isCryptoSymbol(symbol))
    const cryptos = wanted.filter(isCryptoSymbol)

    const [equitySnapshots, cryptoSnaps] = await Promise.all([
        stockSnapshots(equities, revalidate),
        cryptoSnapshots(cryptos, revalidate),
    ])
    const snapshots = { ...equitySnapshots, ...cryptoSnaps }

    const out: Record<string, LiveQuote> = {}
    for (const symbol of wanted) {
        const snapshot = snapshots[symbol]
        const price = snapshotPrice(snapshot)
        if (price === null) continue
        const move = snapshotChange(snapshot)
        const asOf = observationTime(snapshot)
        out[symbol] = {
            price,
            asOf,
            isStale: isStale(asOf),
            change: move?.change ?? null,
            changePct: move?.changePct ?? null,
            name: null,
        }
    }
    return out
}

/**
 * A live price for one instrument, or null when Alpaca has none. The name costs
 * a second (day-cached) call, so it's only looked up for equities, which is
 * where Alpaca has one.
 */
export async function fetchQuote(symbol: string, revalidate = 60): Promise<LiveQuote | null> {
    const upper = symbol.toUpperCase().trim()
    const quotes = await fetchQuotes([upper], revalidate)
    const quote = quotes[upper]
    if (!quote) return null
    if (isCryptoSymbol(upper)) return quote
    const info = await asset(upper)
    return { ...quote, name: info?.name ?? null }
}
