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

function unitsOf(node: any): Fact[] {
    const units = (node?.units ?? {}) as Record<string, Fact[]>;
    // Money is USD and per-share lines are USD/shares. Naming them beats taking
    // whichever key the JSON happened to list first: Walmart's diluted EPS
    // carries three stray `pure` facts ahead of its 300-odd real ones, and
    // first-key-wins reads the three.
    const preferred = units.USD ?? units["USD/shares"];
    if (preferred) return preferred;
    return Object.values(units).sort((a, b) => b.length - a.length)[0] ?? [];
}

function isAnnualForm(u: Fact): boolean {
    return u.form === "10-K" || u.form === "20-F";
}

/** The month a company closes its books, read off its own annual balances. */
function fiscalYearEndMonth(facts: Record<string, any>): number {
    for (const tag of ["Assets", "StockholdersEquity", "Liabilities"]) {
        const months = unitsOf(facts[tag])
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
function series(facts: Record<string, any>, tags: string[], fyeMonth: number) {
    const merged = new Map<number, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<number, Fact>();
        for (const u of unitsOf(facts[tag])) {
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
const QUARTER_LIMIT = 20;

type QuarterPart = "Q1" | "Q2" | "Q3" | "Q4";
type Quarter = { fy: number; fp: QuarterPart; label: string; end: string };

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
const QUARTERLY_FLOWS = pick(INCOME, ["Revenue", "Operating income", "Net income"]);

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
const QUARTERLY_RATIOS = pick(INCOME, ["Earnings per share (diluted)"]);
const QUARTERLY_INSTANTS = pick(BALANCE, ["Cash & equivalents"]);

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
function fiscalYearEnds(facts: Record<string, any>, tags: string[], fyeMonth: number) {
    const closes = new Map<number, string>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        for (const u of unitsOf(facts[tag])) {
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
function quarterCalendar(facts: Record<string, any>, tags: string[]) {
    // Accession -> the newest quarter it reports, i.e. the one it is about.
    const current = new Map<string, Fact>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        for (const u of unitsOf(facts[tag])) {
            if (u.form !== "10-Q" || !u.start || !u.accn) continue;
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
function quarterSeries(facts: Record<string, any>, tags: string[], ends: Set<string>) {
    const merged = new Map<string, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<string, Fact>();
        for (const u of unitsOf(facts[tag])) {
            if (u.form !== "10-Q" || !u.start || !ends.has(u.end)) continue;
            if (daysBetween(u.start, u.end) > QUARTER_MAX_DAYS) continue;
            const prev = best.get(u.end);
            if (!prev || (u.filed ?? "") > (prev.filed ?? "")) best.set(u.end, u);
        }
        for (const [end, fact] of best) if (!merged.has(end)) merged.set(end, fact.val);
    }
    return merged;
}

/** Balances by date: instants (no `start`), read at the date and never differenced. */
function instantSeries(facts: Record<string, any>, tags: string[], ends: Set<string>) {
    const merged = new Map<string, number>();
    for (const tag of tags) {
        if (!facts[tag]) continue;
        const best = new Map<string, Fact>();
        for (const u of unitsOf(facts[tag])) {
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
function quarterlyReport(facts: Record<string, any>, fyeMonth: number) {
    const durationTags = [...QUARTERLY_FLOWS, ...QUARTERLY_RATIOS].flatMap(([, tags]) => tags);
    const calendar = quarterCalendar(facts, durationTags);
    const closes = fiscalYearEnds(facts, durationTags, fyeMonth);

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
    const shown = quarters.slice(-QUARTER_LIMIT);
    // Every quarter, not just the ones shown: an old Q4 at the top of the
    // window still nets off three quarters that fall outside it.
    const known = new Set(quarters.map((quarter) => quarter.end));

    const flowRows = QUARTERLY_FLOWS.map(([label, tags]) => {
        const filed = quarterSeries(facts, tags, known);
        const annual = series(facts, tags, fyeMonth);
        return {
            label,
            values: shown.map((quarter) => {
                if (quarter.fp !== "Q4") return filed.get(quarter.end) ?? null;
                const residual = residuals.get(quarter.end);
                if (!residual) return null;
                const year = annual.get(residual.year);
                const parts = residual.parts.map((end) => filed.get(end));
                if (year === undefined || parts.some((value) => value === undefined)) return null;
                const residual = year - (parts as number[]).reduce((sum, value) => sum + value, 0);
                // A negative residual on a line that cannot be negative means
                // the annual and the quarters were restated at different
                // times. Blank is the honest answer; the alternative is a
                // confident minus twelve billion. See NON_NEGATIVE_FLOWS.
                if (residual < 0 && NON_NEGATIVE_FLOWS.has(label)) return null;
                return residual;
            }),
        };
    });

    const ratioRows = QUARTERLY_RATIOS.map(([label, tags]) => {
        const filed = quarterSeries(facts, tags, known);
        // Deliberately no Q4 here. See the note above QUARTERLY_RATIOS.
        return {
            label,
            values: shown.map((quarter) =>
                quarter.fp === "Q4" ? null : filed.get(quarter.end) ?? null
            ),
        };
    });

    const instantRows = QUARTERLY_INSTANTS.map(([label, tags]) => {
        const balances = instantSeries(facts, tags, known);
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
    const facts = doc?.facts?.["us-gaap"];
    if (!facts) {
        return empty(symbol, {
            status: "no-data",
            reason: `${symbol} files with the SEC but doesn't tag its statements in US GAAP.`,
        });
    }

    const fyeMonth = fiscalYearEndMonth(facts);
    const built = [
        { name: "Income statement", rows: INCOME },
        { name: "Balance sheet", rows: BALANCE },
        { name: "Cash flow", rows: CASHFLOW },
    ].map((statement) => ({
        name: statement.name,
        rows: statement.rows.map(([label, tags]) => ({
            label,
            data: series(facts, tags, fyeMonth),
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

    const { quarters, quarterlyStatements } = quarterlyReport(facts, fyeMonth);

    return NextResponse.json({
        symbol,
        companyName: doc.entityName ?? symbol,
        cik: cik.data,
        fiscalYearEndMonth: fyeMonth,
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
