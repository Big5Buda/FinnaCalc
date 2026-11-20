import { US_EQUITY_SUPPORT, US_EQUITY_MICS } from "./snaptrade-broker-policy"

/** Route ceilings for sizing V2 (reviewed 2026-11-20). A ceiling is never a
 * grant: SNAPTRADE_TRADING_BROKER_CAPABILITIES, live partner metadata, the
 * owned account and the exact listing must still all agree.
 *
 * A listing identity is (universal_symbol_id, ISO 10383 MIC, ISO 4217
 * currency) as reported by the account's own quote; tickers alone never
 * identify a route. Currencies with unverified pricing units (for example LSE
 * GBX vs GBP) are deliberately absent, so they fail closed.
 *
 * `unverified` lists sizing modes the institution offers in its own apps but
 * for which no SnapTrade/API evidence was found. They are denied with an
 * explicit reason instead of being silently enabled.
 */
export type RouteListing = { currency: string; mics: readonly string[] }
export type SizingMode = "fractional" | "dollars"
export type RouteSupport = { paper: boolean; limit: boolean; gtc: boolean; fractional: boolean; dollars: boolean;
    listings: readonly RouteListing[]; unverified: readonly SizingMode[]; evidence: readonly string[]
    /** Dollars listing proof. "instrument" (default): positive brokerage
     * instrument metadata (tradeable + fractionable, universal id bound).
     * "account_quote": the account's own quote identity (universal id, MIC,
     * currency) plus a required checked preview of the exact notional order,
     * for institutions whose instrument list carries no universal id. */
    notionalListing?: "instrument" | "account_quote"
    /** Fractional units are documented for this account region only. */
    fractionalRegion?: "US"
    /** Dollars need env-granted self-directed account types (raw_type). */
    selfDirectedRawTypes?: true }

const US_LISTINGS: readonly RouteListing[] = [{ currency: "USD", mics: US_EQUITY_MICS }]
const SNAPTRADE_BROKERAGES = "https://api.snaptrade.com/api/v1/brokerages"
/** Read 2026-11-20 by the coordinator; snapshot in the native checkpoint
 * ReviewSnapshots/watchlist-trading/route-sources-20261120.md. */
const SNAPTRADE_TABLE = "https://support.snaptrade.com/brokerages"
const MOOMOO_SOURCE = "https://support.snaptrade.com/Moomoo-e33feaa69a1c836f891381bb17911594?pvs=21"

export const ROUTE_SUPPORT: Readonly<Record<string, RouteSupport>> = {
    ...Object.fromEntries(Object.entries(US_EQUITY_SUPPORT).map(([slug, s]) => [slug, {
        paper: s.paper, limit: true, gtc: s.gtc, fractional: s.fractional, dollars: s.dollars,
        listings: US_LISTINGS, unverified: [], evidence: [SNAPTRADE_BROKERAGES],
        // Moomoo: US accounts fractional (min 5 USD); CA accounts none. One
        // slug serves both and no typed account field proves the region.
        ...(slug === "MOOMOO" ? { fractionalRegion: "US" as const } : {}) } satisfies RouteSupport])),
    // Wealthsimple: CAD listings on TSX/TSX Venture and USD on US venues.
    // SnapTrade table: Dollar amount + Whole shares; fractional units not
    // supported. Its instrument list has no universal id, so dollar listing
    // proof is the account quote plus a required checked preview, and only
    // env-granted self-directed account types qualify.
    WEALTHSIMPLETRADE: { paper: false, limit: true, gtc: false, fractional: false, dollars: true,
        listings: [{ currency: "CAD", mics: ["XTSE", "XTSX"] }, ...US_LISTINGS], unverified: [],
        notionalListing: "account_quote", selfDirectedRawTypes: true,
        evidence: [SNAPTRADE_TABLE, SNAPTRADE_BROKERAGES, "https://help.wealthsimple.com/hc/en-ca/articles/4413542937627"] },
    // Webull Canada: whole shares per the SnapTrade table; no sizing modes.
    "WEBULL-CANADA": { paper: false, limit: true, gtc: false, fractional: false, dollars: false,
        listings: [{ currency: "CAD", mics: ["XTSE", "XTSX"] }, ...US_LISTINGS], unverified: [],
        evidence: [SNAPTRADE_TABLE, SNAPTRADE_BROKERAGES] },
    // SCHWAB deliberately absent: the SnapTrade table marks OrderImpact
    // supported but its Schwab Trading page says no preview
    // (https://support.snaptrade.com/Schwab-Trading-942feaa69a1c830fac4401fb22fbbfc3?pvs=21).
    // The execution mode cannot be chosen until that conflict is resolved.
    // Trading212 API: quantity orders only (value orders unsupported), live
    // environment Market only, multi-currency accounts unsupported. Funding
    // therefore requires a balance in the listing currency itself.
    TRADING212: { paper: false, limit: false, gtc: false, fractional: true, dollars: false,
        listings: US_LISTINGS, unverified: [], evidence: [SNAPTRADE_TABLE, SNAPTRADE_BROKERAGES, "https://docs.trading212.com/api"] },
    "TRADING212-PRACTICE": { paper: true, limit: false, gtc: false, fractional: true, dollars: false,
        listings: US_LISTINGS, unverified: [], evidence: [SNAPTRADE_BROKERAGES, "https://docs.trading212.com/api"] },
}

export function routeSupport(slug: string): RouteSupport | null {
    return Object.prototype.hasOwnProperty.call(ROUTE_SUPPORT, slug) ? ROUTE_SUPPORT[slug] : null
}
export function routeListing(slug: string, currency: unknown, mic: unknown): boolean {
    return typeof currency === "string" && typeof mic === "string"
        && (routeSupport(slug)?.listings.some(l => l.currency === currency && l.mics.includes(mic)) ?? false)
}

/** Reviewed ISO 4217 minor units. Anything else fails closed. */
export const MINOR_UNITS: Readonly<Record<string, number>> = { USD: 2, CAD: 2 }

/** Broker minimums with a public source. A minimum without one is enforced
 * as a FinnaCalc (application) bound and labelled that way. */
export const MINIMUM_SOURCES: Readonly<Record<string, string>> = {
    WEBULL: "https://support.snaptrade.com/Webull-e1afeaa69a1c839ba37c0134f951baa2",
    MOOMOO: MOOMOO_SOURCE,
}

/** SnapTrade's InvestmentAccount (SDK 13.2.3) has no region/country field;
 * raw_type and institution_id are brokerage-specific and unreviewed. A route
 * whose fractional support is region-specific therefore fails closed. */
export function fractionalRegionVerified(route: RouteSupport, _account: unknown): boolean {
    return route.fractionalRegion === undefined
}
