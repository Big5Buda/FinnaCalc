import { NextRequest, NextResponse } from "next/server"
import { inflateRawSync } from "node:zlib"
import { OK, secBuffer } from "@/lib/sec"

/**
 * A House member's periodic transaction reports (PTRs), from the Clerk's own
 * annual index.
 *
 * WHAT THIS RETURNS, AND WHY IT STOPS THERE
 * -----------------------------------------
 * It returns the FILINGS: who filed, what kind, on what date, and a link to
 * the official document. It does NOT return the individual trades inside
 * them, because they are not machine-readable. The Clerk publishes each PTR
 * as a scanned image wrapped in a PDF; a sample of 2026 filings was scanned
 * images in every case, with no extractable text at all. Pulling trades out
 * would mean OCR on scans, and an OCR misread turns "$1,001 - $15,000" into a
 * number a user might act on. This app does not print figures it cannot
 * stand behind, so it links to the document instead of guessing at it.
 *
 * Note also that House disclosures report a RANGE, never an exact amount, so
 * even a perfect parse could not produce the precise dollar figures people
 * expect from a trade feed.
 *
 * Senate filings live behind a separate search that requires accepting terms
 * per session, so they are not covered here.
 *
 * SEPARATELY, a legal question: 5 U.S.C. 13107(c)(1) makes it unlawful to use
 * these reports for "any commercial purpose, other than by news and
 * communications media for dissemination to the general public". Publishing
 * the fact of a filing plus a link to the government's own copy is the
 * narrowest possible use, but whether this product qualifies for the media
 * carve-out is a question for a lawyer, not for this comment.
 *
 * The Clerk isn't the SEC, but the failure shape is identical, so this reuses
 * lib/sec.ts: an index we couldn't download must not render as "this member has
 * disclosed nothing".
 */

export const revalidate = 21600

/** P is the periodic transaction report; the rest are annual/termination forms. */
const FILING_TYPES: Record<string, string> = {
    P: "Periodic transaction report",
    O: "Annual report",
    A: "Amendment",
    C: "Candidate report",
    D: "Termination report",
    W: "Withdrawal",
    X: "Extension",
    T: "Trust",
    H: "Blind trust",
}

/**
 * Pulls the first .txt out of a ZIP using only Node's zlib, so the route adds
 * no dependency. Walks the local file headers (signature PK\x03\x04), which is
 * enough for the Clerk's two-entry archive; stored and deflated entries both
 * work.
 */
function firstTextFileFromZip(buf: Buffer): string | null {
    let offset = 0
    while (offset + 30 <= buf.length) {
        if (buf.readUInt32LE(offset) !== 0x04034b50) break
        const method = buf.readUInt16LE(offset + 8)
        const flags = buf.readUInt16LE(offset + 6)
        let compressedSize = buf.readUInt32LE(offset + 18)
        const nameLen = buf.readUInt16LE(offset + 26)
        const extraLen = buf.readUInt16LE(offset + 28)
        const name = buf.toString("utf8", offset + 30, offset + 30 + nameLen)
        const dataStart = offset + 30 + nameLen + extraLen

        // Sizes can live in a trailing descriptor instead of the header; in
        // that case run to the next entry signature.
        if ((flags & 0x08) !== 0 || compressedSize === 0) {
            const next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart)
            const end = next > 0 ? next : buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart)
            compressedSize = (end > 0 ? end : buf.length) - dataStart
        }

        const data = buf.subarray(dataStart, dataStart + compressedSize)
        if (name.toLowerCase().endsWith(".txt")) {
            return method === 0 ? data.toString("utf8") : inflateRawSync(data).toString("utf8")
        }
        offset = dataStart + compressedSize
    }
    return null
}

export async function GET(req: NextRequest) {
    const last = (req.nextUrl.searchParams.get("last") ?? "").trim()
    const first = (req.nextUrl.searchParams.get("first") ?? "").trim()
    if (!last) return NextResponse.json({ error: "Pass a last name." }, { status: 400 })

    const thisYear = new Date().getUTCFullYear()
    const years = [thisYear, thisYear - 1]
    const filings: any[] = []
    // Which of the two annual indexes we actually managed to search. A year we
    // couldn't download is a year we can't speak for.
    const searched: number[] = []
    const missed: number[] = []

    for (const year of years) {
        const archive = await secBuffer(
            `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.ZIP`,
            revalidate
        )
        if (archive.status !== "ok") {
            missed.push(year)
            continue
        }

        let text: string
        try {
            const unzipped = firstTextFileFromZip(archive.data)
            if (!unzipped) {
                missed.push(year)
                continue
            }
            text = unzipped
        } catch {
            missed.push(year)
            continue
        }
        const lines = text.split(/\r?\n/)
        const header = (lines.shift() ?? "").split("\t")
        const col = (name: string) => header.indexOf(name)
        const iLast = col("Last"), iFirst = col("First"), iType = col("FilingType")
        const iDate = col("FilingDate"), iDoc = col("DocID"), iState = col("StateDst")
        // The Clerk changed the column layout on us: we have the file but can't
        // read it, which is not the same as the member having filed nothing.
        if (iLast < 0 || iDoc < 0) {
            missed.push(year)
            continue
        }
        searched.push(year)

        for (const line of lines) {
            if (!line.trim()) continue
            const f = line.split("\t")
            if ((f[iLast] ?? "").toLowerCase() !== last.toLowerCase()) continue
            if (first && !(f[iFirst] ?? "").toLowerCase().startsWith(first.toLowerCase())) continue
            const type = (f[iType] ?? "").trim()
            const docId = (f[iDoc] ?? "").trim()
            if (!docId) continue
            filings.push({
                name: `${(f[iFirst] ?? "").trim()} ${(f[iLast] ?? "").trim()}`.trim(),
                district: (f[iState] ?? "").trim() || null,
                type,
                typeLabel: FILING_TYPES[type] ?? "Disclosure",
                isTradeReport: type === "P",
                filedAt: (f[iDate] ?? "").trim(),
                year,
                url: `https://disclosures-clerk.house.gov/public_disc/${
                    type === "P" ? "ptr-pdfs" : "financial-pdfs"
                }/${year}/${docId}.pdf`,
            })
        }
    }

    // Newest first. Dates arrive as M/D/YYYY.
    filings.sort((a, b) => {
        const parse = (s: string) => {
            const [m, d, y] = s.split("/").map(Number)
            return (y || 0) * 10000 + (m || 0) * 100 + (d || 0)
        }
        return parse(b.filedAt) - parse(a.filedAt)
    })

    return NextResponse.json({
        last,
        first: first || null,
        chamber: "house",
        // Said out loud so the client never has to assume otherwise.
        tradesIncluded: false,
        filings,
        yearsSearched: searched,
        ...report(filings.length, searched, missed),
    })
}

/**
 * What an empty list means, given how much of the record we could actually
 * read. Searching one year of two and finding nothing is a partial answer, and
 * it says so rather than passing itself off as a complete one.
 */
function report(found: number, searched: number[], missed: number[]) {
    if (searched.length === 0) {
        return {
            status: "unavailable" as const,
            reason: "The House Clerk's disclosure index couldn't be downloaded.",
        }
    }
    if (missed.length > 0) {
        return {
            status: "ok" as const,
            reason: `Only ${searched.join(" and ")} could be searched; ${missed.join(
                " and "
            )} didn't load.`,
        }
    }
    if (found === 0) {
        return {
            status: "no-data" as const,
            reason: `No disclosures filed under this name in ${searched.join(" or ")}.`,
        }
    }
    return OK
}
