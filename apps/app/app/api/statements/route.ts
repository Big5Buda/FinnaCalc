import { NextRequest, NextResponse } from "next/server";
import { cikFor, OK, reportOf, secJson, type SourceReport } from "@/lib/sec";

// Ten years of income statement, balance sheet and cash flow, from the SEC's
// free XBRL company-facts data. No API key and no database: one SEC call per
// company per day, cached at the edge, so traffic never reaches their servers.
//
// GET /api/statements?symbol=AAPL
//
// The SEC asks two things of automated callers: stay under 10 requests per
// second, and identify yourself in the User-Agent with a working contact.
// Set SEC_CONTACT, e.g. "FinnaCalc you@finnacalc.com".
//
// The response always carries `status` and `reason` (see lib/sec.ts), because
// an empty `statements` array means two very different things: this company
// files nothing we can read, or the SEC wouldn't tell us. Only the first is
// safe to render as a missing section.
//
// `years` and `statements` are the annual table and are unchanged. Quarters
// ride alongside them in `quarters` and `quarterlyStatements`, so a client that
// only knows the annual keys keeps working without being touched.

export const revalidate = 86400;

// Each row lists the us-gaap tags companies actually use, best first. Tags are
// MERGED across the list rather than first-wins: filers change tags mid-history
// (Apple moved off SalesRevenueNet when ASC 606 landed in 2019), so first-wins
// silently drops every year before the switch.
type Row = [label: string, tags: string[]];

const INCOME: Row[] = [
    ["Revenue", [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
    ]],
    ["Cost of revenue", [
        "CostOfRevenue",
        "CostOfGoodsAndServicesSold",
        "CostOfGoodsSold",
    ]],
    ["Gross profit", ["GrossProfit"]],
    ["Research & development", ["ResearchAndDevelopmentExpense"]],
    ["Selling, general & admin", [
        "SellingGeneralAndAdministrativeExpense",
        "GeneralAndAdministrativeExpense",
    ]],
    ["Operating income", ["OperatingIncomeLoss"]],
    ["Pretax income", [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ]],
    ["Income tax", ["IncomeTaxExpenseBenefit"]],
    ["Net income", ["NetIncomeLoss", "ProfitLoss"]],
    ["Earnings per share (diluted)", ["EarningsPerShareDiluted"]],
];

const BALANCE: Row[] = [
    ["Cash & equivalents", ["CashAndCashEquivalentsAtCarryingValue"]],
    ["Total current assets", ["AssetsCurrent"]],
    ["Total assets", ["Assets"]],
    ["Total current liabilities", ["LiabilitiesCurrent"]],
    ["Long-term debt", ["LongTermDebtNoncurrent", "LongTermDebt"]],
    ["Total liabilities", ["Liabilities"]],
    ["Shareholders equity", [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ]],
];

const CASHFLOW: Row[] = [
    ["Operating cash flow", [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ]],
    ["Capital expenditure", ["PaymentsToAcquirePropertyPlantAndEquipment"]],
    ["Investing cash flow", ["NetCashProvidedByUsedInInvestingActivities"]],
    ["Financing cash flow", ["NetCashProvidedByUsedInFinancingActivities"]],
    ["Dividends paid", ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"]],
    ["Share buybacks", ["PaymentsForRepurchaseOfCommonStock"]],
];

/**
 * The same three statements, tagged the way a company reporting under IFRS
 * tags them.
 *
 * A foreign private issuer publishes ifrs-full tags, not us-gaap ones, so
 * every lookup in the lists above finds nothing for it. That is not a gap in
 * what the SEC holds. Spotify's company facts carry ten full years of
 * revenue, cost of sales, gross profit, R&D, operating profit, net income,
 * diluted EPS, the balance sheet and all three cash flows, every one of them
 * filed on a 20-F. They are simply under different names.
 *
 * Rows a filer does not tag are dropped by the existing all-null filter, the
 * same way a bank drops gross profit under us-gaap.
 */
const IFRS_INCOME: Row[] = [
    ["Revenue", [
        "Revenue",
        "RevenueFromContractsWithCustomers",
        "RevenueFromSaleOfGoods",
        "RevenueFromRenderingOfServices",
    ]],
    ["Cost of revenue", ["CostOfSales", "CostOfMerchandiseSold"]],
    ["Gross profit", ["GrossProfit"]],
    ["Research & development", ["ResearchAndDevelopmentExpense"]],
    ["Selling, general & admin", [
        "SellingGeneralAndAdministrativeExpense",
        "AdministrativeExpense",
        "GeneralAndAdministrativeExpense",
    ]],
    ["Operating income", ["ProfitLossFromOperatingActivities", "OperatingIncomeLoss"]],
    ["Pretax income", ["ProfitLossBeforeTax"]],
    ["Income tax", ["IncomeTaxExpenseContinuingOperations"]],
    ["Net income", ["ProfitLoss", "ProfitLossAttributableToOwnersOfParent"]],
    ["Earnings per share (diluted)", ["DilutedEarningsLossPerShare"]],
];

const IFRS_BALANCE: Row[] = [
    ["Cash & equivalents", ["CashAndCashEquivalents"]],
    ["Total current assets", ["CurrentAssets"]],
    ["Total assets", ["Assets"]],
    ["Total current liabilities", ["CurrentLiabilities"]],
    ["Long-term debt", [
        "NoncurrentPortionOfNoncurrentBorrowings",
        "LongtermBorrowings",
        "NoncurrentBorrowings",
    ]],
    ["Total liabilities", ["Liabilities"]],
    ["Shareholders equity", ["EquityAttributableToOwnersOfParent", "Equity"]],
];

const IFRS_CASHFLOW: Row[] = [
    ["Operating cash flow", ["CashFlowsFromUsedInOperatingActivities"]],
    ["Capital expenditure", [
        "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    ]],
    ["Investing cash flow", ["CashFlowsFromUsedInInvestingActivities"]],
    ["Financing cash flow", ["CashFlowsFromUsedInFinancingActivities"]],
    ["Dividends paid", [
        "DividendsPaidClassifiedAsFinancingActivities",
        "DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities",
    ]],
    ["Share buybacks", [
        "PaymentsToAcquireOrRedeemEntitysShares",
        "PurchaseOfTreasuryShares",
    ]],
];

type Fact = {
    start?: string;
    end: string;
    val: number;
    form?: string;
    fy?: number;
    fp?: string;
    filed?: string;
    accn?: string;
};

/**
 * The facts for one tag, in the currency the company actually reports in.
 *
 * It used to name USD outright. That is right for a domestic filer and wrong
 * for the 20-F and 40-F crowd: Spotify reports in EUR, Sony in JPY, Canadian
 * National in CAD, and none of them has a USD key at all, so every lookup fell
 * through to "whichever list is longest" and worked by luck.
 *
 * Preferring a currency unit still does the job the old code was written for.
 * Walmart's diluted EPS carries three stray `pure` facts ahead of its 300-odd
 * real ones; `USD/shares` is a per-share currency key and `pure` is not, so
 * the real ones still win.
 */
const CURRENCY_KEY = /^[A-Z]{3}$/;
const PER_SHARE_KEY = /^[A-Z]{3}\/shares$/;

function unitsOf(node: any, currency?: string): Fact[] {
    const units = (node?.units ?? {}) as Record<string, Fact[]>;
    const keys = Object.keys(units);
    if (!keys.length) return [];
    // The document's own currency first, wherever the caller knows it.
    // Deciding per tag instead would mix two currencies inside one table:
    // Alibaba and NIO tag most lines in CNY and publish a USD convenience
    // translation beside them, so "whichever list is longer" can answer CNY
    // for revenue and USD for the line under it.
    if (currency) {
        if (units[currency]) return units[currency];
        if (units[`${currency}/shares`]) return units[`${currency}/shares`];
    }
    const longest = (list: string[]) =>
        list.sort((a, b) => units[b].length - units[a].length)[0];
    const money = keys.filter((k) => CURRENCY_KEY.test(k));
    if (money.length) return units[longest(money)];
    const perShare = keys.filter((k) => PER_SHARE_KEY.test(k));
    if (perShare.length) return units[longest(perShare)];
    return Object.values(units).sort((a, b) => b.length - a.length)[0] ?? [];
}

/**
 * The three-letter code the statements are denominated in.
 *
 * Read off the tags most companies report rather than assumed, and sent to
 * the client so a table of euros is never drawn with a dollar sign on it.
 * Falls back to USD only when nothing monetary is tagged at all.
 */
function reportingCurrency(facts: Record<string, any>): string {
    const tally = new Map<string, number>();
    for (const tag of ["Assets", "Revenue", "Revenues", "Liabilities", "Equity",
                       "StockholdersEquity", "ProfitLoss", "NetIncomeLoss"]) {
        const units = (facts[tag]?.units ?? {}) as Record<string, Fact[]>;
        for (const [key, list] of Object.entries(units)) {
            if (!CURRENCY_KEY.test(key)) continue;
            tally.set(key, (tally.get(key) ?? 0) + list.length);
        }
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
}

/**
 * The annual report forms, and their amendments.
 *
 * 10-K is the US domestic filer. 20-F is the foreign private issuer, which is
 * Spotify, ASML and Toyota. 40-F is the Canadian MJDS filer, which is Royal
 * Bank and Canadian National. All three are the same document for this
 * purpose: one audited year. Leaving 40-F out cost Shopify its entire revenue
 * history, every one of whose twelve annual facts is tagged under a 40-F.
 *
 * Amendments count. `series` resolves a period by filing date, so a 20-F/A
 * restating a year displaces the 20-F it amends, which is the right answer.
 * Excluding them was never a safeguard; it just dropped restated years.
 *
 * 6-K is deliberately absent. It is the foreign issuer's interim report and
 * carries part-years, and this decides what a WHOLE year is.
 */
const ANNUAL_FORMS = new Set([
    "10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A",
]);

function isAnnualForm(u: Fact): boolean {
    return u.form !== undefined && ANNUAL_FORMS.has(u.form);
}

/**
 * The forms a discrete quarter can arrive on.
 *
 * 10-Q is the domestic filer. 6-K is the foreign private issuer's interim
 * report, and it belongs here for the same reason 40-F belongs on the annual
 * list: a Canadian MJDS filer tags its quarters there and nowhere else. Royal
 * Bank of Canada publishes twenty-five quarter ends that way.
 *
 * This does NOT invent quarters for a filer that has none. Spotify, SAP,
 * Sony, ASML and Toyota tag no interim statements at all, because the SEC has
 * never required XBRL in a 6-K and none of them volunteers it, so they return
 * exactly what they returned before, which is nothing. Spotify has 94 filings
 * on 6-K and not one carries a fact.
 */
const QUARTERLY_FORMS = new Set(["10-Q", "10-Q/A", "6-K", "6-K/A"]);

function isQuarterlyForm(u: Fact): boolean {
    return u.form !== undefined && QUARTERLY_FORMS.has(u.form);
}

/**
 * How far behind a company's own newest figure a quarter rail may fall.
 *
 * A rail that stopped years before the company last reported is history, not
 * the current shape of the business, and drawing it beside a current annual
 * table reads as though the data were fresh. Canadian National is the live
 * example: the only quarters it ever tagged end 2009-09-30, on 6-K, while it
 * reports to this day. A filer sitting between its annual report and its next
 * quarter shows a gap of about ninety days, so both stay well inside this.
 */
const QUARTER_STALE_DAYS = 450;

/** The month a company closes its books, read off its own annual balances. */
function fiscalYearEndMonth(facts: Record<string, any>, currency: string): number {
    for (const tag of ["Assets", "StockholdersEquity", "Liabilities"]) {
        const months = unitsOf(facts[tag], currency)
            .filter((u) => isAnnualForm(u) && u.fp === "FY")
            .map((u) => Number(u.end.slice(5, 7)));
        if (months.length) {
            const tally = new Map<number, number>();
            for (const m of months) tally.set(m, (tally.get(m) ?? 0) + 1);
            return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }
    }
    return 12;
}

/**
 * Which fiscal year a period belongs to, taken from its END date.
 *
 * Deliberately NOT the `fy` field. In company facts, `fy` and `fp` describe the
 * REPORT a number appeared in, so all three comparative years inside one 10-K
 * carry that 10-K's fy. Keying on it shifts the whole table by a year or more,
 * which is how a chart ends up labelling FY2023 revenue as 2025.
 *
 * A period belongs to the year it ends in, unless the books close early in the
 * calendar year (January to May, common in retail), where it covers mostly the
 * prior year and is labelled that way so companies stay comparable.
 */
function fiscalYear(end: string, fyeMonth: number): number {
    const year = Number(end.slice(0, 4));
    return fyeMonth <= 5 ? year - 1 : year;
}

/** Annual values by fiscal year, merged across tags; newest filing wins. */
function series(facts: Record<string, any>, tags: string[], fyeMonth: number, currency: string) {
    const merged = new Map<number, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<number, Fact>();
        for (const u of unitsOf(facts[tag], currency)) {
            if (!isAnnualForm(u)) continue;
            if (u.start) {
                // A duration fact must cover the year, not a quarter inside it.
                const months =
                    (Number(u.end.slice(0, 4)) - Number(u.start.slice(0, 4))) * 12 +
                    (Number(u.end.slice(5, 7)) - Number(u.start.slice(5, 7)));
                if (months < 11) continue;
            }
            const fy = fiscalYear(u.end, fyeMonth);
            const prev = best.get(fy);
            // Restatements: the most recently filed version of a period wins.
            if (!prev || (u.filed ?? "") > (prev.filed ?? "")) best.set(fy, u);
        }
        // Earlier tags in the list are more authoritative, so never overwrite.
        for (const [fy, fact] of best) if (!merged.has(fy)) merged.set(fy, fact.val);
    }
    return merged;
}

// ---------------------------------------------------------------------------
// Quarters
//
// Additive: `years`/`statements` above are untouched, and everything below
// lands in `quarters`/`quarterlyStatements`. Both are ordered oldest first,
// most recent LAST, the same way `years` is, and `quarterlyStatements` values
// are positionally aligned to `quarters`.
//
// Far fewer lines than the annual table on purpose. A quarter gets a fraction
// of the room on the card, so this is the handful a reader actually scans.
// ---------------------------------------------------------------------------

/** Longest a period can run and still be one discrete quarter, not a roll-up. */
const QUARTER_MAX_DAYS = 100;

/**
 * Five years of quarters. Three covered a single cycle; five shows the shape
 * either side of one, and the rail scrolls, so the extra periods cost no room.
 *
 * A wider window reaches back past events the narrow one never met. Both of
 * these are as-filed rather than introduced here, and are written down so the
 * next reader does not mistake them for a fault in the derivation:
 *
 *   - Per-share lines carry the share count of the newest filing that still
 *     included the period. A 10-Q restates only the year-ago quarter, so
 *     quarters older than a stock split keep their pre-split base while newer
 *     ones are split-adjusted. Walmart's 3-for-1 in February 2024 puts that
 *     step between its FY2023 Q3 and FY2024 Q1.
 *   - The Q4 residual nets the newest annual figure against the newest
 *     quarters, and those are not always the same vintage. A filer that moves
 *     a segment to discontinued operations restates the year in its next 10-K
 *     and never refiles the old 10-Qs, so the two halves of the subtraction
 *     describe different companies. GE's FY2022 nets a twice-restated year
 *     against once-restated quarters and lands below zero.
 */
/**
 * Five fiscal YEARS of quarters, not a count of quarters.
 *
 * Counting gives a ragged edge: twenty quarters reach into a sixth fiscal
 * year and leave it holding one, so the app draws a card that is almost
 * entirely dashes and a reader counts four usable years rather than five.
 * Selecting whole years gives five cards, each with everything that year
 * filed.
 *
 * The newest year stays in even though it is partial. A company three
 * quarters into its year has genuinely reported those three, and hiding them
 * to tidy the grid would withhold the most current figures on the page.
 */
const QUARTER_YEARS = 5;

type QuarterPart = "Q1" | "Q2" | "Q3" | "Q4";
type Quarter = { fy: number; fp: QuarterPart; label: string; end: string };
type QuarterlyStatement = {
    name: string;
    rows: { label: string; values: (number | null)[] }[];
};

/** Rows by label, so the tag lists stay defined in exactly one place. */
function pick(rows: Row[], labels: string[]): Row[] {
    return labels
        .map((label) => rows.find((row) => row[0] === label))
        .filter((row): row is Row => row !== undefined);
}

/**
 * Three kinds of line, and they cannot share one derivation:
 *
 *   FLOWS     accumulate across the quarter (revenue, operating income, net
 *             income). A 10-Q tags the discrete three months AND the six or
 *             nine months to date, so the duration filter is what keeps a
 *             year-to-date total out of a single quarter's column. Q4 is a
 *             residual (below).
 *
 *   RATIOS    are per share (diluted EPS). The filed quarters are exact, but
 *             the residual is NOT valid here: annual EPS divides by the whole
 *             year's weighted average share count, so subtracting three
 *             quarters struck on three other denominators lands a cent or two
 *             out. Apple's FY2025 works out to 1.84 that way against the 1.85
 *             it reported. Left blank rather than nearly right.
 *
 *   INSTANTS  are a balance on a date, not a flow (cash, and the rest of the
 *             balance sheet). Read at the quarter's end date and NEVER
 *             differenced. Cash on 30 June is not last quarter's cash plus
 *             something, and subtracting it the way revenue is subtracted
 *             produces a confident, entirely fictional number.
 */
const QUARTERLY_FLOW_LABELS = ["Revenue", "Operating income", "Net income"];

/**
 * Lines whose Q4 residual cannot legitimately come out negative.
 *
 * Revenue is money in. A quarter can be terrible and it can be zero, but it
 * cannot be minus twelve billion dollars, so a negative residual is not a bad
 * quarter, it is proof the subtraction mixed two vintages of the same year.
 *
 * Not hypothetical. GE restated FY2022 twice after spinning off HealthCare
 * and Vernova: the annual figure in company facts is the newest restatement
 * (29.1B) while Q1 to Q3 were last restated in the 2023 10-Qs (41.3B between
 * them). Subtracting one from the other yields -12.1B, and widening the
 * window from three years to five is what brings that year into view.
 *
 * Operating income and net income are NOT on this list, deliberately. A
 * loss-making quarter is real: Rivian files four a year, and suppressing
 * those would delete true figures to avoid a false one.
 *
 * This catches the impossible case only. A restatement that leaves the
 * residual positive but understated (GE FY2023 lands at 2.8B this way) cannot
 * be spotted by sign, and fixing it properly means matching the vintage of
 * the annual figure to the vintage of the quarters, which is a larger change.
 */
const NON_NEGATIVE_FLOWS = new Set(["Revenue"]);
/**
 * Labels, not resolved rows, because which tag list they resolve against
 * depends on the taxonomy the filer used. These were bound to the us-gaap
 * INCOME and BALANCE lists at module load, so an ifrs-full filer had every
 * quarterly lookup miss, the same way the annual table missed before
 * pickTaxonomy existed. The labels are identical in both row lists, so `pick`
 * and NON_NEGATIVE_FLOWS keep working untouched.
 */
const QUARTERLY_RATIO_LABELS = ["Earnings per share (diluted)"];
const QUARTERLY_INSTANT_LABELS = ["Cash & equivalents"];

function daysBetween(start: string, end: string): number {
    return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

/**
 * The date each fiscal year's books closed, keyed the way `years` is keyed.
 *
 * The Q4 residual needs both halves of that join: which annual figure a set of
 * quarters rolls up into, and the date the year ended on, which is Q4's own
 * end date. Both are read off the filings rather than guessed from a month.
 */
function fiscalYearEnds(facts: Record<string, any>, tags: string[], fyeMonth: number, currency: string) {
    const closes = new Map<number, string>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        for (const u of unitsOf(facts[tag], currency)) {
            if (!isAnnualForm(u) || !u.start) continue;
            if (daysBetween(u.start, u.end) < 330) continue;
            const fy = fiscalYear(u.end, fyeMonth);
            const prev = closes.get(fy);
            if (!prev || u.end > prev) closes.set(fy, u.end);
        }
    }
    return closes;
}

/**
 * Which fiscal quarter each period end belongs to, in the company's own words.
 *
 * Fiscal quarters don't track calendar ones (Apple's FY2026 Q1 ended on
 * 2025-12-27), so the label has to come from the filer, never from the month.
 * But `fy`/`fp` describe the REPORT a fact appeared in, not the period it
 * covers: a 10-Q also carries the year-ago quarter for comparison, and that
 * comparative is tagged with THIS filing's quarter. Apple's quarter ending
 * 2023-12-30 sits inside the January 2025 filing tagged fy 2025, fp Q1.
 *
 * So a label is only trustworthy for a filing's own current period, which is
 * the latest discrete quarter in that accession. Every quarter is some 10-Q's
 * current period exactly once, so one pass over the filings names them all,
 * and the comparatives inherit by end date.
 */
function quarterCalendar(facts: Record<string, any>, tags: string[], currency: string) {
    // Accession -> the newest quarter it reports, i.e. the one it is about.
    const current = new Map<string, Fact>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        for (const u of unitsOf(facts[tag], currency)) {
            if (!isQuarterlyForm(u) || !u.start || !u.accn) continue;
            if (typeof u.fy !== "number") continue;
            if (u.fp !== "Q1" && u.fp !== "Q2" && u.fp !== "Q3") continue;
            // A cumulative six- or nine-month figure is not a quarter.
            if (daysBetween(u.start, u.end) > QUARTER_MAX_DAYS) continue;
            const prev = current.get(u.accn);
            if (!prev || u.end > prev.end) current.set(u.accn, u);
        }
    }

    const calendar = new Map<string, { fy: number; fp: QuarterPart }>();
    const filedBy = new Map<string, string>();
    for (const u of current.values()) {
        // An amended filing renames nothing, but the newest one still wins.
        if ((filedBy.get(u.end) ?? "") > (u.filed ?? "")) continue;
        filedBy.set(u.end, u.filed ?? "");
        calendar.set(u.end, { fy: u.fy as number, fp: u.fp as QuarterPart });
    }
    return calendar;
}

/** Discrete quarterly values by period end, merged across tags; newest filing wins. */
function quarterSeries(facts: Record<string, any>, tags: string[], ends: Set<string>, currency: string) {
    const merged = new Map<string, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<string, Fact>();
        for (const u of unitsOf(facts[tag], currency)) {
            if (!isQuarterlyForm(u) || !u.start || !ends.has(u.end)) continue;
            if (daysBetween(u.start, u.end) > QUARTER_MAX_DAYS) continue;
            const prev = best.get(u.end);
            if (!prev || (u.filed ?? "") > (prev.filed ?? "")) best.set(u.end, u);
        }
        for (const [end, fact] of best) if (!merged.has(end)) merged.set(end, fact.val);
    }
    return merged;
}

/** Balances by date: instants (no `start`), read at the date and never differenced. */
function instantSeries(facts: Record<string, any>, tags: string[], ends: Set<string>, currency: string) {
    const merged = new Map<string, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<string, Fact>();
        for (const u of unitsOf(facts[tag], currency)) {
            if (u.start || !ends.has(u.end)) continue;
            const prev = best.get(u.end);
            if (!prev || (u.filed ?? "") > (prev.filed ?? "")) best.set(u.end, u);
        }
        for (const [end, fact] of best) if (!merged.has(end)) merged.set(end, fact.val);
    }
    return merged;
}

/**
 * Quarters and their rows.
 *
 * Q1 to Q3 come straight out of the 10-Qs. There is no fourth 10-Q, because a
 * filer goes from Q3 straight to the 10-K, so Q4 has to be the year minus the
 * three quarters that were filed, and only when the annual figure and all
 * three quarters are present. A residual against a missing input is not a
 * quarter, it's a guess, so the cell stays null instead.
 */
function quarterlyReport(
    facts: Record<string, any>,
    fyeMonth: number,
    currency: string,
    income: Row[],
    balance: Row[],
) {
    const flows = pick(income, QUARTERLY_FLOW_LABELS);
    const ratios = pick(income, QUARTERLY_RATIO_LABELS);
    const instants = pick(balance, QUARTERLY_INSTANT_LABELS);
    const durationTags = [...flows, ...ratios].flatMap(([, tags]) => tags);
    const calendar = quarterCalendar(facts, durationTags, currency);
    const closes = fiscalYearEnds(facts, durationTags, fyeMonth, currency);

    // A quarter belongs to the fiscal year whose books close next. That holds
    // for any closing month without consulting the calendar: Apple's quarter
    // ending 2025-12-27 rolls into the year that closes in September 2026.
    const closesByDate = [...closes.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1));
    const byYear = new Map<number, Map<QuarterPart, string>>();
    for (const [end, { fp }] of calendar) {
        const close = closesByDate.find(([, date]) => date >= end);
        if (!close) continue;
        const bucket = byYear.get(close[0]) ?? new Map<QuarterPart, string>();
        bucket.set(fp, end);
        byYear.set(close[0], bucket);
    }

    const quarters: Quarter[] = [...calendar.entries()].map(([end, { fy, fp }]) => ({
        fy,
        fp,
        label: `FY${fy} ${fp}`,
        end,
    }));

    /** Q4 end date -> the annual figure to start from and the quarters to net off. */
    const residuals = new Map<string, { year: number; parts: string[] }>();
    for (const [year, bucket] of byYear) {
        const close = closes.get(year);
        const parts = (["Q1", "Q2", "Q3"] as const).map((fp) => bucket.get(fp));
        if (!close || parts.some((end) => end === undefined)) continue;
        // The company's own year label, carried over from its own third quarter.
        const fy = calendar.get(bucket.get("Q3") as string)?.fy;
        if (fy === undefined) continue;
        residuals.set(close, { year, parts: parts as string[] });
        quarters.push({ fy, fp: "Q4", label: `FY${fy} Q4`, end: close });
    }

    quarters.sort((a, b) => (a.end < b.end ? -1 : 1));

    const nothing = () => ({
        quarters: [] as Quarter[],
        quarterlyStatements: [] as QuarterlyStatement[],
    });

    // A rail has to be an unbroken RUN of quarters, not a scatter.
    //
    // Admitting 6-K on form alone lets in the half-year filers, and this is
    // what catches them. A company that tags XBRL only in its interim report
    // contributes the single quarter that report happens to carry, so the
    // rail becomes Q2, once a year, drawn as adjacent columns. Unilever
    // reports half-yearly and would otherwise appear in a quarterly rail.
    // Vale's read FY2020 Q2, FY2021 Q2, FY2024 Q2, FY2025 Q2: a three year
    // hole drawn as neighbours. BP, Petrobras and BCE are the same shape.
    //
    // It also protects a company that already works. Brookfield returns six
    // contiguous quarters and on form alone gained two orphans from the
    // pre-restructuring entity, which is not the same reporter: the rail
    // then carried an EPS row with a single value in it and cash of twelve
    // million beside sixteen hundred million.
    //
    // Two rules, and the first has to be a GAP test rather than a count per
    // fiscal year. Counting per year looked equivalent and quietly cost
    // Apple and Microsoft their oldest quarter, because the five year window
    // cuts their run mid-year and that year then has one quarter in it.
    // Walking back from the newest and stopping at the first hole keeps a
    // real run whole and drops anything marooned before it.
    const gapDays = 200;
    const runQuarters: Quarter[] = [];
    for (let i = quarters.length - 1; i >= 0; i--) {
        const next = runQuarters[0];
        if (next && daysBetween(quarters[i].end, next.end) > gapDays) break;
        runQuarters.unshift(quarters[i]);
    }
    // And a run of one quarter a year is not a quarterly rail at all, however
    // unbroken the survivor looks once the holes are cut out.
    const perYear = new Map<number, number>();
    for (const quarter of runQuarters) {
        perYear.set(quarter.fy, (perYear.get(quarter.fy) ?? 0) + 1);
    }
    if (![...perYear.values()].some((n) => n >= 3)) return nothing();

    // Quarters that stop long before the company's own newest reported figure
    // are history, not the current shape of the business, and a rail of them
    // beside a current annual table reads as though the data were fresh.
    // Canadian National is the live case: admitting 6-K brings back quarters
    // that end in 2009 for a company still reporting today.
    const newestQuarter = runQuarters[runQuarters.length - 1]?.end ?? "";
    let newestReported = "";
    for (const tag of durationTags) {
        if (!facts[tag]) continue;
        for (const u of unitsOf(facts[tag], currency)) {
            if (u.end > newestReported) newestReported = u.end;
        }
    }
    if (!newestQuarter || daysBetween(newestQuarter, newestReported) > QUARTER_STALE_DAYS) {
        return nothing();
    }

    // Whole fiscal years, newest first, then filtered in place so the values
    // arrays stay in the chronological order the annual keys use.
    const orderedYears = [...new Set(runQuarters.map((quarter) => quarter.fy))].sort((a, b) => b - a);
    const keptYears = new Set(orderedYears.slice(0, QUARTER_YEARS));
    const shown = runQuarters.filter((quarter) => keptYears.has(quarter.fy));
    // Every quarter, not just the ones shown: an old Q4 at the top of the
    // window still nets off three quarters that fall outside it.
    const known = new Set(runQuarters.map((quarter) => quarter.end));

    const flowRows = flows.map(([label, tags]) => {
        const filed = quarterSeries(facts, tags, known, currency);
        const annual = series(facts, tags, fyeMonth, currency);
        return {
            label,
            values: shown.map((quarter) => {
                if (quarter.fp !== "Q4") return filed.get(quarter.end) ?? null;
                const residual = residuals.get(quarter.end);
                if (!residual) return null;
                const year = annual.get(residual.year);
                const parts = residual.parts.map((end) => filed.get(end));
                if (year === undefined || parts.some((value) => value === undefined)) return null;
                const derived = year - (parts as number[]).reduce((sum, value) => sum + value, 0);
                // A negative residual on a line that cannot be negative means
                // the annual and the quarters were restated at different
                // times. Blank is the honest answer; the alternative is a
                // confident minus twelve billion. See NON_NEGATIVE_FLOWS.
                if (derived < 0 && NON_NEGATIVE_FLOWS.has(label)) return null;
                return derived;
            }),
        };
    });

    const ratioRows = ratios.map(([label, tags]) => {
        const filed = quarterSeries(facts, tags, known, currency);
        // Deliberately no Q4 here. See the note above QUARTERLY_RATIOS.
        return {
            label,
            values: shown.map((quarter) =>
                quarter.fp === "Q4" ? null : filed.get(quarter.end) ?? null
            ),
        };
    });

    const instantRows = instants.map(([label, tags]) => {
        const balances = instantSeries(facts, tags, known, currency);
        return { label, values: shown.map((quarter) => balances.get(quarter.end) ?? null) };
    });

    const quarterlyStatements = [
        { name: "Income statement", rows: [...flowRows, ...ratioRows] },
        { name: "Balance sheet", rows: instantRows },
    ]
        .map((statement) => ({
            name: statement.name,
            rows: statement.rows.filter((row) => row.values.some((value) => value !== null)),
        }))
        .filter((statement) => statement.rows.length > 0);

    // Period labels with nothing under them are noise, so they go together.
    return quarterlyStatements.length
        ? { quarters: shown, quarterlyStatements }
        : { quarters: [] as Quarter[], quarterlyStatements };
}

/**
 * Keys unchanged so shipped iOS builds keep parsing; the report is additive.
 * Not every symbol files with the SEC (foreign listings, most ETFs), and not
 * every filer tags every line — that's "no-data", and hiding the section is a
 * fair rendering of it. Being refused is not.
 */
const empty = (symbol: string, report: SourceReport) =>
    NextResponse.json({
        symbol,
        years: [],
        statements: [],
        quarters: [],
        quarterlyStatements: [],
        ...report,
    });

/**
 * Which set of books to build from, chosen by which one is CURRENT rather
 * than by which one exists.
 *
 * Presence alone is not enough. Toyota and Sony carry both taxonomies,
 * because both moved to IFRS and their old us-gaap tags stayed in the
 * document: Toyota's newest us-gaap annual fact ends 2020-03-31 and Sony's
 * 2021-03-31, while both file IFRS to this day. "Prefer us-gaap when present" would
 * put a twelve-year-old year at the head of Toyota's table and label it the
 * latest. So the newest annual fact wins, and ties go to us-gaap because
 * that is the larger and better-tested path here.
 */
function pickTaxonomy(doc: any) {
    const candidates = [
        { name: "us-gaap", facts: doc?.facts?.["us-gaap"],
          income: INCOME, balance: BALANCE, cashflow: CASHFLOW },
        { name: "ifrs-full", facts: doc?.facts?.["ifrs-full"],
          income: IFRS_INCOME, balance: IFRS_BALANCE, cashflow: IFRS_CASHFLOW },
    ].filter((c) => c.facts);
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const newest = (facts: Record<string, any>) => {
        let end = "";
        for (const tag of ["Assets", "Liabilities", "Equity", "StockholdersEquity",
                           "Revenue", "Revenues", "ProfitLoss", "NetIncomeLoss"]) {
            for (const u of unitsOf(facts[tag])) {
                if (isAnnualForm(u) && u.end > end) end = u.end;
            }
        }
        return end;
    };
    const [a, b] = candidates;
    return newest(b.facts) > newest(a.facts) ? b : a;
}

export async function GET(req: NextRequest) {
    const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase().trim();
    if (!symbol) {
        return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const cik = await cikFor(symbol);
    if (cik.status !== "ok") return empty(symbol, reportOf(cik));

    const companyFacts = await secJson<any>(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.data}.json`,
        revalidate
    );
    if (companyFacts.status !== "ok") return empty(symbol, reportOf(companyFacts));

    const doc = companyFacts.data;
    const taxonomy = pickTaxonomy(doc);
    if (!taxonomy) {
        return empty(symbol, {
            status: "no-data",
            reason: `${symbol} files with the SEC but doesn't tag its statements in a taxonomy we read.`,
        });
    }
    const facts = taxonomy.facts;
    const currency = reportingCurrency(facts);

    const fyeMonth = fiscalYearEndMonth(facts, currency);
    const built = [
        { name: "Income statement", rows: taxonomy.income },
        { name: "Balance sheet", rows: taxonomy.balance },
        { name: "Cash flow", rows: taxonomy.cashflow },
    ].map((statement) => ({
        name: statement.name,
        rows: statement.rows.map(([label, tags]) => ({
            label,
            data: series(facts, tags, fyeMonth, currency),
        })),
    }));

    const everyYear = new Set<number>();
    for (const s of built) for (const r of s.rows) for (const y of r.data.keys()) everyYear.add(y);
    const years = [...everyYear].sort((a, b) => a - b).slice(-10);

    const statements = built
        .map((statement) => ({
            name: statement.name,
            rows: statement.rows
                // null, never 0, for a year a company did not report a line:
                // the app has to tell "nothing here" from "they reported zero".
                .map((r) => ({ label: r.label, values: years.map((y) => r.data.get(y) ?? null) }))
                .filter((r) => r.values.some((v) => v !== null)),
        }))
        // Banks and insurers legitimately have no gross profit or R&D, so a
        // statement with nothing in it is dropped rather than shown empty.
        .filter((statement) => statement.rows.length > 0);

    const { quarters, quarterlyStatements } = quarterlyReport(
        facts, fyeMonth, currency, taxonomy.income, taxonomy.balance);

    return NextResponse.json({
        symbol,
        companyName: doc.entityName ?? symbol,
        cik: cik.data,
        fiscalYearEndMonth: fyeMonth,
        // What the numbers are denominated in, and which book they come from.
        // Both are facts about the filing, and a client that draws a currency
        // symbol needs the first one to avoid printing euros as dollars.
        currency,
        taxonomy: taxonomy.name,
        years,
        statements,
        quarters,
        quarterlyStatements,
        source: "SEC EDGAR XBRL company facts",
        ...(statements.length
            ? OK
            : {
                  status: "no-data" as const,
                  reason: `The SEC has no statement lines tagged for ${symbol}.`,
              }),
    });
}
