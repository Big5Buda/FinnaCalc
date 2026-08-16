/**
 * Portfolio analytics — ported from Features/Investing/PortfolioAnalytics.swift.
 *
 * What the web can compute honestly today: weights, concentration, the
 * diversification read, unrealized P&L, and the tax view built from executed
 * orders. The app's sector, risk and dividend sections need per-symbol
 * fundamentals, which no provider on this backend serves since the move to
 * Alpaca — so those aren't computed here rather than being filled with guesses.
 */

import type { BrokeragePosition, Order } from "@/lib/investing/snaptrade"

export type Holding = {
    symbol: string
    description: string
    units: number
    price: number | null
    value: number
    /** Share of the portfolio, 0…1. */
    weight: number
    openPnl: number | null
}

/**
 * Positions valued and weighted, largest first. Rows the brokerage hasn't
 * priced are valued from `prices` (a live quote) when one is available, and
 * dropped when neither knows — a holding counted at zero would quietly shrink
 * every other holding's weight.
 */
export function holdings(
    positions: BrokeragePosition[],
    prices: Record<string, number> = {}
): Holding[] {
    const valued = positions.flatMap((position) => {
        const price = position.price ?? prices[position.symbol.toUpperCase()] ?? null
        const value = position.marketValue ?? (price !== null ? price * position.units : null)
        if (value === null || !Number.isFinite(value)) return []
        return [{ position, price, value }]
    })

    const total = valued.reduce((sum, entry) => sum + entry.value, 0)
    if (!(total > 0)) return []

    return valued
        .map(({ position, price, value }) => ({
            symbol: position.symbol.toUpperCase(),
            description: position.description,
            units: position.units,
            price,
            value,
            weight: value / total,
            openPnl: position.openPnl,
        }))
        .sort((a, b) => b.value - a.value)
}

/**
 * Shares proven by executed buy orders, for accounts whose daily holdings sync
 * hasn't caught up with a fresh trade. `covered` lists symbols the sync already
 * reports, so nothing is double-counted.
 */
export function provisionalPositions(
    orderList: Order[],
    covered: string[] = []
): BrokeragePosition[] {
    const skip = new Set(covered.map((symbol) => symbol.toUpperCase()))
    const units = new Map<string, { units: number; accountId: string; description: string }>()

    for (const order of orderList) {
        const symbol = order.symbol?.toUpperCase()
        if (!symbol || skip.has(symbol)) continue
        const filled = order.filledQuantity ?? 0
        if (!(filled > 0)) continue
        const action = (order.action ?? "").toUpperCase()
        const signed = action.includes("SELL") ? -filled : filled
        const existing = units.get(symbol)
        units.set(symbol, {
            units: (existing?.units ?? 0) + signed,
            accountId: order.accountId ?? existing?.accountId ?? "",
            description: existing?.description ?? symbol,
        })
    }

    return [...units.entries()]
        .filter(([, entry]) => entry.units > 0)
        .map(([symbol, entry]) => ({
            accountId: entry.accountId,
            symbol,
            description: entry.description,
            units: entry.units,
            price: null,
            marketValue: null,
            openPnl: null,
        }))
}

/** Average executed cost per share, per symbol, from filled buys. */
export function provisionalCosts(orderList: Order[]): Record<string, number> {
    const spend = new Map<string, { cost: number; units: number }>()
    for (const order of orderList) {
        const symbol = order.symbol?.toUpperCase()
        const price = order.executionPrice
        const filled = order.filledQuantity ?? 0
        if (!symbol || price === null || !(filled > 0)) continue
        if ((order.action ?? "").toUpperCase().includes("SELL")) continue
        const existing = spend.get(symbol) ?? { cost: 0, units: 0 }
        spend.set(symbol, { cost: existing.cost + price * filled, units: existing.units + filled })
    }
    const out: Record<string, number> = {}
    for (const [symbol, entry] of spend) {
        if (entry.units > 0) out[symbol] = entry.cost / entry.units
    }
    return out
}

/** Herfindahl index: 1.0 for everything in one place, 1/n for n equal slices. */
export function hhi(weights: number[]): number {
    return weights.reduce((sum, weight) => sum + weight * weight, 0)
}

/** The reciprocal of the HHI — "how many positions is this really". */
export function effectiveCount(weights: number[]): number | null {
    const index = hhi(weights)
    return index > 0 ? 1 / index : null
}

export type Diversification = {
    /** 0…100, from how evenly the money sits across holdings. */
    score: number
    effectiveHoldings: number
    topSymbol: string
    topWeight: number
    /** Share of value in the largest three positions. */
    topThreeWeight: number
    holdingCount: number
}

export function diversification(rows: Holding[]): Diversification | null {
    const first = rows[0]
    const effective = effectiveCount(rows.map((row) => row.weight))
    if (!first || effective === null) return null

    // 15 equally-weighted holdings is treated as a full mark. Past that the
    // extra spread stops changing the answer to "is one bad day going to
    // hurt", which is the question the score exists to answer.
    //
    // The app blends a sector term into this. Sector data needs per-symbol
    // fundamentals the backend no longer has, and the app's own rule for that
    // case is to score on holdings alone rather than dock the user for data we
    // couldn't fetch — which is exactly what happens here.
    const holdingPart = Math.min(1, Math.max(0, (effective - 1) / 14))

    return {
        score: Math.round(100 * holdingPart),
        effectiveHoldings: effective,
        topSymbol: first.symbol,
        topWeight: first.weight,
        topThreeWeight: rows.slice(0, 3).reduce((sum, row) => sum + row.weight, 0),
        holdingCount: rows.length,
    }
}

/** The one-word read on a score. */
export function diversificationLabel(score: number): string {
    if (score < 35) return "Concentrated"
    if (score < 60) return "Narrow"
    if (score < 80) return "Reasonably spread"
    return "Well spread"
}

export type TaxLot = {
    symbol: string
    units: number
    costBasis: number
    marketValue: number
    unrealized: number
    /** True once the earliest buy is more than a year old. */
    longTerm: boolean
}

/**
 * A tax view built from executed buys: cost basis against today's value, and
 * whether the position has been held long enough to be long-term.
 *
 * Deliberately not a tax calculation — it's the same arithmetic a brokerage
 * statement shows, and it says nothing about what anything would be taxed at.
 */
export function taxLots(rows: Holding[], orderList: Order[]): TaxLot[] {
    const costs = provisionalCosts(orderList)
    const earliest = new Map<string, number>()
    for (const order of orderList) {
        const symbol = order.symbol?.toUpperCase()
        if (!symbol || !order.timePlaced) continue
        if ((order.action ?? "").toUpperCase().includes("SELL")) continue
        const time = Date.parse(order.timePlaced)
        if (!Number.isFinite(time)) continue
        earliest.set(symbol, Math.min(earliest.get(symbol) ?? time, time))
    }

    const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000

    return rows.flatMap((row) => {
        const cost = costs[row.symbol]
        if (cost === undefined) return []
        const costBasis = cost * row.units
        const first = earliest.get(row.symbol)
        return [
            {
                symbol: row.symbol,
                units: row.units,
                costBasis,
                marketValue: row.value,
                unrealized: row.value - costBasis,
                longTerm: first !== undefined && first < yearAgo,
            },
        ]
    })
}
