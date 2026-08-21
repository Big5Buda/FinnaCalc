/**
 * Ticker to company name.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every stock page was titled with its own ticker: "AAPL" on the name line and
 * "AAPL" again on the ticker line under it. The screener and movers lists had
 * the same problem, showing the symbol where a company belongs. The intended
 * source was Alpaca's asset record, which comes back empty in production, so
 * the code fell through to `|| symbol` everywhere and nobody noticed because
 * a ticker looks like a plausible name.
 *
 * WHERE THE NAMES COME FROM, AND WHY IT IS FINE TO USE THEM
 * --------------------------------------------------------
 * The SEC publishes company_tickers.json: every registered US issuer's ticker
 * paired with its legal name, about 10,400 of them, no key, no rate card. It
 * is a work of the United States government, so it is public domain, and a
 * company's own name is a fact rather than anyone's creative work. There is no
 * licence to breach and no vendor to pay. It is also the same free SEC source
 * this backend already reads for the ten-year financial statements.
 *
 * Three layers, best first:
 *   1. The curated universe in catalog.ts, which carries hand-written names
 *      for the large caps ("NVIDIA Corp." rather than the SEC's "NVIDIA CORP").
 *   2. The SEC file, for everything else that files with the SEC.
 *   3. A short hand-kept list of popular ETFs. Funds organised as a series of
 *      a trust are not in company_tickers.json at all: SCHD, JEPI and VOO
 *      resolve to nothing there, and the SEC's fund file carries identifiers
 *      without names. These are typed out because there is no free feed that
 *      has them, and a fund's name is a fact like any other.
 *
 * A symbol none of the three knows returns null, and the caller shows the
 * ticker on the ticker line and nothing on the name line. That is the same
 * rule as everywhere else here: we would rather leave a gap than invent.
 */

import { symbolProfile } from "@/lib/investing/catalog"

/** A day. The SEC file changes when companies list or rename, not hourly. */
const REVALIDATE = 86400

const SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json"

/**
 * SEC requires a descriptive User-Agent with contact details on every request
 * and answers 403 without one. Same header the statements route sends.
 */
const SEC_HEADERS = { "User-Agent": "FinnaCalc (support@finnacalc.com)" }

/**
 * Funds that file as a series of a trust, so the SEC's ticker file has no row
 * for them. Ordered roughly by how often someone actually holds one.
 */
const FUND_NAMES: Record<string, string> = {
    VOO: "Vanguard S&P 500 ETF",
    VTI: "Vanguard Total Stock Market ETF",
    VT: "Vanguard Total World Stock ETF",
    VXUS: "Vanguard Total International Stock ETF",
    VEA: "Vanguard FTSE Developed Markets ETF",
    VWO: "Vanguard FTSE Emerging Markets ETF",
    VUG: "Vanguard Growth ETF",
    VTV: "Vanguard Value ETF",
    VYM: "Vanguard High Dividend Yield ETF",
    VIG: "Vanguard Dividend Appreciation ETF",
    VNQ: "Vanguard Real Estate ETF",
    BND: "Vanguard Total Bond Market ETF",
    BNDX: "Vanguard Total International Bond ETF",
    VGT: "Vanguard Information Technology ETF",
    VOOG: "Vanguard S&P 500 Growth ETF",
    VB: "Vanguard Small-Cap ETF",
    VO: "Vanguard Mid-Cap ETF",
    SCHD: "Schwab U.S. Dividend Equity ETF",
    SCHG: "Schwab U.S. Large-Cap Growth ETF",
    SCHB: "Schwab U.S. Broad Market ETF",
    SCHF: "Schwab International Equity ETF",
    SCHX: "Schwab U.S. Large-Cap ETF",
    SCHA: "Schwab U.S. Small-Cap ETF",
    SCHP: "Schwab U.S. TIPS ETF",
    JEPI: "JPMorgan Equity Premium Income ETF",
    JEPQ: "JPMorgan Nasdaq Equity Premium Income ETF",
    IVV: "iShares Core S&P 500 ETF",
    IJH: "iShares Core S&P Mid-Cap ETF",
    IJR: "iShares Core S&P Small-Cap ETF",
    ITOT: "iShares Core S&P Total U.S. Stock Market ETF",
    IEFA: "iShares Core MSCI EAFE ETF",
    IEMG: "iShares Core MSCI Emerging Markets ETF",
    AGG: "iShares Core U.S. Aggregate Bond ETF",
    TLT: "iShares 20+ Year Treasury Bond ETF",
    IEF: "iShares 7-10 Year Treasury Bond ETF",
    SHY: "iShares 1-3 Year Treasury Bond ETF",
    LQD: "iShares iBoxx Investment Grade Corporate Bond ETF",
    HYG: "iShares iBoxx High Yield Corporate Bond ETF",
    IWF: "iShares Russell 1000 Growth ETF",
    IWD: "iShares Russell 1000 Value ETF",
    IWB: "iShares Russell 1000 ETF",
    IVW: "iShares S&P 500 Growth ETF",
    IVE: "iShares S&P 500 Value ETF",
    XLK: "Technology Select Sector SPDR Fund",
    XLF: "Financial Select Sector SPDR Fund",
    XLE: "Energy Select Sector SPDR Fund",
    XLV: "Health Care Select Sector SPDR Fund",
    XLY: "Consumer Discretionary Select Sector SPDR Fund",
    XLP: "Consumer Staples Select Sector SPDR Fund",
    XLI: "Industrial Select Sector SPDR Fund",
    XLU: "Utilities Select Sector SPDR Fund",
    XLB: "Materials Select Sector SPDR Fund",
    XLRE: "Real Estate Select Sector SPDR Fund",
    XLC: "Communication Services Select Sector SPDR Fund",
    SPLG: "SPDR Portfolio S&P 500 ETF",
    SPYG: "SPDR Portfolio S&P 500 Growth ETF",
    SGOV: "iShares 0-3 Month Treasury Bond ETF",
    BIL: "SPDR Bloomberg 1-3 Month T-Bill ETF",
    ARKK: "ARK Innovation ETF",
    ARKG: "ARK Genomic Revolution ETF",
    ARKW: "ARK Next Generation Internet ETF",
    SMH: "VanEck Semiconductor ETF",
    SOXX: "iShares Semiconductor ETF",
    GLDM: "SPDR Gold MiniShares Trust",
    COWZ: "Pacer US Cash Cows 100 ETF",
    DGRO: "iShares Core Dividend Growth ETF",
    NOBL: "ProShares S&P 500 Dividend Aristocrats ETF",
    QQQM: "Invesco NASDAQ 100 ETF",
    RSP: "Invesco S&P 500 Equal Weight ETF",
    TQQQ: "ProShares UltraPro QQQ",
    SQQQ: "ProShares UltraPro Short QQQ",
    VOOV: "Vanguard S&P 500 Value ETF",
    MGK: "Vanguard Mega Cap Growth ETF",
    FTEC: "Fidelity MSCI Information Technology ETF",
    FXAIX: "Fidelity 500 Index Fund",
}

/**
 * Tokens that stay exactly as written when a shouty SEC name is cased down.
 * Everything here would otherwise come out looking wrong: "Ibm", "At&t", "3m".
 */
const KEEP_UPPER = new Set([
    "IBM", "AMD", "NVIDIA", "AT&T", "HP", "HPE", "3M", "UPS", "CVS", "PNC",
    "USA", "US", "U.S.", "UK", "PLC", "LLC", "LP", "NV", "SA", "AG", "SE",
    "AB", "AS", "ETF", "REIT", "TV", "AI", "PG&E", "BP", "EOG", "SPDR",
    "KLA", "NXP", "SAP", "TE", "GE", "MSCI", "S&P", "NYSE", "II", "III", "IV",
])

/** Brands whose own spelling is neither all caps nor plain title case. */
const BRAND_CASE: Record<string, string> = {
    JPMORGAN: "JPMorgan",
    EXXONMOBIL: "ExxonMobil",
    MCDONALDS: "McDonald's",
    "MCDONALD'S": "McDonald's",
    ISHARES: "iShares",
    POWERSHARES: "PowerShares",
    LVMH: "LVMH",
    EBAY: "eBay",
    PAYPAL: "PayPal",
    YOUTUBE: "YouTube",
    LINKEDIN: "LinkedIn",
    SALESFORCE: "Salesforce",
}

/** Suffixes that read better cased than shouted. */
const SUFFIX_CASE: Record<string, string> = {
    CORP: "Corp.",
    "CORP.": "Corp.",
    INC: "Inc.",
    "INC.": "Inc.",
    CO: "Co.",
    "CO.": "Co.",
    LTD: "Ltd.",
    "LTD.": "Ltd.",
    HOLDINGS: "Holdings",
    GROUP: "Group",
    TRUST: "Trust",
    COMPANY: "Company",
}

/**
 * "COCA COLA CO" becomes "Coca Cola Co.", "IBM" stays "IBM".
 *
 * Only touches names that arrive entirely in capitals, because a name the SEC
 * already cased ("Apple Inc.", "Robinhood Markets, Inc.") is better than
 * anything this could do to it.
 */
function prettyName(raw: string): string {
    const name = raw.trim()
    if (!name) return name

    // Mostly-capitals rather than entirely-capitals, because EDGAR mixes the
    // two: "PROCTER & GAMBLE Co" and "CVS HEALTH Corp" are shouted names with
    // a tidy suffix stuck on, and an all-caps test leaves both shouting. A
    // properly typed name like "Robinhood Markets, Inc." sits far below this
    // line and is left exactly as filed.
    const letters = name.replace(/[^A-Za-z]/g, "")
    if (letters.length === 0) return name
    const upperShare = letters.replace(/[^A-Z]/g, "").length / letters.length
    if (upperShare < 0.7) return name

    return name
        .split(/\s+/)
        .map((token) => {
            const bare = token.replace(/[.,]+$/, "")
            const key = bare.toUpperCase()
            // "TRUST," must not come back as "Trust": the comma is part of
            // the sentence, not the word.
            const comma = token.endsWith(",") ? "," : ""
            if (KEEP_UPPER.has(token) || KEEP_UPPER.has(key)) return token
            if (BRAND_CASE[key]) return BRAND_CASE[key] + comma
            if (SUFFIX_CASE[key]) return SUFFIX_CASE[key] + comma
            // Short tokens are nearly always initialisms.
            if (bare.length <= 3 && !/[AEIOU]/.test(bare.slice(1))) return token
            return token.charAt(0) + token.slice(1).toLowerCase()
        })
        .join(" ")
}

type TickerMap = Record<string, string>

/**
 * The SEC's whole ticker file as a lookup, cached for a day.
 *
 * About 776 KB on the wire and roughly a third of that once reduced to the two
 * fields we keep, so it sits well inside the data cache's ceiling. One fetch
 * serves every symbol for the day rather than one lookup per stock page.
 */
async function secTickers(): Promise<TickerMap> {
    try {
        const response = await fetch(SEC_TICKERS, {
            headers: SEC_HEADERS,
            next: { revalidate: REVALIDATE },
        })
        if (!response.ok) return {}
        const payload = (await response.json()) as Record<
            string,
            { ticker?: string; title?: string }
        >
        const out: TickerMap = {}
        for (const row of Object.values(payload)) {
            if (!row?.ticker || !row?.title) continue
            out[row.ticker.toUpperCase()] = row.title
        }
        return out
    } catch {
        // A name is a nicety. If the SEC is unreachable the page still prices
        // the stock, so this degrades to null rather than failing the request.
        return {}
    }
}

/**
 * One symbol's company name, or null when nothing authoritative knows it.
 *
 * Never returns the ticker as a stand-in. A caller that wants that fallback
 * has to write it, so it stays a visible decision rather than a silent one.
 */
export async function companyName(symbol: string): Promise<string | null> {
    const wanted = symbol.toUpperCase().trim()
    if (!wanted) return null

    const curated = symbolProfile(wanted)
    if (curated) return curated.name

    if (FUND_NAMES[wanted]) return FUND_NAMES[wanted]

    const sec = await secTickers()
    // Class shares reach the SEC file with a dash where the tape uses a dot.
    const hit = sec[wanted] ?? sec[wanted.replace(".", "-")]
    return hit ? prettyName(hit) : null
}

/** Names for a batch, resolved against one shared copy of the SEC file. */
export async function companyNames(symbols: string[]): Promise<Record<string, string>> {
    const wanted = [...new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean))]
    if (wanted.length === 0) return {}

    const needsSec = wanted.some((s) => !symbolProfile(s) && !FUND_NAMES[s])
    const sec = needsSec ? await secTickers() : {}

    const out: Record<string, string> = {}
    for (const symbol of wanted) {
        const curated = symbolProfile(symbol)
        if (curated) {
            out[symbol] = curated.name
            continue
        }
        if (FUND_NAMES[symbol]) {
            out[symbol] = FUND_NAMES[symbol]
            continue
        }
        const hit = sec[symbol] ?? sec[symbol.replace(".", "-")]
        if (hit) out[symbol] = prettyName(hit)
    }
    return out
}
