/**
 * Talking to the SEC, and being honest about it when it doesn't answer.
 *
 * Five routes read EDGAR. Each one used to collapse every possible failure into
 * the same empty array: a symbol that genuinely doesn't file, a filer that
 * doesn't tag a line, a 403 because our User-Agent was rejected, a 429 because
 * we were rate-limited, and a socket that never opened all produced
 * `{ items: [] }`. The screens above them then hid themselves, so a rejected
 * request rendered as "this person has never traded" — a claim we hadn't earned
 * and, on Vercel, one that was wrong for every symbol at once.
 *
 * So every SEC read returns a status:
 *
 *   ok            we have the data
 *   no-data       the SEC answered, and there is genuinely nothing here
 *   unavailable   the SEC refused us or couldn't be reached — we don't know
 *
 * "no-data" and "unavailable" are different sentences to a reader, and only the
 * first is safe to render as an empty section.
 */

export type SourceStatus = "ok" | "no-data" | "unavailable"

export type SecResult<T> =
    | { status: "ok"; data: T }
    | { status: "no-data"; reason: string }
    | { status: "unavailable"; reason: string }

/**
 * The SEC blocks callers who don't identify themselves with a contact that
 * actually receives mail. The fallback is a real address, but a deployment
 * serving real traffic should set SEC_CONTACT to its own — a shared default
 * across every deployment is what gets a User-Agent rate-limited.
 */
export const SEC_HEADERS: Record<string, string> = {
    "User-Agent": process.env.SEC_CONTACT ?? "FinnaCalc helpfinnacalc@gmail.com",
    Accept: "application/json",
}

/** True once we've logged the SEC_CONTACT hint, so a bad deploy logs it once. */
let warnedAboutContact = false

/**
 * Turns an HTTP response into a status.
 *
 * 404 is the only code that means "nothing here": EDGAR returns it for a CIK
 * with no filings of that kind. Everything else non-2xx means the SEC declined
 * to tell us, which is not the same answer and must not be shown as one.
 */
function classify(status: number, url: string): { status: "no-data" | "unavailable"; reason: string } {
    if (status === 404) {
        return { status: "no-data", reason: "The SEC has no filing at this address." }
    }
    if (status === 401 || status === 403) {
        if (!warnedAboutContact) {
            warnedAboutContact = true
            console.warn(
                `[sec] ${status} from ${url}. The SEC rejects callers it can't identify — ` +
                    `set SEC_CONTACT to "YourApp you@example.com" in this environment.`
            )
        }
        return { status: "unavailable", reason: "The SEC declined the request." }
    }
    if (status === 429) {
        return { status: "unavailable", reason: "The SEC is rate-limiting us right now." }
    }
    return { status: "unavailable", reason: `The SEC returned an error (HTTP ${status}).` }
}

async function read<T>(
    url: string,
    revalidate: number,
    parse: (response: Response) => Promise<T>
): Promise<SecResult<T>> {
    let response: Response
    try {
        response = await fetch(url, { headers: SEC_HEADERS, next: { revalidate } })
    } catch {
        // No response at all: DNS, TLS, a blocked egress route. We know nothing
        // about whether the filing exists.
        return { status: "unavailable", reason: "Couldn't reach the SEC." }
    }

    if (!response.ok) return classify(response.status, url)

    try {
        return { status: "ok", data: await parse(response) }
    } catch {
        // A 200 whose body doesn't parse is the SEC serving us something else —
        // an error page, a truncated response. Still not "nothing here".
        return { status: "unavailable", reason: "The SEC's response couldn't be read." }
    }
}

export function secJson<T = any>(url: string, revalidate: number): Promise<SecResult<T>> {
    return read<T>(url, revalidate, (response) => response.json() as Promise<T>)
}

export function secText(url: string, revalidate: number): Promise<SecResult<string>> {
    return read<string>(url, revalidate, (response) => response.text())
}

export function secBuffer(url: string, revalidate: number): Promise<SecResult<Buffer>> {
    return read<Buffer>(url, revalidate, async (response) =>
        Buffer.from(await response.arrayBuffer())
    )
}

/**
 * The CIK for a ticker, or why we don't have one.
 *
 * Distinguishes "this ticker isn't in the SEC's map" — true of most ETFs and
 * foreign listings — from "we couldn't read the map", which tells us nothing
 * about the ticker at all.
 */
export async function cikFor(symbol: string): Promise<SecResult<string>> {
    // The ticker map moves slowly, so it's cached far longer than the filings.
    const result = await secJson<Record<string, { cik_str: number; ticker: string }>>(
        "https://www.sec.gov/files/company_tickers.json",
        604800
    )
    if (result.status !== "ok") return result

    // Class shares are written BRK.B by people and by quote feeds, but the SEC
    // writes them BRK-B.
    const candidates = [symbol, symbol.replace(/\./g, "-")]
    const hit = Object.values(result.data).find((company) => candidates.includes(company.ticker))
    if (!hit) {
        return {
            status: "no-data",
            reason: `${symbol} isn't in the SEC's ticker-to-company map, so we can't look up its filings.`,
        }
    }
    return { status: "ok", data: String(hit.cik_str).padStart(10, "0") }
}

/**
 * What a route reports alongside its (possibly empty) payload.
 *
 * `reason` is written to be shown to a reader, so it names what happened
 * without naming environment variables — the operator's hint goes to the server
 * log instead. It's null when the status is "ok".
 */
export type SourceReport = { status: SourceStatus; reason: string | null }

export const OK: SourceReport = { status: "ok", reason: null }

export function reportOf(result: SecResult<unknown>): SourceReport {
    return result.status === "ok" ? OK : { status: result.status, reason: result.reason }
}
