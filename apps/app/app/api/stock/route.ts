import { NextRequest, NextResponse } from "next/server";
import { asset, bars, isCryptoSymbol } from "@/lib/alpaca";
import { fetchQuote } from "@/lib/quotes";

// Everything one symbol's page needs, from Alpaca.
//
// Alpaca is a market-data and brokerage API, not a fundamentals vendor: it
// serves prices, bars, assets and news, and has no company profile, no
// valuation metrics and no analyst data. The fields those used to fill are
// returned as null rather than guessed at, and the iOS sections that read them
// hide themselves on null — see StockStatsFields / StockCompanyFields, whose
// members are all optional for exactly this reason.
//
// The two stats that ARE derivable from price history are: the 52-week high and
// low, summed here from a year of daily bars.

export const revalidate = 60;

async function fiftyTwoWeek(symbol: string): Promise<{ high: number | null; low: number | null }> {
    const start = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000);
    const year = await bars(symbol, "1Day", start, 400, 3600);
    if (year.length === 0) return { high: null, low: null };
    return {
        high: Math.max(...year.map((bar) => bar.h)),
        low: Math.min(...year.map((bar) => bar.l)),
    };
}

export async function GET(request: NextRequest) {
    const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase().trim();
    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    try {
        const [quoteSrc, info, window] = await Promise.all([
            fetchQuote(symbol, revalidate),
            isCryptoSymbol(symbol) ? Promise.resolve(null) : asset(symbol),
            fiftyTwoWeek(symbol),
        ]);

        if (!quoteSrc) {
            return NextResponse.json({ error: `No data found for symbol "${symbol}".` }, { status: 404 });
        }

        const quote = {
            "01. symbol": symbol,
            "05. price": String(quoteSrc.price),
            "09. change": String(quoteSrc.change),
            "10. change percent": `${quoteSrc.changePct}%`,
        };

        const name = info?.name || quoteSrc.name || symbol;
        const overview = {
            Name: name,
            // Market cap and P/E need shares outstanding and earnings, which
            // Alpaca doesn't carry. "0"/"N/A" are the values the app already
            // treats as "not known".
            MarketCapitalization: "0",
            Description: "No description available.",
            Logo: "",
            PERatio: "N/A",
        };

        const stats = {
            high52: window.high,
            low52: window.low,
            beta: null,
            epsTTM: null,
            dividendYield: null,
            netMargin: null,
            revenueGrowth: null,
            grossMargin: null,
            sharesOutstanding: null,
        };

        const company = {
            exchange: info?.exchange ?? null,
            industry: null,
            sector: null,
            ceo: null,
            employees: null,
            ipo: null,
            website: null,
            country: null,
        };

        // Retired-ticker resolution came from a vendor feed that has been
        // removed with the rest of them; the field stays so older app builds
        // keep decoding this payload.
        return NextResponse.json({ quote, overview, stats, company, alias: null });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch stock data." }, { status: 500 });
    }
}
