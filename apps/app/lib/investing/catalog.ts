/**
 * Static investing metadata — sectors, curated ETFs, and the safe-investment
 * reference list. Ported from Features/Investing/SectorCatalog.swift,
 * ETFListView.swift and SafeInvestmentsView.swift.
 */

export type SectorMeta = {
    id: string
    /** Matches the `sector` string on /api/market-overview's quotes. */
    name: string
    color: string
    icon: string
    blurb: string
}

/*
 * Sector colours are darkened to clear 4.5:1 against the white text that sits
 * on them — axe flagged the originals at 2.5–3.7:1. If you retune these, check
 * the contrast rather than the swatch: several of the brighter originals were
 * unreadable on the card even though they looked fine in isolation.
 */
export const SECTORS: SectorMeta[] = [
    {
        id: "technology",
        name: "Technology",
        color: "#3B5BDB",
        icon: "Cpu",
        blurb: "Hardware, software, and the companies building the future.",
    },
    {
        id: "healthcare",
        name: "Healthcare",
        color: "#098460",
        icon: "Stethoscope",
        blurb: "Drugmakers, insurers, and medical-device companies.",
    },
    {
        id: "financials",
        name: "Financials",
        color: "#C94D0A",
        icon: "Landmark",
        blurb: "Businesses that are in the business of money.",
    },
    {
        id: "consumer",
        name: "Consumer",
        color: "#CC4071",
        icon: "ShoppingCart",
        blurb: "Retail, autos, and the brands people buy every day.",
    },
    {
        id: "energy",
        name: "Energy",
        color: "#AA6300",
        icon: "Zap",
        blurb: "Oil, gas, and the companies that power the world.",
    },
    {
        id: "communication",
        name: "Communication",
        color: "#7048E8",
        icon: "RadioTower",
        blurb: "Media, telecom, and streaming companies.",
    },
    {
        id: "industrials",
        name: "Industrials",
        color: "#0D7F91",
        icon: "Settings",
        blurb: "Aerospace, machinery, and logistics companies.",
    },
]

export function sectorById(id: string): SectorMeta | undefined {
    return SECTORS.find((sector) => sector.id === id)
}

export type ETFEntry = { symbol: string; name: string; blurb: string }

/**
 * A curated on-ramp, not a screen of the whole ETF universe: every row opens
 * the same stock detail page, since quotes, bars and news already work for ETF
 * tickers.
 */
export const CURATED_ETFS: ETFEntry[] = [
    { symbol: "VOO", name: "Vanguard S&P 500", blurb: "The 500 largest US companies" },
    { symbol: "SPY", name: "SPDR S&P 500", blurb: "The classic S&P 500 tracker" },
    { symbol: "VTI", name: "Vanguard Total Market", blurb: "The entire US stock market" },
    { symbol: "QQQ", name: "Invesco QQQ", blurb: "Nasdaq-100, big tech heavy" },
    { symbol: "DIA", name: "SPDR Dow Jones", blurb: "The Dow 30 industrials" },
    { symbol: "IWM", name: "iShares Russell 2000", blurb: "US small caps" },
    { symbol: "VXUS", name: "Vanguard Intl Stock", blurb: "The world outside the US" },
    { symbol: "SCHD", name: "Schwab US Dividend", blurb: "High-quality dividend payers" },
    { symbol: "VIG", name: "Vanguard Div Appreciation", blurb: "Dividend growers" },
    { symbol: "AGG", name: "iShares Core US Bond", blurb: "Investment-grade US bonds" },
    { symbol: "BND", name: "Vanguard Total Bond", blurb: "The broad US bond market" },
    { symbol: "VNQ", name: "Vanguard Real Estate", blurb: "US REITs" },
    { symbol: "GLD", name: "SPDR Gold Shares", blurb: "Physical gold" },
]

export type SafeInvestment = {
    name: string
    symbol: string
    avgReturn: string
    risk: string
    description: string
    minInvestment: string
    link: string
}

/** A static reference list. It drives no calculation and is not advice. */
export const SAFE_INVESTMENTS: SafeInvestment[] = [
    {
        name: "S&P 500 Index Fund (IVV)",
        symbol: "IVV",
        avgReturn: "10.5%",
        risk: "Low-Medium",
        description: "Tracks the 500 largest US companies.",
        minInvestment: "$1",
        link: "https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf",
    },
    {
        name: "Total Stock Market (VTI)",
        symbol: "VTI",
        avgReturn: "10.2%",
        risk: "Low-Medium",
        description: "Owns the entire US stock market.",
        minInvestment: "$1",
        link: "https://investor.vanguard.com/investment-products/etfs/profile/vti",
    },
    {
        name: "High-Yield Savings",
        symbol: "HYSA",
        avgReturn: "4.5%+",
        risk: "None",
        description: "FDIC insured savings account.",
        minInvestment: "$0",
        link: "https://www.nerdwallet.com/best/banking/high-yield-online-savings-accounts",
    },
]

/**
 * The broad-market ETFs, labelled for what they are. Indices themselves aren't
 * quotable on the current data plan, so the app tracks the ETF and says so —
 * SPY is "S&P 500 ETF", never "the S&P 500".
 */
export const MARKET_INDEX_ETFS = [
    { symbol: "SPY", name: "S&P 500 ETF", badge: "S&P", color: "#D6182B" },
    { symbol: "QQQ", name: "Nasdaq 100 ETF", badge: "NDX", color: "#0B3D91" },
    { symbol: "IWM", name: "Russell 2000 ETF", badge: "RUT", color: "#00857D" },
]
