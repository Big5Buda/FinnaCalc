import { NextRequest, NextResponse } from "next/server"
import { OK, reportOf, secJson, secText, type SourceReport } from "@/lib/sec"

/**
 * A filer's recent 13F-HR filings, each carrying what changed since the one
 * before it.
 *
 * Free, public-domain government data, same terms as the other SEC routes.
 *
 * THE CHANGES ARE DERIVED, AND NOTHING MAY PRESENT THEM OTHERWISE
 * ---------------------------------------------------------------
 * A 13F reports POSITIONS at a quarter end. It reports no transactions at all.
 * Every "added" and "exited" below is this route subtracting one quarter's
 * share count from the next, which is a weaker claim than a filed trade in
 * four specific ways the app is required to state:
 *
 *   1. Anything opened and closed inside one quarter is invisible. Both
 *      snapshots show nothing and the fund looks idle.
 *   2. A share split moves the share count with nobody trading. The SEC does
 *      not restate old filings, so a 4-for-1 split reads here as a position
 *      quadrupling, and no field in the filing lets us catch it.
 *   3. Positions moving between filers in one group read as an exit here and
 *      a new buy there.
 *   4. Only 13F-reportable long US equity is in scope.
 *
 * WHAT GETS DROPPED BEFORE COMPARING, AND WHY
 * -------------------------------------------
 * Options: a row with <putCall> is a contract, not stock. A put is a bet
 * AGAINST the company, so folding its share count into the position would
 * invert what the filing says. Counted out loud in optionRowsExcluded.
 *
 * Debt: <sshPrnamtType> is SH for shares and PRN for a principal amount. A
 * bond's PRN is dollars of face value, and adding it to a share count is
 * adding two different units.
 *
 * Amendments: a 13F-HR/A restates a quarter already on file. Listing both
 * would draw one quarter twice with two answers and no way to tell which
 * stands, so the newest filing for each quarter wins and is flagged.
 *
 * COST
 * ----
 * Each quarter costs an index read and an information table, and a large
 * filer's table is close to a megabyte: Citadel reports over seven thousand
 * positions. Hence the small default window, the hard cap, the six-hour
 * revalidate, and doing this on the server rather than on a phone.
 */

export const revalidate = 21600
export const maxDuration = 60

/** Quarters returned unless asked otherwise, and the ceiling. */
const DEFAULT_QUARTERS = 5
const MAX_QUARTERS = 8

/** Changed positions listed per filing. Counts are always reported in full. */
const MAX_ROWS = 12

/**
 * Before 3 January 2023 the value column was thousands of dollars, after it
 * whole dollars. Comparing across that date without normalising invents a
 * thousandfold move in every position at once.
 */
const DOLLARS_FROM = "2023-01-03"

function tagText(block: string, tag: string): string | null {
    const m = new RegExp(`<(?:[\\w-]+:)?${tag}>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`).exec(block)
    return m ? m[1].trim() : null
}

function tagNumber(block: string, tag: string): number | null {
    const t = tagText(block, tag)
    if (t == null) return null
    const n = Number(t.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
}

type Position = {
    name: string
    titleOfClass: string | null
    cusip: string
    value: number
    shares: number
}

type Table = {
    positions: Map<string, Position>
    optionRowsExcluded: number
    sourceUrl: string
}

/**
 * Is the value column dollars, or thousands?
 *
 * The filing date rule above is the SEC's, and most filers follow it, but not
 * all: some still report thousands after the switch. Dividing the value column
 * by the share count gives an implied price per share, and a real US-listed
 * share is not 4 cents and not $400,000. The median across the filing's larger
 * positions is a robust read on which unit is in use, and when it lands in
 * neither plausible band we return nothing rather than a figure that could be
 * wrong by a factor of a thousand.
 */
function dollarScale(positions: Position[], filedAt: string | null): number | null {
    const implied = positions
        .filter((p) => p.shares > 1000 && p.value > 0)
        .map((p) => p.value / p.shares)
        .sort((a, b) => a - b)
    if (implied.length < 5) {
        // Too few rows to read. Fall back to the date rule, which is right for
        // the overwhelming majority of filings.
        return filedAt && filedAt < DOLLARS_FROM ? 1000 : 1
    }
    const median = implied[Math.floor(implied.length / 2)]
    if (median >= 1 && median <= 20000) return 1          // already dollars
    if (median >= 0.001 && median <= 20) return 1000      // thousands
    return null                                            // cannot tell
}

/** One filing's positions, aggregated by CUSIP, options and debt removed. */
async function tableOf(cik: string, accession: string): Promise<Table | SourceReport> {
    const bare = accession.replace(/-/g, "")
    const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${bare}`

    const index = await secJson<any>(`${base}/index.json`, revalidate)
    if (index.status !== "ok") return reportOf(index)

    const names: string[] = (index.data.directory?.item ?? []).map((it: any) => String(it.name))
    const table = names.find((n) => n.endsWith(".xml") && n !== "primary_doc.xml")
    if (!table) {
        return { status: "unavailable", reason: "That 13F filing has no information table we can read." }
    }

    const document = await secText(`${base}/${table}`, revalidate)
    if (document.status !== "ok") return reportOf(document)

    const blocks =
        document.data.match(/<(?:[\w-]+:)?infoTable>[\s\S]*?<\/(?:[\w-]+:)?infoTable>/g) ?? []

    const positions = new Map<string, Position>()
    let optionRowsExcluded = 0
    for (const b of blocks) {
        const cusip = tagText(b, "cusip")
        const name = tagText(b, "nameOfIssuer")
        if (!cusip || !name) continue
        if (tagText(b, "putCall")) {
            optionRowsExcluded += 1
            continue
        }
        const unit = tagText(b, "sshPrnamtType")
        if (unit && unit.toUpperCase() !== "SH") continue
        const value = tagNumber(b, "value") ?? 0
        const shares = tagNumber(b, "sshPrnamt") ?? 0
        const hit = positions.get(cusip)
        if (hit) {
            hit.value += value
            hit.shares += shares
        } else {
            positions.set(cusip, { name, titleOfClass: tagText(b, "titleOfClass"), cusip, value, shares })
        }
    }
    return { positions, optionRowsExcluded, sourceUrl: `${base}/${table}` }
}

export async function GET(req: NextRequest) {
    const cik = (req.nextUrl.searchParams.get("cik") ?? "").replace(/\D/g, "")
    if (!cik) return NextResponse.json({ error: "Pass a cik." }, { status: 400 })
    const padded = cik.padStart(10, "0")

    const asked = Number(req.nextUrl.searchParams.get("quarters") ?? String(DEFAULT_QUARTERS))
    const quarters = Number.isFinite(asked)
        ? Math.min(Math.max(Math.trunc(asked), 1), MAX_QUARTERS)
        : DEFAULT_QUARTERS

    const nothing = (name: string | null, report: SourceReport) =>
        NextResponse.json({ cik: padded, name, ...report })

    const submissions = await secJson<any>(
        `https://data.sec.gov/submissions/CIK${padded}.json`,
        revalidate
    )
    if (submissions.status !== "ok") return nothing(null, reportOf(submissions))
    const name = submissions.data.name ?? null
    const recent = submissions.data.filings?.recent
    const forms: string[] = recent?.form ?? []

    // Newest filing per quarter wins, so an amendment replaces what it amends.
    type Row = {
        accession: string
        form: string
        isAmendment: boolean
        periodOfReport: string
        filedAt: string | null
    }
    const byPeriod = new Map<string, Row>()
    for (let i = 0; i < forms.length; i++) {
        const form = forms[i]
        if (form !== "13F-HR" && form !== "13F-HR/A") continue
        const periodOfReport = recent.reportDate?.[i]
        if (!periodOfReport) continue
        const filedAt = recent.filingDate?.[i] ?? null
        const held = byPeriod.get(periodOfReport)
        if (held && (held.filedAt ?? "") >= (filedAt ?? "")) continue
        byPeriod.set(periodOfReport, {
            accession: String(recent.accessionNumber[i]),
            form,
            isAmendment: form.endsWith("/A"),
            periodOfReport,
            filedAt,
        })
    }

    const ordered = [...byPeriod.values()].sort((a, b) =>
        a.periodOfReport < b.periodOfReport ? 1 : a.periodOfReport > b.periodOfReport ? -1 : 0
    )
    if (!ordered.length) {
        return nothing(name, {
            status: "no-data",
            reason: "No 13F-HR on record. Funds under $100M don't have to file one.",
        })
    }

    // One extra quarter, unreturned, so the oldest card still has something to
    // be compared against.
    const window = ordered.slice(0, quarters + 1)
    const tables = await Promise.all(window.map((r) => tableOf(cik, r.accession)))

    const filings = window.slice(0, quarters).map((row, i) => {
        const here = tables[i]
        if (!("positions" in here)) {
            return {
                accession: row.accession,
                form: row.form,
                isAmendment: row.isAmendment,
                periodOfReport: row.periodOfReport,
                filedAt: row.filedAt,
                positions: null,
                reportedValue: null,
                sourceUrl: null,
                comparedTo: null,
                change: null,
            }
        }
        const list = [...here.positions.values()]
        const scale = dollarScale(list, row.filedAt)

        const before = tables[i + 1]
        const prior = window[i + 1]
        if (!before || !("positions" in before) || !prior) {
            return {
                accession: row.accession,
                form: row.form,
                isAmendment: row.isAmendment,
                periodOfReport: row.periodOfReport,
                filedAt: row.filedAt,
                positions: here.positions.size,
                reportedValue: scale == null ? null : list.reduce((s, p) => s + p.value, 0) * scale,
                sourceUrl: here.sourceUrl,
                comparedTo: null,
                change: null,
            }
        }

        type Change = {
            cusip: string
            name: string
            titleOfClass: string | null
            kind: "added" | "exited" | "increased" | "decreased"
            sharesBefore: number
            sharesAfter: number
            sharesDelta: number
            sharePctDelta: number | null
            weight: number
        }
        const rows: Change[] = []
        let added = 0, exited = 0, increased = 0, decreased = 0, unchanged = 0

        const push = (c: Omit<Change, "weight">, weight: number) => rows.push({ ...c, weight })

        for (const [cusip, p] of here.positions) {
            const was = before.positions.get(cusip)
            if (!was) {
                added += 1
                push({ cusip, name: p.name, titleOfClass: p.titleOfClass, kind: "added",
                       sharesBefore: 0, sharesAfter: p.shares, sharesDelta: p.shares,
                       sharePctDelta: null }, Math.abs(p.value))
                continue
            }
            const delta = p.shares - was.shares
            if (delta === 0) { unchanged += 1; continue }
            if (delta > 0) increased += 1
            else decreased += 1
            push({ cusip, name: p.name, titleOfClass: p.titleOfClass,
                   kind: delta > 0 ? "increased" : "decreased",
                   sharesBefore: was.shares, sharesAfter: p.shares, sharesDelta: delta,
                   sharePctDelta: was.shares > 0 ? delta / was.shares : null },
                 Math.abs(p.value - was.value))
        }
        for (const [cusip, was] of before.positions) {
            if (here.positions.has(cusip)) continue
            exited += 1
            push({ cusip, name: was.name, titleOfClass: was.titleOfClass, kind: "exited",
                   sharesBefore: was.shares, sharesAfter: 0, sharesDelta: -was.shares,
                   sharePctDelta: was.shares > 0 ? -1 : null }, Math.abs(was.value))
        }

        // Ranked by how much money moved. Both sides came from the same value
        // column with the same normalisation, so the ordering holds even where
        // the absolute unit was too uncertain to publish.
        rows.sort((a, b) => b.weight - a.weight)
        // Rebuilt field by field rather than destructured, so `weight` never
        // becomes an unused binding a lint rule could fail the build on.
        const kept = rows.slice(0, MAX_ROWS).map((r) => ({
            cusip: r.cusip,
            name: r.name,
            titleOfClass: r.titleOfClass,
            kind: r.kind,
            sharesBefore: r.sharesBefore,
            sharesAfter: r.sharesAfter,
            sharesDelta: r.sharesDelta,
            sharePctDelta: r.sharePctDelta,
        }))

        return {
            accession: row.accession,
            form: row.form,
            isAmendment: row.isAmendment,
            periodOfReport: row.periodOfReport,
            filedAt: row.filedAt,
            positions: here.positions.size,
            reportedValue: scale == null ? null : list.reduce((s, p) => s + p.value, 0) * scale,
            sourceUrl: here.sourceUrl,
            comparedTo: prior.periodOfReport,
            change: {
                added,
                exited,
                increased,
                decreased,
                unchanged,
                rows: kept,
                optionRowsExcluded: here.optionRowsExcluded,
                rowsTruncated: rows.length > kept.length,
            },
        }
    })

    return NextResponse.json({ cik: padded, name, filings, ...OK })
}
