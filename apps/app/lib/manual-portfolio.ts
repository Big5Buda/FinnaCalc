export const MANUAL_PORTFOLIO_KEY = "finnacalc.manual-portfolio.v1"
export const MAX_HOLDINGS = 500
export type ManualHolding = {
    symbol: string
    shares: number
    averageCost: number
    currentPrice: number | null
    priceAsOf: string | null
}

/** Explicit exchange qualifiers are supported, without accepting URLs or HTML. */
export function researchSymbol(raw: string): string | null {
    const symbol = raw.trim().toUpperCase()
    return /^(?:(?:NASDAQ|NYSE|AMEX|NYSEARCA|CBOE|BATS):)?[A-Z][A-Z0-9.\-]{0,19}$/.test(symbol) ? symbol : null
}
export function holdingSymbol(raw: string): string | null {
    const symbol = researchSymbol(raw)
    return symbol?.split(":").at(-1) ?? null
}

export function validateHolding(input: unknown): ManualHolding {
    if (!input || typeof input !== "object") throw new Error("Enter a valid holding.")
    const h = input as Record<string, unknown>
    const symbol = typeof h.symbol === "string" ? holdingSymbol(h.symbol) : null
    if (!symbol) throw new Error("Enter a US stock or ETF ticker, such as AAPL.")
    if (typeof h.shares !== "number" || !Number.isFinite(h.shares) || h.shares <= 0 || h.shares > 1e9 || Math.abs(h.shares * 1e6 - Math.round(h.shares * 1e6)) > 0.00001)
        throw new Error("Shares must be positive, with up to six decimal places.")
    if (typeof h.averageCost !== "number" || !Number.isFinite(h.averageCost) || h.averageCost < 0 || h.averageCost > 1e9 || h.shares * h.averageCost > 1e10)
        throw new Error("Enter a valid average cost per share (holding cost at most $10 billion).")
    const currentPrice = h.currentPrice == null ? null : h.currentPrice
    if (currentPrice !== null && (typeof currentPrice !== "number" || !Number.isFinite(currentPrice) || currentPrice < 0 || currentPrice > 1e9 || h.shares * currentPrice > 1e10))
        throw new Error("Enter a valid current price, or leave it blank.")
    const priceAsOf = currentPrice === null ? null : typeof h.priceAsOf === "string" ? h.priceAsOf : null
    if (currentPrice !== null && (!priceAsOf || !/^\d{4}-\d{2}-\d{2}$/.test(priceAsOf) || !Number.isFinite(Date.parse(priceAsOf + "T12:00:00Z")) || new Date(priceAsOf + "T12:00:00Z").toISOString().slice(0, 10) !== priceAsOf))
        throw new Error("Enter the date for your current price.")
    return { symbol, shares: h.shares, averageCost: h.averageCost, currentPrice, priceAsOf }
}

export function saveHolding(holdings: ManualHolding[], input: unknown): ManualHolding[] {
    const valid = validateHolding(input)
    const remaining = holdings.filter(h => h.symbol !== valid.symbol)
    if (remaining.length >= MAX_HOLDINGS) throw new Error(`A portfolio can contain up to ${MAX_HOLDINGS} holdings.`)
    return [...remaining, valid].sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export function decodePortfolio(raw: string | null): ManualHolding[] {
    if (!raw) return []
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !Array.isArray(value.holdings) || value.holdings.length > MAX_HOLDINGS)
        throw new Error("The saved portfolio format could not be read.")
    const holdings = value.holdings.map(validateHolding)
    if (new Set(holdings.map((h: ManualHolding) => h.symbol)).size !== holdings.length)
        throw new Error("The saved portfolio has duplicate holdings.")
    return holdings
}
export function encodePortfolio(holdings: ManualHolding[]) {
    return JSON.stringify({ version: 1, holdings: holdings.map(validateHolding) })
}

const cents = (value: number) => Math.round(value * 100)
export function manualPortfolioAnalysis(holdings: ManualHolding[]) {
    const rows = holdings.map(validateHolding).map(h => {
        const cost = cents(h.shares * h.averageCost) / 100
        const value = h.currentPrice === null ? null : cents(h.shares * h.currentPrice) / 100
        return { ...h, cost, value, gain: value === null ? null : cents(value - cost) / 100 }
    })
    const cost = rows.reduce((sum, h) => sum + cents(h.cost), 0) / 100
    const priced = rows.filter(h => h.value !== null)
    const partialValue = priced.reduce((sum, h) => sum + cents(h.value!), 0) / 100
    const complete = rows.length > 0 && priced.length === rows.length
    const value = complete ? partialValue : null
    const gain = value === null ? null : cents(value - cost) / 100
    const gainPercent = gain === null || cost === 0 ? null : gain / cost * 100
    const allocationBasis = complete && value! > 0 ? "entered value" : "cost basis"
    const allocationTotal = allocationBasis === "entered value" ? value! : cost
    const allocations = rows.map(h => ({ symbol: h.symbol, amount: allocationBasis === "entered value" ? h.value! : h.cost,
        weight: allocationTotal > 0 ? (allocationBasis === "entered value" ? h.value! : h.cost) / allocationTotal * 100 : null }))
        .sort((a, b) => b.amount - a.amount)
    return { rows, cost, value, partialValue, gain, gainPercent, pricedCount: priced.length, complete, allocations, allocationBasis }
}
