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
    fp?: string;
    filed?: string;
};

function unitsOf(node: any): Fact[] {
    return (node?.units?.USD ?? Object.values(node?.units ?? {})[0] ?? []) as Fact[];
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

/**
 * Keys unchanged so shipped iOS builds keep parsing; the report is additive.
 * Not every symbol files with the SEC (foreign listings, most ETFs), and not
 * every filer tags every line — that's "no-data", and hiding the section is a
 * fair rendering of it. Being refused is not.
 */
const empty = (symbol: string, report: SourceReport) =>
    NextResponse.json({ symbol, years: [], statements: [], ...report });

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

    return NextResponse.json({
        symbol,
        companyName: doc.entityName ?? symbol,
        cik: cik.data,
        fiscalYearEndMonth: fyeMonth,
        years,
        statements,
        source: "SEC EDGAR XBRL company facts",
        ...(statements.length
            ? OK
            : {
                  status: "no-data" as const,
                  reason: `The SEC has no statement lines tagged for ${symbol}.`,
              }),
    });
}
