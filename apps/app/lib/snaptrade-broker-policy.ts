/** Reviewed US stock/ETF subset of SnapTrade Institution Support, 2026-11-07.
 * This is an execution ceiling, never a grant. Partner metadata, reviewed
 * release configuration and owned account/listing checks still apply.
 * No deprecated brokerage-level fractional boolean establishes dollar support.
 */
export const US_EQUITY_SUPPORT = {
    ALPACA: { fractional: true, dollars: true, paper: false, gtc: true },
    "ALPACA-PAPER": { fractional: true, dollars: true, paper: true, gtc: true },
    ETRADE: { fractional: false, dollars: false, paper: false, gtc: true },
    MOOMOO: { fractional: true, dollars: false, paper: false, gtc: true },
    PUBLIC: { fractional: true, dollars: true, paper: false, gtc: false },
    "ROBINHOOD-AGENTIC": { fractional: true, dollars: true, paper: false, gtc: true },
    // SCHWAB omitted: production integration is read-only, and preview docs conflict.
    TASTYTRADE: { fractional: true, dollars: true, paper: false, gtc: true },
    TRADESTATION: { fractional: false, dollars: false, paper: false, gtc: true },
    "TRADESTATION-SIM": { fractional: false, dollars: false, paper: true, gtc: true },
    TRADIER: { fractional: false, dollars: false, paper: false, gtc: true },
    WEBULL: { fractional: true, dollars: true, paper: false, gtc: true },
} as const
export function usEquitySupport(slug: string) {
    return Object.prototype.hasOwnProperty.call(US_EQUITY_SUPPORT, slug)
        ? US_EQUITY_SUPPORT[slug as keyof typeof US_EQUITY_SUPPORT] : null
}

/** SnapTrade exchange.code is nonstandard; quote exchange.mic_code is ISO10383.
 * Verified equity listing markets: Nasdaq, NYSE, NYSE Arca. No name aliases.
 * Sources: iso20022.org/market-identifier-codes and Nasdaq NFNDS_NCDS.pdf.
 */
export const US_EQUITY_MICS: readonly string[] = ["XNAS", "XNYS", "ARCX"]
export function usEquityMic(value: unknown): boolean {
    return typeof value === "string" && US_EQUITY_MICS.includes(value)
}
export function previewOnlyInstruments(slug: string): boolean { return slug === "MOOMOO" || slug === "WEBULL" }
export function documentedMinimum(slug: string): string | undefined {
    return slug === "MOOMOO" || slug === "WEBULL" ? "5.00" : undefined
}
