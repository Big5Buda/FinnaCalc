/**
 * Alpaca is the single market-data provider. Finnhub, FMP and Twelve Data are
 * gone; every quote, bar, asset lookup, mover and news item on this backend now
 * comes from here.
 *
 * Required environment variables:
 *   ALPACA_API_KEY_ID       — the key id
 *   ALPACA_API_SECRET_KEY   — its secret
 *
 * The free market-data plan serves the IEX feed, which is what these calls ask
 * for. IEX is one venue rather than the consolidated tape, so its volume is a
 * share of the market's and its last price can differ slightly from SIP; that
 * is a real limitation of the free plan, not a bug to paper over. Move FEED to
 * "sip" if the keys are ever upgraded.
 */

const KEY_ID = process.env.ALPACA_API_KEY_ID
const SECRET_KEY = process.env.ALPACA_API_SECRET_KEY

export const isAlpacaConfigured = Boolean(KEY_ID && SECRET_KEY)

/** The data feed the free plan serves. */
export const FEED = "iex"

const DATA_BASE = "https://data.alpaca.markets"
/**
 * Assets live on the trading API, not the data API, and the two hosts do not
 * accept the same credentials. Paper-trading keys are refused by the LIVE host,
 * `get` turns the refusal into null, and the caller renders a bare symbol where
 * a company name should be. That is what shipped: .env.example tells the
 * operator "a paper-trading account is enough", which is true of
 * data.alpaca.markets and false of this host, so every company name in the app
 * came back empty and /api/stock-search answered [] for every query while the
 * prices beside them stayed correct.
 *
 * The host therefore has to be nameable per deployment. Set ALPACA_TRADING_BASE
 * to "https://paper-api.alpaca.markets" when the keys belong to a paper
 * account; the live host stays the default, so a live-keyed deployment is
 * unchanged. The value is trimmed and tested for emptiness rather than read
 * with `??`, because a variable added in the Vercel UI and left blank arrives
 * as "": `??` would accept it, every asset URL would become a relative path
 * that fetch rejects, and the result would be the same silent null this change
 * exists to remove.
 */
const TRADING_BASE = process.env.ALPACA_TRADING_BASE?.trim() || "https://api.alpaca.markets"

function headers(): Record<string, string> {
    return {
        "APCA-API-KEY-ID": KEY_ID ?? "",
        "APCA-API-SECRET-KEY": SECRET_KEY ?? "",
        Accept: "application/json",
    }
}

/** Host and status pairs already logged, so a bad key reports once, not once per request. */
const warnedRefusals = new Set<string>()

/**
 * A refusal and an empty answer both reach the caller as null, which is how
 * every company name in the app could go missing for days with nothing in the
 * logs to say the trading host was turning us away. lib/sec.ts draws the same
 * line for EDGAR and says so out loud; this does it for Alpaca, once per host
 * and status so a restart is not needed to hear about a new kind of failure.
 *
 * 404 stays silent on purpose: on /v2/assets it means the symbol does not
 * exist, which is a real answer rather than a door closed in our face.
 */
function warnRefusal(url: string, status: number) {
    if (status !== 401 && status !== 403 && status !== 429) return
    let host = url
    try {
        host = new URL(url).host
    } catch {
        // A malformed url is still worth naming in the log, so keep the raw string.
    }
    const seen = `${host} ${status}`
    if (warnedRefusals.has(seen)) return
    warnedRefusals.add(seen)
    if (status === 429) {
        console.warn(`[alpaca] 429 from ${host}. The plan's calls-per-minute ceiling is being hit.`)
        return
    }
    console.warn(
        `[alpaca] ${status} from ${host}. This is a credential mismatch, not a missing symbol: ` +
            `paper keys are accepted by data.alpaca.markets and paper-api.alpaca.markets and ` +
            `refused by api.alpaca.markets. Set ALPACA_TRADING_BASE if these are paper keys.`
    )
}

/** GET returning parsed JSON, or null on any failure. Callers degrade to "—". */
async function get<T>(url: string, revalidate: number): Promise<T | null> {
    if (!isAlpacaConfigured) return null
    try {
        const res = await fetch(url, { headers: headers(), next: { revalidate } })
        if (!res.ok) {
            warnRefusal(url, res.status)
            return null
        }
        return (await res.json()) as T
    } catch {
        return null
    }
}

/**
 * The app and the site both write crypto pairs the provider-neutral way
 * ("BTCUSD"); Alpaca's crypto endpoints want "BTC/USD".
 */
const CRYPTO_QUOTES = ["USD", "USDT", "USDC", "BTC"]

export function isCryptoSymbol(symbol: string): boolean {
    if (symbol.includes("/")) return true
    return CRYPTO_QUOTES.some(
        (quote) => symbol.endsWith(quote) && symbol.length > quote.length + 1 && !symbol.includes(".")
    )
}

export function toAlpacaCrypto(symbol: string): string {
    if (symbol.includes("/")) return symbol
    const quote = CRYPTO_QUOTES.find((candidate) => symbol.endsWith(candidate))
    if (!quote) return symbol
    return `${symbol.slice(0, -quote.length)}/${quote}`
}

/** "BTC/USD" → "BTCUSD", so responses echo the symbol the caller asked for. */
export function fromAlpacaCrypto(symbol: string): string {
    return symbol.replace("/", "")
}

// MARK: - Snapshots (quotes)

export type AlpacaBar = { t: string; o: number; h: number; l: number; c: number; v: number }

export type AlpacaSnapshot = {
    latestTrade?: { p: number; t: string }
    latestQuote?: { ap: number; bp: number }
    dailyBar?: AlpacaBar
    prevDailyBar?: AlpacaBar
    minuteBar?: AlpacaBar
}

/** Snapshots for a batch of equity symbols, keyed by symbol. */
export async function stockSnapshots(
    symbols: string[],
    revalidate = 60
): Promise<Record<string, AlpacaSnapshot>> {
    if (symbols.length === 0) return {}
    const url = `${DATA_BASE}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(","))}&feed=${FEED}`
    const json = await get<Record<string, AlpacaSnapshot> & { snapshots?: Record<string, AlpacaSnapshot> }>(
        url,
        revalidate
    )
    if (!json) return {}
    // The endpoint has shipped both shapes; accept either.
    return json.snapshots ?? (json as Record<string, AlpacaSnapshot>)
}

/** Snapshots for crypto pairs, keyed by the caller's own symbol form. */
export async function cryptoSnapshots(
    symbols: string[],
    revalidate = 60
): Promise<Record<string, AlpacaSnapshot>> {
    if (symbols.length === 0) return {}
    const pairs = symbols.map(toAlpacaCrypto)
    const url = `${DATA_BASE}/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(pairs.join(","))}`
    const json = await get<{ snapshots?: Record<string, AlpacaSnapshot> }>(url, revalidate)
    const snapshots = json?.snapshots ?? {}
    const out: Record<string, AlpacaSnapshot> = {}
    for (const [pair, snapshot] of Object.entries(snapshots)) {
        out[fromAlpacaCrypto(pair)] = snapshot
    }
    return out
}

/** The last price a snapshot can honestly report, or null. */
export function snapshotPrice(snapshot: AlpacaSnapshot | undefined): number | null {
    const price =
        snapshot?.latestTrade?.p ??
        snapshot?.minuteBar?.c ??
        snapshot?.dailyBar?.c ??
        snapshot?.prevDailyBar?.c
    return typeof price === "number" && price > 0 ? price : null
}

/**
 * The day's move, measured against the previous session's close — the same
 * reference the app's headline percentage uses. null when either side is
 * missing, so nothing is invented.
 */
export function snapshotChange(
    snapshot: AlpacaSnapshot | undefined
): { change: number; changePct: number } | null {
    const price = snapshotPrice(snapshot)
    const previousClose = snapshot?.prevDailyBar?.c
    if (price === null || typeof previousClose !== "number" || previousClose <= 0) return null
    const change = price - previousClose
    return { change, changePct: (change / previousClose) * 100 }
}

// MARK: - Bars

export type BarTimeframe = "1Min" | "5Min" | "15Min" | "30Min" | "1Hour" | "1Day" | "1Week"

/**
 * How corporate actions are folded into historical prices.
 *
 * "split" is the default and what every chart in the app has always used: a
 * 10-for-1 split does not draw as a 90% crash. It deliberately leaves
 * dividends out, which is right for a price chart and wrong for a backtest.
 * Measured on KO over the available window, price return is +92.5% and total
 * return is +130.0%, so a "what would I have made" answer built on split-only
 * bars understates the truth by 37 percentage points.
 *
 * "all" adds dividend adjustment, giving total return. Ask for it where the
 * question is about money earned rather than price drawn.
 */
export type BarAdjustment = "split" | "all"

/** Bars for one symbol, oldest first. */
export async function bars(
    symbol: string,
    timeframe: BarTimeframe,
    start: Date,
    limit: number,
    revalidate = 60,
    adjustment: BarAdjustment = "split"
): Promise<AlpacaBar[]> {
    const crypto = isCryptoSymbol(symbol)
    const url = crypto
        ? `${DATA_BASE}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(toAlpacaCrypto(symbol))}` +
          `&timeframe=${timeframe}&start=${start.toISOString()}&limit=${limit}`
        : `${DATA_BASE}/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}` +
          `&timeframe=${timeframe}&start=${start.toISOString()}&limit=${limit}&feed=${FEED}&adjustment=${adjustment}`

    const json = await get<{ bars?: Record<string, AlpacaBar[]> }>(url, revalidate)
    const key = crypto ? toAlpacaCrypto(symbol) : symbol
    return json?.bars?.[key] ?? []
}

/** Bars for several symbols in one request, keyed by the caller's symbol form. */
export async function multiBars(
    symbols: string[],
    timeframe: BarTimeframe,
    start: Date,
    limit: number,
    revalidate = 900
): Promise<Record<string, AlpacaBar[]>> {
    if (symbols.length === 0) return {}
    const equities = symbols.filter((symbol) => !isCryptoSymbol(symbol))
    const cryptos = symbols.filter(isCryptoSymbol)
    const out: Record<string, AlpacaBar[]> = {}

    if (equities.length > 0) {
        const url =
            `${DATA_BASE}/v2/stocks/bars?symbols=${encodeURIComponent(equities.join(","))}` +
            `&timeframe=${timeframe}&start=${start.toISOString()}&limit=${limit}&feed=${FEED}&adjustment=split`
        const json = await get<{ bars?: Record<string, AlpacaBar[]> }>(url, revalidate)
        for (const [symbol, list] of Object.entries(json?.bars ?? {})) out[symbol] = list
    }

    if (cryptos.length > 0) {
        const pairs = cryptos.map(toAlpacaCrypto)
        const url =
            `${DATA_BASE}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pairs.join(","))}` +
            `&timeframe=${timeframe}&start=${start.toISOString()}&limit=${limit}`
        const json = await get<{ bars?: Record<string, AlpacaBar[]> }>(url, revalidate)
        for (const [pair, list] of Object.entries(json?.bars ?? {})) out[fromAlpacaCrypto(pair)] = list
    }

    return out
}

// MARK: - Assets (names and search)

export type AlpacaAsset = {
    symbol: string
    name: string
    exchange: string
    class: string
    tradable: boolean
    status: string
}

/** One asset, for its display name. */
export async function asset(symbol: string, revalidate = 86400): Promise<AlpacaAsset | null> {
    return get<AlpacaAsset>(`${TRADING_BASE}/v2/assets/${encodeURIComponent(symbol)}`, revalidate)
}

/**
 * Every active, tradable US equity. Cached for a day — it's a large list and it
 * barely moves — and used for symbol search, which Alpaca has no query endpoint
 * for.
 */
export async function activeAssets(revalidate = 86400): Promise<AlpacaAsset[]> {
    const json = await get<AlpacaAsset[]>(
        `${TRADING_BASE}/v2/assets?status=active&asset_class=us_equity`,
        revalidate
    )
    return Array.isArray(json) ? json : []
}

// MARK: - News

export type AlpacaNews = {
    id: number
    headline: string
    summary: string
    author: string
    source: string
    url: string
    images?: { size: string; url: string }[]
    symbols: string[]
    created_at: string
    updated_at: string
}

export async function news(
    { symbols, limit = 20 }: { symbols?: string[]; limit?: number },
    revalidate = 600
): Promise<AlpacaNews[]> {
    const params = new URLSearchParams({ limit: String(limit), sort: "desc", exclude_contentless: "true" })
    if (symbols && symbols.length > 0) params.set("symbols", symbols.join(","))
    const json = await get<{ news?: AlpacaNews[] }>(
        `${DATA_BASE}/v1beta1/news?${params.toString()}`,
        revalidate
    )
    return json?.news ?? []
}

// MARK: - Screener

export type AlpacaMover = { symbol: string; percent_change: number; change: number; price: number }

export async function movers(
    top = 10,
    revalidate = 300
): Promise<{ gainers: AlpacaMover[]; losers: AlpacaMover[] }> {
    const json = await get<{ gainers?: AlpacaMover[]; losers?: AlpacaMover[] }>(
        `${DATA_BASE}/v1beta1/screener/stocks/movers?top=${top}`,
        revalidate
    )
    return { gainers: json?.gainers ?? [], losers: json?.losers ?? [] }
}

export type AlpacaActive = { symbol: string; volume: number; trade_count: number }

export async function mostActives(
    top = 50,
    by: "volume" | "trades" = "volume",
    revalidate = 300
): Promise<AlpacaActive[]> {
    const json = await get<{ most_actives?: AlpacaActive[] }>(
        `${DATA_BASE}/v1beta1/screener/stocks/most-actives?by=${by}&top=${top}`,
        revalidate
    )
    return json?.most_actives ?? []
}
