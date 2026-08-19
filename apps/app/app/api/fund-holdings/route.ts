import { NextRequest, NextResponse } from "next/server"
import { OK, reportOf, secJson, secText, type SourceReport } from "@/lib/sec"

/**
 * A fund's reported holdings, from its latest SEC Form 13F-HR.
 *
 * Free, public-domain government data, same terms as the other SEC routes.
 *
 * WHAT 13F IS AND IS NOT
 * ----------------------
 * Institutions over $100M report their US-listed long equity positions once a
 * QUARTER, up to 45 days after the quarter ends. So this is never "what they
 * own today": it is a snapshot that can be a day old or four months old, and
 * the response says exactly which quarter it covers so the app can label it.
 *
 * It also leaves things out by design. Shorts, bonds, cash, foreign listings
 * and anything held below the reporting threshold never appear, so the total
 * here is not the fund's size. The app should not present it as one.
 *
 * Positions are aggregated by CUSIP because a filer with several managers
 * reports the same company on multiple rows (Berkshire files Apple twice).
 *
 * Reading a 13F takes three hops — submissions, the filing index, then the
 * information table — and any of them can be refused. Each hop reports which
 * happened, because "this fund has filed no 13F" and "we couldn't fetch the
 * table" are different sentences and only one of them is true at a time.
 */

export const revalidate = 21600

/**
 * XML entities, decoded. Issuer names carry them constantly: SPDR files as
 * "STATE STR SPDR S&amp;P 500 ETF", and left raw that reached the app as
 * "State Str Spdr S&Amp;P 500 Etf T" once it title-cased the name.
 */
function decodeEntities(s: string): string {
    return s
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        // Ampersand last, so "&amp;lt;" does not become "<".
        .replace(/&amp;/g, "&")
}

function tagText(block: string, tag: string): string | null {
    // 13F tables are sometimes namespaced (ns1:nameOfIssuer), sometimes not.
    const m = new RegExp(`<(?:[\\w-]+:)?${tag}>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`).exec(block)
    return m ? decodeEntities(m[1].trim()) : null
}

function tagNumber(block: string, tag: string): number | null {
    const t = tagText(block, tag)
    if (t == null) return null
    const n = Number(t.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
}

export async function GET(req: NextRequest) {
    const cik = (req.nextUrl.searchParams.get("cik") ?? "").replace(/\D/g, "")
    if (!cik) return NextResponse.json({ error: "Pass a cik." }, { status: 400 })
    const padded = cik.padStart(10, "0")

    /** Keys unchanged for callers that only read `holdings`; report is additive. */
    const empty = (name: string | null, report: SourceReport) =>
        NextResponse.json({ cik: padded, name, holdings: [], ...report })

    const submissions = await secJson<any>(
        `https://data.sec.gov/submissions/CIK${padded}.json`,
        revalidate
    )
    if (submissions.status !== "ok") return empty(null, reportOf(submissions))
    const subs = submissions.data
    const name = subs.name ?? null

    const recent = subs.filings?.recent
    const forms: string[] = recent?.form ?? []
    const i = forms.findIndex((f) => f === "13F-HR")
    if (i < 0) {
        return empty(name, {
            status: "no-data",
            reason: "No 13F-HR on record — funds under $100M don't have to file one.",
        })
    }

    const accession = String(recent.accessionNumber[i]).replace(/-/g, "")
    const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}`

    // The information table's filename varies per filer, so read the index.
    const index = await secJson<any>(`${base}/index.json`, revalidate)
    if (index.status !== "ok") return empty(name, reportOf(index))

    const names: string[] = (index.data.directory?.item ?? []).map((it: any) => String(it.name))
    const table = names.find((n) => n.endsWith(".xml") && n !== "primary_doc.xml")
    if (!table) {
        return empty(name, {
            status: "unavailable",
            reason: "The 13F filing has no information table we can read.",
        })
    }

    const document = await secText(`${base}/${table}`, revalidate)
    if (document.status !== "ok") return empty(name, reportOf(document))
    const xml = document.data

    const blocks = xml.match(/<(?:[\w-]+:)?infoTable>[\s\S]*?<\/(?:[\w-]+:)?infoTable>/g) ?? []

    // Same company, several manager rows: one position to the user.
    const byCusip = new Map<string, { name: string; cusip: string; value: number; shares: number }>()
    for (const b of blocks) {
        const cusip = tagText(b, "cusip")
        const name = tagText(b, "nameOfIssuer")
        const value = tagNumber(b, "value") ?? 0
        const shares = tagNumber(b, "sshPrnamt") ?? 0
        if (!cusip || !name) continue
        const hit = byCusip.get(cusip)
        if (hit) {
            hit.value += value
            hit.shares += shares
        } else {
            byCusip.set(cusip, { name, cusip, value, shares })
        }
    }

    const holdings = [...byCusip.values()].sort((a, b) => b.value - a.value)
    const total = holdings.reduce((sum, h) => sum + h.value, 0)

    return NextResponse.json({
        cik: padded,
        name,
        // The quarter the snapshot describes, and when it reached the SEC.
        reportDate: recent.reportDate?.[i] ?? null,
        filedAt: recent.filingDate?.[i] ?? null,
        total,
        holdings: holdings.map((h) => ({
            ...h,
            weight: total > 0 ? h.value / total : 0,
        })),
        sourceUrl: `${base}/${table}`,
        // We fetched the table and it parsed to nothing — that's the filing
        // being empty, not us failing to read it.
        ...(holdings.length
            ? OK
            : {
                  status: "no-data" as const,
                  reason: "The latest 13F reports no positions.",
              }),
    })
}
