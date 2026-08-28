/**
 * The Key Stats figures, derived from a company's own SEC filings.
 *
 * WHY THIS EXISTS
 * ---------------
 * /api/stock returns a `stats` block and an `overview` block that the iOS Key
 * Stats section reads row by row. Since the move to Alpaca every field in them
 * has been null: Alpaca prices what trades and publishes no fundamentals. The
 * section still ships, and has been rendering three rows (price and the 52-week
 * pair) out of twelve.
 *
 * Everything here comes from the same company facts document /api/statements
 * already downloads, at the same 24h revalidate, so the two routes share one
 * cache entry rather than pulling a 4 MB file twice.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a fundamentals vendor. Filings land quarterly and late, so a margin here
 * is the last fiscal year's, not the last twelve weeks'. Every function returns
 * null rather than a fallback, and the app hides a row whose value is null.
 * When a real fundamentals feed is bought, delete this file and fill the same
 * field names from it: nothing above this layer knows where the numbers came
 * from.
 *
 * THE TRAPS, ALL THREE MEASURED
 * -----------------------------
 * 1. Share counts. dei:EntityCommonStockSharesOutstanding is the right concept,
 *    a cover-page count as of a date just before filing. But the XBRL APIs only
 *    aggregate facts that "apply to the entire filing entity", which drops
 *    every dimensioned per-share-class fact. So multi-class issuers either
 *    carry nothing or carry poison: GOOGL and META have no such fact at all,
 *    Berkshire's newest is from 2011, Fox's is the literal value 1, Paramount's
 *    is 0. A market cap built on those prints Berkshire at about $470M against
 *    about $1.1T. Hence `plausibleShareCount`, which demands a recent date and
 *    a sane magnitude and returns null otherwise. A hidden row beats a wrong
 *    one.
 *
 * 2. Trailing twelve months. There is no fourth 10-Q: a filer goes from Q3 to
 *    the 10-K. So the last four discrete quarters are not sitting there to be
 *    summed, and summing the four that ARE there silently substitutes a
 *    year-old quarter for the missing one. Apple comes out at 8.44 that way
 *    against a true 8.72. `trailingTwelveMonths` uses the identity that does
 *    hold: last full year, plus this year so far, minus the same span of last
 *    year.
 *
 * 3. Which tag a company uses for a line is per-company and changes mid-life.
 *    Apple's us-gaap:Revenues stops in 2018 with 11 points; its real revenue
 *    is under RevenueFromContractWithCustomerExcludingAssessedTax now and
 *    SalesRevenueNet before that. Tags are therefore merged across a list,
 *    newest filing winning, exactly as /api/statements does.
 */

import { cikFor, secJson, type SecResult } from "@/lib/sec"

/** Shared with /api/statements so both routes hit one cached document. */
export const FACTS_REVALIDATE = 86400

type Fact = {
    start?: string
    end: string
    val: number
    form?: string
    fp?: string
    filed?: string
}

export type Fundamentals = {
    sharesOutstanding: number | null
    marketCap: number | null
    epsTTM: number | null
    peRatio: number | null
    netMargin: number | null
    grossMargin: number | null
    revenueGrowth: number | null
    dividendYield: number | null
    /** Kept alongside the yield so a cached entry can be re-priced. */
    dividendsPerShareTTM: number | null
    /** Where the figures stop, so a caller can say "as of". */
    fiscalYear: number | null
    sharesAsOf: string | null
}

export const NO_FUNDAMENTALS: Fundamentals = {
    sharesOutstanding: null,
    marketCap: null,
    epsTTM: null,
    peRatio: null,
    netMargin: null,
    grossMargin: null,
    revenueGrowth: null,
    dividendYield: null,
    dividendsPerShareTTM: null,
    fiscalYear: null,
    sharesAsOf: null,
}

const REVENUE_TAGS = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
]
const NET_INCOME_TAGS = ["NetIncomeLoss", "ProfitLoss"]
const GROSS_PROFIT_TAGS = ["GrossProfit"]
const EPS_TAGS = ["EarningsPerShareDiluted"]
const DIVIDEND_PER_SHARE_TAGS = [
    "CommonStockDividendsPerShareDeclared",
    "CommonStockDividendsPerShareCashPaid",
]
/** Point-in-time counts only. A weighted average is the EPS denominator and
 *  is inflated by options and convertibles; it is never a market-cap input. */
const SHARE_COUNT_TAGS = ["CommonStockSharesOutstanding"]

/** The money or per-share facts for one tag, never whichever unit came first. */
const CURRENCY_KEY = /^[A-Z]{3}$/
const PER_SHARE_KEY = /^[A-Z]{3}\/shares$/

function unitsOf(node: any): Fact[] {
    const units = (node?.units ?? {}) as Record<string, Fact[]>
    const keys = Object.keys(units)
    if (!keys.length) return []
    const longest = (list: string[]) => list.sort((a, b) => units[b].length - units[a].length)[0]
    const money = keys.filter((k) => CURRENCY_KEY.test(k))
    if (money.length) return units[longest(money)]
    const perShare = keys.filter((k) => PER_SHARE_KEY.test(k))
    if (perShare.length) return units[longest(perShare)]
    if (units.shares) return units.shares
    return Object.values(units).sort((a, b) => b.length - a.length)[0] ?? []
}

/**
 * The currency the filer reports in.
 *
 * It matters because `price` is US dollars off a US exchange, and half the
 * figures below divide one by the other. ASML files us-gaap tags in EUROS:
 * its EPS is euros, its price is dollars, and price divided by EPS was
 * printing a P/E wrong by the whole exchange rate.
 */
function reportingCurrency(facts: Record<string, any>): string {
    const tally = new Map<string, number>()
    for (const tag of ["Assets", "Revenues", "Liabilities", "StockholdersEquity",
                       "NetIncomeLoss", "ProfitLoss"]) {
        const units = (facts[tag]?.units ?? {}) as Record<string, Fact[]>
        for (const [key, list] of Object.entries(units)) {
            if (!CURRENCY_KEY.test(key)) continue
            tally.set(key, (tally.get(key) ?? 0) + list.length)
        }
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD"
}

/**
 * Every annual report form, and their amendments. 10-K is the domestic filer,
 * 20-F the foreign private issuer, 40-F the Canadian MJDS filer. Amendments
 * count because a restated year should displace the one it restates.
 */
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"])

function isAnnualForm(u: Fact): boolean {
    return u.form !== undefined && ANNUAL_FORMS.has(u.form)
}

/** Whole months a duration fact covers. */
function months(u: Fact): number {
    if (!u.start) return 0
    return (
        (Number(u.end.slice(0, 4)) - Number(u.start.slice(0, 4))) * 12 +
        (Number(u.end.slice(5, 7)) - Number(u.start.slice(5, 7)))
    )
}

/**
 * The most recent annual value for a line, and the one before it.
 *
 * Merged across tags with earlier tags winning a tie, and restatements
 * resolved by filing date, so a company that changed tags mid-history keeps
 * one continuous series. Keyed on the period's END, not on `fy`: in company
 * facts `fy` describes the REPORT a number appeared in, so all three
 * comparative years inside one 10-K carry that 10-K's year.
 */
function annualSeries(facts: Record<string, any>, tags: string[]): Map<string, number> {
    const merged = new Map<string, number>()
    for (const tag of tags) {
        if (!facts[tag]) continue
        const best = new Map<string, Fact>()
        for (const u of unitsOf(facts[tag])) {
            if (!isAnnualForm(u)) continue
            if (u.start && months(u) < 11) continue
            const prev = best.get(u.end)
            if (!prev || (u.filed ?? "") > (prev.filed ?? "")) best.set(u.end, u)
        }
        for (const [end, fact] of best) if (!merged.has(end)) merged.set(end, fact.val)
    }
    return merged
}

/** Annual values newest first, as [periodEnd, value]. */
function newestFirst(series: Map<string, number>): [string, number][] {
    return [...series.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

/**
 * A share count worth multiplying a price by.
 *
 * The XBRL aggregation drops per-share-class facts, and what a multi-class
 * issuer leaves behind is worse than nothing: a count from 2011, or the
 * literal 1, or 0. Two gates, both cheap:
 *
 *   RECENT   the count must be dated within 400 days. Cover-page counts are
 *            refreshed every 10-Q, so anything older means the current one was
 *            dimensioned away.
 *   SANE     at least a hundred thousand shares. A public company with fewer
 *            has a share price in the millions; the real cases are Fox's 1 and
 *            Paramount's 0.
 *
 * Fails closed. Every caller renders an em dash on null.
 */
function plausibleShareCount(u: Fact | undefined, today: Date): number | null {
    if (!u) return null
    if (!Number.isFinite(u.val) || u.val < 100_000) return null
    const age = (today.getTime() - Date.parse(u.end + "T00:00:00Z")) / 86_400_000
    if (!Number.isFinite(age) || age > 400 || age < -30) return null
    return u.val
}

/**
 * Shares outstanding, preferring the cover-page count.
 *
 * dei:EntityCommonStockSharesOutstanding is dated a few days before the filing
 * and is the closest thing to "right now" in the document. us-gaap's
 * CommonStockSharesOutstanding is the balance-sheet date, weeks older, and is
 * the fallback rather than the first choice.
 */
function sharesOutstanding(
    dei: Record<string, any>,
    gaap: Record<string, any>,
    today: Date
): { value: number; asOf: string } | null {
    const candidates: Fact[] = []
    const cover = unitsOf(dei?.EntityCommonStockSharesOutstanding)
    if (cover.length) candidates.push(...cover.filter((u) => !u.start))
    for (const tag of SHARE_COUNT_TAGS) {
        if (gaap?.[tag]) candidates.push(...unitsOf(gaap[tag]).filter((u) => !u.start))
    }
    // Cover-page facts are pushed first, so a tie on date keeps the cover count.
    const newest = candidates.sort((a, b) => (a.end < b.end ? 1 : -1))[0]
    const value = plausibleShareCount(newest, today)
    return value === null ? null : { value, asOf: newest!.end }
}

/**
 * Trailing twelve months for a duration line.
 *
 * Not a sum of four quarters, because the fourth does not exist as a filed
 * period. The identity used instead:
 *
 *     TTM = last full fiscal year
 *         + the current year to date
 *         − the same year-to-date span of the prior year
 *
 * Year-to-date facts are exactly what a 10-Q reports: a Q3 filing carries a
 * nine-month duration. The prior year's matching span is found by month count,
 * not by `fp`, since `fp` describes the report rather than the period.
 *
 * Returns the annual figure unchanged when the year is fresh and no interim
 * period has been filed yet, which is correct: twelve months ago IS the year.
 */
function trailingTwelveMonths(facts: Record<string, any>, tags: string[]): number | null {
    const annual = newestFirst(annualSeries(facts, tags))
    if (!annual.length) return null
    const [lastYearEnd, lastYearValue] = annual[0]

    // Cumulative interim periods, newest first, that start after the last full
    // year ended. A 10-Q's year-to-date always begins the day the year did.
    const interim: Fact[] = []
    for (const tag of tags) {
        if (!facts[tag]) continue
        for (const u of unitsOf(facts[tag])) {
            if (isAnnualForm(u) || !u.start) continue
            if (u.start <= lastYearEnd) continue
            const span = months(u)
            if (span < 2 || span > 11) continue
            interim.push(u)
        }
    }
    if (!interim.length) return lastYearValue

    // The longest span wins, and among equals the most recently filed, so a
    // restated nine months beats the original.
    // Longest span first, and among equal spans the most recently filed, so a
    // restated nine months beats the original nine months.
    interim.sort((a, b) => months(b) - months(a) || (b.filed ?? "").localeCompare(a.filed ?? ""))
    const current = interim[0]
    const span = months(current)

    // The same span one year earlier, so the subtraction removes exactly what
    // the addition put in.
    let prior: Fact | undefined
    for (const tag of tags) {
        if (!facts[tag]) continue
        for (const u of unitsOf(facts[tag])) {
            if (isAnnualForm(u) || !u.start) continue
            if (months(u) !== span) continue
            if (u.end >= current.start!) continue
            if (Number(lastYearEnd.slice(0, 4)) - Number(u.end.slice(0, 4)) > 1) continue
            if (!prior || u.end > prior.end || (u.end === prior.end && (u.filed ?? "") > (prior.filed ?? "")))
                prior = u
        }
    }
    if (!prior) return lastYearValue
    return lastYearValue + current.val - prior.val
}

function ratio(numerator: number | null, denominator: number | null): number | null {
    if (numerator === null || denominator === null) return null
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
    // A percentage of a zero or negative base is not a percentage. A company
    // whose losses shrank would otherwise print as negative growth.
    if (denominator <= 0) return null
    return (numerator / denominator) * 100
}

/**
 * Everything Key Stats needs, from one company facts document and a live price.
 *
 * `price` comes from Alpaca and is the only input here that is current; every
 * other figure is as filed. Market cap and the P/E are therefore a live price
 * against a filed denominator, which is what those ratios are everywhere.
 */
export function fundamentalsFrom(doc: any, price: number | null, now: Date = new Date()): Fundamentals {
    const gaap = doc?.facts?.["us-gaap"]
    const dei = doc?.facts?.dei
    if (!gaap) return NO_FUNDAMENTALS

    const revenue = newestFirst(annualSeries(gaap, REVENUE_TAGS))
    const netIncome = newestFirst(annualSeries(gaap, NET_INCOME_TAGS))
    const grossProfit = newestFirst(annualSeries(gaap, GROSS_PROFIT_TAGS))

    const latestRevenue = revenue[0]?.[1] ?? null
    const priorRevenue = revenue[1]?.[1] ?? null
    const latestYearEnd = revenue[0]?.[0] ?? netIncome[0]?.[0] ?? null

    // Net income and gross profit are only comparable to revenue from the same
    // period, so they are matched on the period end rather than taken as
    // "whichever is newest".
    const netIncomeSameYear =
        latestYearEnd !== null ? netIncome.find(([end]) => end === latestYearEnd)?.[1] ?? null : null
    const grossProfitSameYear =
        latestYearEnd !== null ? grossProfit.find(([end]) => end === latestYearEnd)?.[1] ?? null : null

    const shares = sharesOutstanding(dei, gaap, now)
    const epsTTM = trailingTwelveMonths(gaap, EPS_TAGS)
    const dividendsTTM = trailingTwelveMonths(gaap, DIVIDEND_PER_SHARE_TAGS)

    const usablePrice = price !== null && Number.isFinite(price) && price > 0 ? price : null

    // A filer reporting in its own currency cannot be divided by a US dollar
    // price. The ratios below that mix the two are withheld rather than
    // printed wrong: ASML's P/E was out by the whole EUR/USD rate, roughly
    // 15%, and its dividend yield with it. The pure ratios, margins and
    // growth, divide same-currency figures and are unaffected.
    const currency = reportingCurrency(gaap)
    const comparableToPrice = currency === "USD"

    return {
        sharesOutstanding: shares?.value ?? null,
        sharesAsOf: shares?.asOf ?? null,
        marketCap: shares && usablePrice ? shares.value * usablePrice : null,
        // Withheld rather than mislabelled when it is not in dollars: every
        // reader of this field, the Key Stats row and the portfolio's
        // "earnings behind your shares", treats it as dollars per share.
        epsTTM: comparableToPrice ? epsTTM : null,
        // A negative or zero EPS has no meaningful price-to-earnings multiple;
        // the convention everywhere is to omit it rather than print a negative.
        peRatio:
            comparableToPrice && usablePrice && epsTTM !== null && epsTTM > 0
                ? usablePrice / epsTTM
                : null,
        netMargin: ratio(netIncomeSameYear, latestRevenue),
        grossMargin: ratio(grossProfitSameYear, latestRevenue),
        revenueGrowth:
            latestRevenue !== null && priorRevenue !== null && priorRevenue > 0
                ? (latestRevenue / priorRevenue - 1) * 100
                : null,
        dividendYield:
            comparableToPrice && usablePrice && dividendsTTM !== null && dividendsTTM > 0
                ? (dividendsTTM / usablePrice) * 100
                : null,
        dividendsPerShareTTM: comparableToPrice ? dividendsTTM : null,
        fiscalYear: latestYearEnd ? Number(latestYearEnd.slice(0, 4)) : null,
    }
}

/**
 * The derived figures per CIK, so a warm instance reads the 4 MB document once.
 *
 * Next's data cache does not store a fetch response over 2 MB, and company
 * facts is 3.8 MB for Apple and 7.9 MB for JPMorgan. Without this every stock
 * page view on a large filer would pull the whole document again, against a
 * limit of ten requests per second shared across the entire deployment.
 *
 * What is kept is the DERIVED object, ten numbers, not the document. So the
 * memory cost is bytes rather than megabytes and the 2 MB ceiling stops
 * mattering. Small filers stay inside Next's cache as well and get both.
 *
 * Deliberately a plain Map and not a KV store. It is per-instance and empty
 * after a cold start, which is the honest limit of it: this reduces repeat
 * work, it does not guarantee a single fetch across a fleet. It also needs no
 * service, no credentials and no configuration, which is what makes it
 * shippable now. If stock pages ever carry enough traffic for the SEC to
 * rate-limit us anyway, the fix is a real shared cache in front of `secJson`,
 * and every route benefits rather than only this one.
 *
 * Everything below is priced against the live quote OUTSIDE the cache, so a
 * cached entry never serves a stale market cap or P/E.
 */
type CacheEntry = { at: number; value: Fundamentals }
const derived = new Map<string, CacheEntry>()
const CACHE_TTL_MS = FACTS_REVALIDATE * 1000
/** Filings do not change often; this is a working set, not a database. */
const CACHE_MAX = 500

function cached(cik: string, now: number): Fundamentals | null {
    const hit = derived.get(cik)
    if (!hit) return null
    if (now - hit.at > CACHE_TTL_MS) {
        derived.delete(cik)
        return null
    }
    // Re-inserted so the eviction below drops the least recently READ, not the
    // least recently written.
    derived.delete(cik)
    derived.set(cik, hit)
    return hit.value
}

function remember(cik: string, value: Fundamentals, now: number): void {
    derived.set(cik, { at: now, value })
    while (derived.size > CACHE_MAX) {
        const oldest = derived.keys().next()
        if (oldest.done) break
        derived.delete(oldest.value)
    }
}

/**
 * Everything except the price, which is why this is cacheable at all.
 *
 * Splitting the filed half from the priced half is the whole trick: the filed
 * half changes quarterly and the priced half changes every second, so they
 * cannot share a lifetime.
 */
function priced(base: Fundamentals, price: number | null): Fundamentals {
    const usable = price !== null && Number.isFinite(price) && price > 0 ? price : null
    if (!usable) return { ...base, marketCap: null, peRatio: null, dividendYield: base.dividendYield }
    return {
        ...base,
        marketCap: base.sharesOutstanding !== null ? base.sharesOutstanding * usable : null,
        peRatio: base.epsTTM !== null && base.epsTTM > 0 ? usable / base.epsTTM : null,
        dividendYield: base.dividendsPerShareTTM !== null && base.dividendsPerShareTTM > 0
            ? (base.dividendsPerShareTTM / usable) * 100
            : null,
    }
}

/** Fetch and derive in one call. Never throws; an unreachable SEC is null. */
export async function fundamentalsFor(symbol: string, price: number | null): Promise<Fundamentals> {
    const cik = await cikFor(symbol)
    if (cik.status !== "ok") return NO_FUNDAMENTALS

    const now = Date.now()
    const hit = cached(cik.data, now)
    if (hit) return priced(hit, price)

    const facts: SecResult<any> = await secJson<any>(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.data}.json`,
        FACTS_REVALIDATE
    )
    // A refusal is not cached. "The SEC rate-limited us" must not become this
    // symbol's answer for the next day.
    if (facts.status !== "ok") return NO_FUNDAMENTALS

    const base = fundamentalsFrom(facts.data, null)
    remember(cik.data, base, now)
    return priced(base, price)
}
