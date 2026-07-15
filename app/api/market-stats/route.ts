import { NextRequest, NextResponse } from "next/server";
import { fetchQuote } from "@/lib/quotes";

// Price + day-change for a handful of symbols — the Home tab's "Markets today"
// row (S&P 500 / Nasdaq / Bitcoin).
//
// Why this exists instead of calling /api/stock three times: that route also
// pulls a company profile and metrics to render a full stock page, which this
// row doesn't show. For an index or crypto it spent TWO of FMP's scarce daily
// requests per symbol (profile + quote fallback) — six per Home load — and its
// quote cache is only 60s, so steady traffic burned roughly 4,400 FMP requests
// a day against a free-tier limit of 250. The quota then dies for everyone and
// index/crypto quotes disappear app-wide.
//
// So: quotes only, all symbols in one response, cached hard. Finnhub covers
// equities for free; only indices/crypto reach FMP, and at 15-minute
// revalidation that's ~3 FMP requests per refresh — at most ~288/day under
// literally constant traffic, and far less in practice (no traffic, no
// refresh). Fifteen minutes stale is fine for an at-a-glance markets row.
export const revalidate = 900;

const MAX_SYMBOLS = 6;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbols = (searchParams.get("symbols") ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, MAX_SYMBOLS);

    if (symbols.length === 0) {
        return NextResponse.json({ error: "symbols is required." }, { status: 400 });
    }

    const stats = (
        await Promise.all(
            symbols.map(async (symbol) => {
                const quote = await fetchQuote(symbol, revalidate);
                if (!quote) return null;
                return {
                    symbol,
                    name: quote.name,
                    price: quote.price,
                    changePct: quote.changePct,
                };
            }),
        )
    ).filter(Boolean);

    // Unresolved symbols are simply absent — the client renders "—" for them
    // rather than showing a fabricated figure.
    return NextResponse.json({ stats });
}
