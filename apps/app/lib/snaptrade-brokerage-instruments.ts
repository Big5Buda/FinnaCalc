import { getSnapTrade } from "./snaptrade"

/** Per-brokerage instrument metadata from
 * GET /brokerages/{slug}/instruments (SDK referenceData.listAllBrokerageInstruments,
 * app key only). The official reference documents NO pagination, cursor,
 * limit or symbol filter: one call returns the whole list, and brokerages
 * without support return an empty list. Bounded here by timeout, response
 * size and item count; anything unexpected fails closed for dollars only.
 *
 * Quote/impact may reuse a coalesced entry up to 15 minutes old. Confirm uses
 * `fresh: true`: a new upstream read, sharing only a concurrently in-flight
 * request, never a cached result. */
export type InstrumentFacts = { tradeable: boolean | null; fractionable: boolean | null }
type Listing = { symbol: string; mic: string | null; id: string }
type Index = { rows: Array<{ symbol: string; mic: string | null; id: string | null; tradeable: boolean | null; fractionable: boolean | null }> }

export const INSTRUMENT_TTL_MS = 15 * 60_000
export const INSTRUMENT_FAILURE_TTL_MS = 60_000
export const INSTRUMENT_TIMEOUT_MS = 5_000
export const INSTRUMENT_MAX_BYTES = 64 * 1024 * 1024
export const INSTRUMENT_MAX_ROWS = 250_000

/** Per credential-instance + slug state. Each upstream read gets a ticket;
 * a result is published to the cache only if no newer read has published,
 * so a slow older read can never overwrite a fresher (e.g. negative) result. */
type Published = { ticket: number; expires: number; index: Index | null }
type State = { tickets: number; published: Published | null; inflight: { ticket: number; value: Promise<Index | null> } | null }
const states = new WeakMap<object, Map<string, State>>()
function state(client: object, slug: string): State {
    let bySlug = states.get(client)
    if (!bySlug) { bySlug = new Map(); states.set(client, bySlug) }
    let s = bySlug.get(slug)
    if (!s) { s = { tickets: 0, published: null, inflight: null }; bySlug.set(slug, s) }
    return s
}
const nullableString = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.length > 0)
const nullableBool = (v: unknown) => v === null || v === undefined || typeof v === "boolean"

/** Any malformed row rejects the WHOLE response: dropping a row could hide an
 * identity-bearing conflict and make a single match look unambiguous. An empty
 * list is treated as unavailable (unsupported brokerages return []). */
export function parseInstruments(data: any): Index | null {
    const instruments = data?.instruments
    if (!Array.isArray(instruments) || !instruments.length || instruments.length > INSTRUMENT_MAX_ROWS) return null
    const rows: Index["rows"] = []
    for (const i of instruments) {
        if (!i || typeof i !== "object" || typeof i.symbol !== "string" || !i.symbol
            || !nullableString(i.exchange_mic) || !nullableString(i.universal_symbol_id)
            || !nullableBool(i.tradeable) || !nullableBool(i.fractionable)) return null
        rows.push({ symbol: i.symbol, mic: i.exchange_mic ?? null, id: i.universal_symbol_id ?? null,
            tradeable: i.tradeable ?? null, fractionable: i.fractionable ?? null })
    }
    return { rows }
}
/** One overall deadline across the SDK's internal 429 retries/backoff: the
 * request is aborted and a late completion is ignored (the race has settled,
 * and nothing is published from the abandoned attempt). */
async function load(client: any, slug: string): Promise<Index | null> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null) }, INSTRUMENT_TIMEOUT_MS) })
    const read = client.referenceData.listAllBrokerageInstruments({ slug },
        { timeout: INSTRUMENT_TIMEOUT_MS, maxContentLength: INSTRUMENT_MAX_BYTES, signal: controller.signal })
        .then(({ data }: any) => controller.signal.aborted ? null : parseInstruments(data))
    read.catch(() => undefined) // a late rejection after the deadline is ignored
    try { return await Promise.race([read, deadline]) }
    catch { return null }
    finally { clearTimeout(timer) }
}
function startRead(client: object, slug: string, s: State): Promise<Index | null> {
    const ticket = ++s.tickets
    const value = load(client, slug).catch(() => null).then(index => {
        if (!s.published || ticket > s.published.ticket)
            s.published = { ticket, index, expires: Date.now() + (index ? INSTRUMENT_TTL_MS : INSTRUMENT_FAILURE_TTL_MS) }
        if (s.inflight?.ticket === ticket) s.inflight = null
        return index
    })
    s.inflight = { ticket, value }
    return value
}

/** Exactly one instrument row must bind ticker + exchange MIC + universal
 * symbol ID; no row may match on only one of them. Otherwise null. */
export function bindInstrument(index: Index | null, listing: Listing): InstrumentFacts | null {
    if (!index || !listing.mic || !listing.id || !listing.symbol) return null
    const candidates = index.rows.filter(r => r.id === listing.id || (r.symbol === listing.symbol && r.mic === listing.mic))
    if (candidates.length !== 1) return null
    const row = candidates[0]
    if (row.symbol !== listing.symbol || row.mic !== listing.mic || row.id !== listing.id) return null
    return { tradeable: row.tradeable, fractionable: row.fractionable }
}

export async function brokerageInstrument(clientId: string, slug: string, listing: Listing,
    { fresh }: { fresh: boolean }): Promise<InstrumentFacts | null> {
    try {
        if (!/^[A-Z0-9-]+$/.test(slug)) return null
        const client = getSnapTrade({ clientId }) as object
        const s = state(client, slug)
        // Fresh (confirm): never a cached result; may share only a read already
        // in flight. Its result replaces the cache for later quotes/impacts.
        if (!fresh && s.published && s.published.expires > Date.now()) return bindInstrument(s.published.index, listing)
        const value = s.inflight ? s.inflight.value : startRead(client, slug, s)
        return bindInstrument(await value, listing)
    } catch { return null }
}

/** Explicitly policy-selected preview-only institutions may lack this endpoint.
 * Only a valid empty instruments list means unsupported. Errors, malformed or
 * ambiguous bindings never grant eligibility; matching explicit false revokes it.
 * No cache: even quote/confirm checks observe current negative provider facts.
 */
export async function previewOnlyInstrumentEligibility(clientId: string, slug: string, listing: Listing): Promise<boolean> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<boolean>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false) }, INSTRUMENT_TIMEOUT_MS) })
    const read = async () => {
        try {
            const client = getSnapTrade({ clientId })
            const { data } = await client.referenceData.listAllBrokerageInstruments({ slug },
                { timeout: INSTRUMENT_TIMEOUT_MS, maxContentLength: INSTRUMENT_MAX_BYTES, signal: controller.signal })
            if (controller.signal.aborted || !Array.isArray(data?.instruments)) return false
            if (data.instruments.length === 0) return true
            const facts = bindInstrument(parseInstruments(data), listing)
            return facts?.tradeable === true && facts.fractionable === true
        } catch { return false }
    }
    try { return await Promise.race([read(), deadline]) }
    finally { clearTimeout(timer) }
}
