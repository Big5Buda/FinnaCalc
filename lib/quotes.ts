// Shared live-quote lookup: Finnhub first, FMP as the fallback.
//
// Finnhub's free tier covers US equities but NOT indices (^GSPC, ^IXIC) or
// crypto (BTCUSD), so those fall through to FMP. That fallback matters for the
// quota: FMP's free tier allows only 250 requests/DAY, while Finnhub's is
// per-minute — so every FMP call is scarce and every Finnhub call is not.
// Callers should cache accordingly (see /api/market-stats).

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE = "https://finnhub.io/api/v1";
const FMP_KEY = process.env.FMP_API_KEY;

export type LiveQuote = {
    price: number;
    change: number;
    changePct: number;
    /// Instrument name, when the provider supplies one (FMP does; Finnhub's
    /// /quote does not).
    name: string | null;
};

/// Returns parsed JSON, or null on any failure (network, non-OK, premium-gated).
async function fhSafe(path: string, revalidate: number): Promise<any | null> {
    if (!FINNHUB_API_KEY) return null;
    try {
        const res = await fetch(`${FINNHUB_BASE}${path}&token=${FINNHUB_API_KEY}`, {
            next: { revalidate },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/// FMP quote — the only free source here for indices and crypto. Tries the
/// `stable` then legacy `v3` form, since which one is served depends on plan.
export async function fmpQuote(symbol: string, revalidate = 60): Promise<any | null> {
    if (!FMP_KEY) return null;
    const urls = [
        `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`,
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`,
    ];
    for (const url of urls) {
        try {
            const res = await fetch(url, { next: { revalidate } });
            if (!res.ok) continue;
            const arr = await res.json();
            const q = Array.isArray(arr) ? arr[0] : arr;
            if (q && typeof q.price === "number" && q.price > 0) return q;
        } catch {
            // try the next form
        }
    }
    return null;
}

/// A live price for any instrument, or null when no provider has one.
/// `revalidate` is forwarded to both providers so callers can trade freshness
/// against the FMP daily quota.
export async function fetchQuote(symbol: string, revalidate = 60): Promise<LiveQuote | null> {
    const fh = await fhSafe(`/quote?symbol=${encodeURIComponent(symbol)}`, revalidate);
    if (fh && typeof fh.c === "number" && fh.c > 0) {
        return {
            price: fh.c,
            change: typeof fh.d === "number" ? fh.d : 0,
            changePct: typeof fh.dp === "number" ? fh.dp : 0,
            name: null,
        };
    }
    const fq = await fmpQuote(symbol, revalidate);
    if (fq) {
        return {
            price: fq.price,
            change: typeof fq.change === "number" ? fq.change : 0,
            changePct: typeof fq.changePercentage === "number" ? fq.changePercentage
                : typeof fq.changesPercentage === "number" ? fq.changesPercentage : 0,
            name: typeof fq.name === "string" ? fq.name : null,
        };
    }
    return null;
}
