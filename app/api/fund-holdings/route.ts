import { NextRequest, NextResponse } from "next/server"

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
 */

export const revalidate = 21600

const SEC_HEADERS = {
    "User-Agent": process.env.SEC_CONTACT ?? "FinnaCalc helpfinnacalc@gmail.com",
    Accept: "application/json",
}

function tagText(block: string, tag: string): string | null {
    // 13F tables are sometimes namespaced (ns1:nameOfIssuer), sometimes not.
    const m = new RegExp(`<(?:[\\w-]+:)?${tag}>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`).exec(block)
    return m ? m[1].trim() : null
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

    const subsRes = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
        headers: SEC_HEADERS,
        next: { revalidate },
    }).catch(() => null)
    if (!subsRes?.ok) return NextResponse.json({ cik: padded, name: null, holdings: [] })
    const subs = await subsRes.json()

    const recent = subs.filings?.recent
    const forms: string[] = recent?.form ?? []
    const i = forms.findIndex((f) => f === "13F-HR")
    if (i < 0) {
        return NextResponse.json({ cik: padded, name: subs.name ?? null, holdings: [] })
    }

    const accession = String(recent.accessionNumber[i]).replace(/-/g, "")
    const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}`

    // The information table's filename varies per filer, so read the index.
    const idxRes = await fetch(`${base}/index.json`, { headers: SEC_HEADERS, next: { revalidate } })
        .catch(() => null)
    if (!idxRes?.ok) return NextResponse.json({ cik: padded, name: subs.name ?? null, holdings: [] })
    const idx = await idxRes.json()
    const names: string[] = (idx.directory?.item ?? []).map((it: any) => String(it.name))
    const table = names.find((n) => n.endsWith(".xml") && n !== "primary_doc.xml")
    if (!table) return NextResponse.json({ cik: padded, name: subs.name ?? null, holdings: [] })

    const xmlRes = await fetch(`${base}/${table}`, { headers: SEC_HEADERS, next: { revalidate } })
        .catch(() => null)
    if (!xmlRes?.ok) return NextResponse.json({ cik: padded, name: subs.name ?? null, holdings: [] })
    const xml = await xmlRes.text()

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
        name: subs.name ?? null,
        // The quarter the snapshot describes, and when it reached the SEC.
        reportDate: recent.reportDate?.[i] ?? null,
        filedAt: recent.filingDate?.[i] ?? null,
        total,
        holdings: holdings.map((h) => ({
            ...h,
            weight: total > 0 ? h.value / total : 0,
        })),
        sourceUrl: `${base}/${table}`,
    })
}
