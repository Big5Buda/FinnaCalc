import { NextRequest, NextResponse } from "next/server"
import { OK, reportOf, secJson, secText } from "@/lib/sec"

/**
 * Insider trades from SEC Form 4 filings.
 *
 * Free, public-domain government data. No API key, no per-call cost. The SEC
 * asks for 10 requests/second max and a reachable contact in the User-Agent
 * (SEC_CONTACT), which is the same deal /api/statements runs on.
 *
 * WHY THE TRANSACTION CODE MATTERS MORE THAN THE DOLLARS
 * -----------------------------------------------------
 * Most "insider selling" headlines are wrong because they count every
 * disposition as a decision. On a Form 4:
 *
 *   P  open-market purchase        a real buy
 *   S  open-market sale            a real sell
 *   A  grant / award               compensation, not a purchase
 *   M  option exercise             converting options, usually paired with F or S
 *   F  shares withheld for taxes   NOT a sale the person chose
 *   G  gift
 *   C  conversion, D disposition to issuer, X option exercise
 *
 * An executive vesting stock and having 45% withheld for taxes shows up as a
 * huge "disposition" that they never decided to make. So every row carries
 * its code, a plain-language label, and `discretionary`, which is true only
 * for P and S. The app leads with those and files the rest under
 * compensation, because saying "Cook sold $40M" about a tax withholding
 * would be a fabricated story about a real number.
 *
 * The same care applies to an empty response. "This person has filed no Form 4
 * recently" and "the SEC wouldn't answer us" are different claims, and only the
 * first is ours to make — so the response carries `status` and `reason` (see
 * lib/sec.ts) and the page reads them.
 */

export const revalidate = 3600

/** How many recent Form 4s to open per person. Each is one more SEC request. */
const MAX_FILINGS = 12

type TxCode = "P" | "S" | "A" | "M" | "F" | "G" | "C" | "D" | "X" | string

function codeLabel(code: TxCode, acquired: boolean): string {
    switch (code) {
        case "P": return "Bought"
        case "S": return "Sold"
        case "A": return "Stock award"
        case "M": return "Options exercised"
        case "F": return "Withheld for taxes"
        case "G": return acquired ? "Gift received" : "Gift given"
        case "C": return "Converted"
        case "D": return "Returned to company"
        case "X": return "Options exercised"
        default: return acquired ? "Acquired" : "Disposed"
    }
}

/** Only P and S are a decision to trade on the open market. */
function isDiscretionary(code: TxCode): boolean {
    return code === "P" || code === "S"
}

function textOf(xml: string, tag: string): string | null {
    // Form 4 wraps most leaves in <value>, e.g.
    // <transactionShares><value>25000</value></transactionShares>
    const block = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)
    if (!block) return null
    const inner = /<value>([\s\S]*?)<\/value>/.exec(block[1])
    const raw = (inner ? inner[1] : block[1]).trim()
    return raw.length ? raw : null
}

function numberOf(xml: string, tag: string): number | null {
    const t = textOf(xml, tag)
    if (t == null) return null
    const n = Number(t.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
}

export async function GET(req: NextRequest) {
    const cik = (req.nextUrl.searchParams.get("cik") ?? "").replace(/\D/g, "")
    if (!cik) {
        return NextResponse.json({ error: "Pass a cik." }, { status: 400 })
    }
    const padded = cik.padStart(10, "0")

    const result = await secJson<any>(`https://data.sec.gov/submissions/CIK${padded}.json`, revalidate)
    if (result.status !== "ok") {
        return NextResponse.json({ cik: padded, name: null, trades: [], ...reportOf(result) })
    }
    const submissions = result.data

    const recent = submissions.filings?.recent
    const forms: string[] = recent?.form ?? []
    const indexes: number[] = []
    for (let i = 0; i < forms.length && indexes.length < MAX_FILINGS; i++) {
        if (forms[i] === "4") indexes.push(i)
    }

    const filings = indexes.map((i) => ({
        accession: String(recent.accessionNumber[i]).replace(/-/g, ""),
        // primaryDocument is the XSL-rendered HTML ("xslF345X06/form4.xml");
        // the machine-readable XML is the same name one level up.
        document: String(recent.primaryDocument[i]).replace(/^xsl[^/]*\//, ""),
        filedAt: String(recent.filingDate[i]),
    }))

    // A Form 4 we couldn't open is counted, not swallowed: if the SEC listed
    // twelve filings and refused all twelve documents, an empty list would
    // read as "never trades" about someone who trades constantly.
    let unreadable = 0

    const parsed = await Promise.all(
        filings.map(async (f) => {
            const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${f.accession}/${f.document}`
            const document = await secText(url, revalidate)
            if (document.status !== "ok") {
                unreadable += 1
                return []
            }
            const xml = document.data

            const issuerName = textOf(xml, "issuerName")
            const symbol = textOf(xml, "issuerTradingSymbol")
            const isDirector = textOf(xml, "isDirector") === "1"
            const isOfficer = textOf(xml, "isOfficer") === "1"
            const officerTitle = textOf(xml, "officerTitle")
            const role = officerTitle ?? (isOfficer ? "Officer" : isDirector ? "Director" : null)

            // Non-derivative transactions only: the plain share buys and
            // sells. Derivative rows (options grants) are a different story
            // and would double-count the exercises already listed here.
            const blocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? []
            return blocks.flatMap((block) => {
                const code = textOf(block, "transactionCode") ?? "?"
                const shares = numberOf(block, "transactionShares")
                const price = numberOf(block, "transactionPricePerShare")
                const acquired = (textOf(block, "transactionAcquiredDisposedCode") ?? "") === "A"
                const date = textOf(block, "transactionDate")
                if (shares == null || !date) return []
                return [{
                    date,
                    filedAt: f.filedAt,
                    symbol,
                    issuerName,
                    role,
                    code,
                    label: codeLabel(code, acquired),
                    discretionary: isDiscretionary(code),
                    acquired,
                    shares,
                    // A grant has no price; the app shows a dash rather than $0.
                    price: price && price > 0 ? price : null,
                    value: price && price > 0 ? Math.round(shares * price * 100) / 100 : null,
                    sharesAfter: numberOf(block, "sharesOwnedFollowingTransaction"),
                    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${f.accession}/${f.document}`,
                }]
            })
        })
    )

    const trades = parsed.flat().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    return NextResponse.json({
        cik: padded,
        name: submissions.name ?? null,
        trades,
        ...report(trades.length, filings.length, unreadable),
    })
}

/** What an empty — or partial — list of trades actually means. */
function report(trades: number, listed: number, unreadable: number) {
    if (unreadable > 0 && trades === 0) {
        return {
            status: "unavailable" as const,
            reason: "The SEC listed recent Form 4 filings but wouldn't serve them.",
        }
    }
    if (unreadable > 0) {
        return {
            status: "ok" as const,
            reason: `${unreadable} of ${listed} recent filings couldn't be read, so this list is incomplete.`,
        }
    }
    if (trades === 0 && listed === 0) {
        return { status: "no-data" as const, reason: "No Form 4 filings on record recently." }
    }
    return OK
}
