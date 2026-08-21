import { NextRequest, NextResponse } from "next/server";
import { asset, isCryptoSymbol } from "@/lib/alpaca";
import { fetchQuotes } from "@/lib/quotes";

// Price + day-change for a set of symbols: the Home tab's "Markets today" row,
// the S&P card, and every holding in a connected portfolio.
//
// Why this exists instead of calling /api/stock per symbol: that route also
// pulls the asset record and a year of bars to render a full stock page, which
// these callers don't show. Here it's quotes only, every symbol in one Alpaca
// snapshot call, cached hard. Fifteen minutes stale is fine for an
// at-a-glance markets row.
//
// THE CAP USED TO BE SIX, AND SILENT.
// -----------------------------------
// This route was written for a markets row of a handful of tickers, and capped
// at six with a bare .slice(). Then the portfolio started asking it to price
// every holding. The app builds that list from a Swift Set, whose iteration
// order changes between launches, so a seven-holding portfolio lost the quote
// for a DIFFERENT holding every time the app started, and the page showed a
// dash beside a real position. From the outside it looked like the data was
// missing; it was thrown away here, after Alpaca had already returned it.
//
// Two lessons are built into what follows. The cap is now high enough for a
// real portfolio, because Alpaca takes every symbol in a single snapshot call
// and the old limit bought us nothing. And when it does bite, the response
// SAYS SO in `truncated` rather than quietly returning a short list that reads
// like "these symbols have no price".

export const revalidate = 900;
export const maxDuration = 30;

// Alpaca's snapshots endpoint takes them all at once, so the only per-symbol
// cost here is the optional name lookup. This is an abuse ceiling, not a
// provider limit: it is far above any real portfolio.
const MAX_SYMBOLS = 120;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const asked = (searchParams.get("symbols") ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

    // Duplicates would each cost an asset lookup and land on the same key.
    const unique = [...new Set(asked)];
    const symbols = unique.slice(0, MAX_SYMBOLS);
    const truncated = unique.slice(MAX_SYMBOLS);

    if (symbols.length === 0) {
        return NextResponse.json({ error: "symbols is required." }, { status: 400 });
    }

    // Names cost one day-cached asset call each, and the portfolio never shows
    // them: it labels rows with the ticker it already has. `names=0` lets a
    // caller pricing thirty holdings skip thirty requests it has no use for.
    const wantNames = searchParams.get("names") !== "0";

    const quotes = await fetchQuotes(symbols, revalidate);

    const stats = await Promise.all(
        symbols
            .filter((symbol) => quotes[symbol])
            .map(async (symbol) => {
                const quote = quotes[symbol];
                // Names are day-cached asset lookups, and only equities have one.
                const name =
                    wantNames && !isCryptoSymbol(symbol)
                        ? ((await asset(symbol))?.name ?? null)
                        : null;
                // `change` rides along because the caller cannot reliably
                // recover it: deriving a previous close as
                // price / (1 + changePct / 100) divides by a figure that
                // approaches zero for a stock that nearly halved. The
                // subtraction price - change is exact, and the day chart
                // needs that reference to colour itself against the previous
                // close rather than against its own first bar.
                return { symbol, name, price: quote.price, change: quote.change, changePct: quote.changePct };
            })
    );

    // Unresolved symbols are simply absent, and the client renders a dash for
    // them rather than showing a fabricated figure. Anything cut for being over
    // the ceiling is named separately, because "we did not ask" and "there is no
    // price" are different facts and only one of them is about the market.
    return NextResponse.json(truncated.length ? { stats, truncated } : { stats });
}
