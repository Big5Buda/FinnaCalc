/**
 * Static investing metadata — sectors, curated ETFs, and the safe-investment
 * reference list. Ported from Features/Investing/SectorCatalog.swift,
 * ETFListView.swift.
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


/**
 * The sector universe: every symbol the Discover page prices, grouped by the
 * sector it belongs to and carrying the company's real name.
 *
 * This lived inside app/api/market-overview/route.ts, where only that one
 * route could reach it. That was the reason /api/stock answered `sector: null`
 * for AAPL while /api/market-overview answered "Technology" for the very same
 * ticker in the very same deploy. The null travelled: the Portfolio sector-mix
 * donut reads sector from /api/stock, and so does a Mix goal scoped to a
 * sector, so both sat at zero for everyone.
 *
 * Alpaca sells execution and prices and publishes no company profile, so this
 * hand-kept list is the only sector source there is. It covers the large caps
 * people actually hold, not the whole market: a symbol that is not here still
 * answers null, which stays honest rather than guessing a sector from a name.
 */
export const SECTOR_UNIVERSE = [
    {
        id: "technology", name: "Technology", color: "blue",
        stocks: [
            { symbol: "AAPL", name: "Apple Inc." }, { symbol: "MSFT", name: "Microsoft Corp." },
            { symbol: "NVDA", name: "NVIDIA Corp." }, { symbol: "GOOGL", name: "Alphabet Inc." },
            { symbol: "META", name: "Meta Platforms Inc." }, { symbol: "AMD", name: "Advanced Micro Devices" },
            { symbol: "AVGO", name: "Broadcom Inc." }, { symbol: "ORCL", name: "Oracle Corp." },
            { symbol: "CRM", name: "Salesforce Inc." }, { symbol: "ADBE", name: "Adobe Inc." },
            { symbol: "INTC", name: "Intel Corp." }, { symbol: "CSCO", name: "Cisco Systems" },
            { symbol: "QCOM", name: "Qualcomm Inc." }, { symbol: "TXN", name: "Texas Instruments" },
            { symbol: "IBM", name: "IBM Corp." },
        ],
    },
    {
        id: "healthcare", name: "Healthcare", color: "emerald",
        stocks: [
            { symbol: "UNH", name: "UnitedHealth Group" }, { symbol: "JNJ", name: "Johnson & Johnson" },
            { symbol: "LLY", name: "Eli Lilly and Co." }, { symbol: "ABBV", name: "AbbVie Inc." },
            { symbol: "MRK", name: "Merck & Co." }, { symbol: "PFE", name: "Pfizer Inc." },
            { symbol: "TMO", name: "Thermo Fisher Scientific" }, { symbol: "ABT", name: "Abbott Laboratories" },
            { symbol: "DHR", name: "Danaher Corp." }, { symbol: "AMGN", name: "Amgen Inc." },
            { symbol: "BMY", name: "Bristol-Myers Squibb" }, { symbol: "GILD", name: "Gilead Sciences" },
            { symbol: "ISRG", name: "Intuitive Surgical" }, { symbol: "CVS", name: "CVS Health" },
            { symbol: "MDT", name: "Medtronic plc" },
        ],
    },
    {
        id: "financials", name: "Financials", color: "violet",
        stocks: [
            { symbol: "JPM", name: "JPMorgan Chase & Co." }, { symbol: "BAC", name: "Bank of America Corp." },
            { symbol: "V", name: "Visa Inc." }, { symbol: "MA", name: "Mastercard Inc." },
            { symbol: "GS", name: "Goldman Sachs Group" }, { symbol: "WFC", name: "Wells Fargo & Co." },
            { symbol: "MS", name: "Morgan Stanley" }, { symbol: "BLK", name: "BlackRock Inc." },
            { symbol: "C", name: "Citigroup Inc." }, { symbol: "AXP", name: "American Express" },
            { symbol: "SCHW", name: "Charles Schwab" }, { symbol: "USB", name: "U.S. Bancorp" },
            { symbol: "PNC", name: "PNC Financial" }, { symbol: "COF", name: "Capital One" },
            { symbol: "PYPL", name: "PayPal Holdings" },
        ],
    },
    {
        id: "consumer", name: "Consumer", color: "orange",
        stocks: [
            { symbol: "AMZN", name: "Amazon.com Inc." }, { symbol: "TSLA", name: "Tesla Inc." },
            { symbol: "HD", name: "Home Depot Inc." }, { symbol: "MCD", name: "McDonald's Corp." },
            { symbol: "NKE", name: "Nike Inc." }, { symbol: "SBUX", name: "Starbucks Corp." },
            { symbol: "LOW", name: "Lowe's Companies" }, { symbol: "TGT", name: "Target Corp." },
            { symbol: "COST", name: "Costco Wholesale" }, { symbol: "WMT", name: "Walmart Inc." },
            { symbol: "PG", name: "Procter & Gamble" }, { symbol: "KO", name: "Coca-Cola Co." },
            { symbol: "PEP", name: "PepsiCo Inc." }, { symbol: "BKNG", name: "Booking Holdings" },
            { symbol: "TJX", name: "TJX Companies" },
        ],
    },
    {
        id: "energy", name: "Energy", color: "amber",
        stocks: [
            { symbol: "XOM", name: "Exxon Mobil Corp." }, { symbol: "CVX", name: "Chevron Corp." },
            { symbol: "COP", name: "ConocoPhillips" }, { symbol: "SLB", name: "Schlumberger Ltd." },
            { symbol: "OXY", name: "Occidental Petroleum" }, { symbol: "PSX", name: "Phillips 66" },
            { symbol: "EOG", name: "EOG Resources" }, { symbol: "MPC", name: "Marathon Petroleum" },
            { symbol: "VLO", name: "Valero Energy" }, { symbol: "KMI", name: "Kinder Morgan" },
            { symbol: "WMB", name: "Williams Companies" }, { symbol: "HAL", name: "Halliburton Co." },
            { symbol: "DVN", name: "Devon Energy" }, { symbol: "HES", name: "Hess Corp." },
            { symbol: "BKR", name: "Baker Hughes" },
        ],
    },
    {
        id: "communication", name: "Communication", color: "indigo",
        stocks: [
            { symbol: "NFLX", name: "Netflix Inc." }, { symbol: "DIS", name: "Walt Disney Co." },
            { symbol: "T", name: "AT&T Inc." }, { symbol: "VZ", name: "Verizon Communications" },
            { symbol: "CMCSA", name: "Comcast Corp." }, { symbol: "CHTR", name: "Charter Communications" },
            { symbol: "TMUS", name: "T-Mobile US" }, { symbol: "SPOT", name: "Spotify Technology" },
            { symbol: "EA", name: "Electronic Arts" }, { symbol: "TTWO", name: "Take-Two Interactive" },
            { symbol: "WBD", name: "Warner Bros. Discovery" }, { symbol: "PARA", name: "Paramount Global" },
            { symbol: "RBLX", name: "Roblox Corp." }, { symbol: "LYV", name: "Live Nation" },
            { symbol: "OMC", name: "Omnicom Group" },
        ],
    },
    {
        id: "industrials", name: "Industrials", color: "slate",
        stocks: [
            { symbol: "CAT", name: "Caterpillar Inc." }, { symbol: "BA", name: "Boeing Co." },
            { symbol: "GE", name: "GE Aerospace" }, { symbol: "UPS", name: "United Parcel Service" },
            { symbol: "HON", name: "Honeywell International" }, { symbol: "LMT", name: "Lockheed Martin Corp." },
            { symbol: "RTX", name: "RTX Corp." }, { symbol: "DE", name: "Deere & Co." },
            { symbol: "UNP", name: "Union Pacific" }, { symbol: "FDX", name: "FedEx Corp." },
            { symbol: "ETN", name: "Eaton Corp." }, { symbol: "EMR", name: "Emerson Electric" },
            { symbol: "NOC", name: "Northrop Grumman" }, { symbol: "GD", name: "General Dynamics" },
            { symbol: "MMM", name: "3M Co." },
        ],
    },
];

export type SymbolProfile = { name: string; sector: string }

/** One symbol's name and sector, or null when the universe has never heard of it. */
export function symbolProfile(symbol: string): SymbolProfile | null {
    const wanted = symbol.toUpperCase().trim()
    for (const sector of SECTOR_UNIVERSE) {
        for (const stock of sector.stocks) {
            if (stock.symbol === wanted) return { name: stock.name, sector: sector.name }
        }
    }
    return null
}
