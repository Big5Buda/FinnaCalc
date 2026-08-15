import { NextRequest, NextResponse } from "next/server";
import { asset, isCryptoSymbol } from "@/lib/alpaca";
import { fetchQuotes } from "@/lib/quotes";

// Price + day-change for a handful of symbols — the Home tab's "Markets today"
// row and the S&P card.
//
// Why this exists instead of calling /api/stock per symbol: that route also
// pulls the asset record and a year of bars to render a full stock page, which
// this row doesn't show. Here it's quotes only, every symbol in one Alpaca
// snapshot call, cached hard. Fifteen minutes stale is fine for an
// at-a-glance markets row.

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

    const quotes = await fetchQuotes(symbols, revalidate);

    const stats = await Promise.all(
        symbols
            .filter((symbol) => quotes[symbol])
            .map(async (symbol) => {
                const quote = quotes[symbol];
                // Names are day-cached asset lookups, and only equities have one.
                const name = isCryptoSymbol(symbol) ? null : ((await asset(symbol))?.name ?? null);
                return { symbol, name, price: quote.price, changePct: quote.changePct };
            })
    );

    // Unresolved symbols are simply absent — the client renders "—" for them
    // rather than showing a fabricated figure.
    return NextResponse.json({ stats });
}
