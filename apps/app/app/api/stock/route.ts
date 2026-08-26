import { NextRequest, NextResponse } from "next/server";
import { asset, bars, isCryptoSymbol } from "@/lib/alpaca";
import { fetchQuote } from "@/lib/quotes";
import { symbolProfile } from "@/lib/investing/catalog";
import { companyName } from "@/lib/investing/names";
import { fundamentalsFor } from "@/lib/investing/fundamentals";
import { symbolAbout } from "@/lib/investing/profiles";

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
//
// The rest now come from the company's own SEC filings, via lib/investing/
// fundamentals, which reads the same company facts document /api/statements
// already downloads. See that file for what is derivable and what is not: in
// short, a filed figure is a fiscal year old at worst, a market cap is a live
// price against a filed share count, and a multi-class issuer whose share
// count the XBRL API drops gets null rather than a wrong number.

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

        // After the quote, because a market cap and a P/E are a live price
        // against a filed denominator. Crypto has no filings, and neither do
        // funds; both come back as every-field-null and every row hides.
        const filings = isCryptoSymbol(symbol)
            ? null
            : await fundamentalsFor(symbol, quoteSrc.price);

        const quote = {
            "01. symbol": symbol,
            "05. price": String(quoteSrc.price),
            // This block keeps the legacy string shape the app decodes, where
            // "0"/"N/A" already mean "not known" (see MarketCapitalization
            // below). A null move stays on that convention rather than
            // stringifying to the literal "null", which would not parse.
            "09. change": String(quoteSrc.change ?? 0),
            "10. change percent": `${quoteSrc.changePct ?? 0}%`,
        };

        // The hand-kept sector universe knows the company name and sector for
        // the large caps people hold. It is the same list /api/market-overview
        // has always used; this route simply never consulted it, which is why
        // AAPL came back as "AAPL" with a null sector here and as "Apple Inc.",
        // "Technology" one route over.
        const profile = symbolProfile(symbol);
        // Written by us, not filed. The SEC publishes no business description
        // in structured form, so this is a hand-kept list covering the same
        // large caps the sector universe does. See lib/investing/profiles.
        const about = symbolAbout(symbol);
        // companyName layers the curated list over the SEC's free ticker file,
        // so this covers roughly 10,400 issuers rather than the 105 the
        // curated universe carries. Falling back to the symbol is last, and
        // it is why every page used to be titled with its own ticker.
        const name = (await companyName(symbol)) || info?.name || quoteSrc.name || symbol;
        const overview = {
            Name: name,
            // "0" and "N/A" are what the app already reads as "not known", so
            // an issuer whose filings don't support a figure keeps the old
            // value and the row keeps hiding itself.
            MarketCapitalization: filings?.marketCap != null ? String(Math.round(filings.marketCap)) : "0",
            // The app treats this exact string as "nothing to show", so a
            // symbol outside the curated list keeps hiding its paragraph.
            Description: about?.description ?? "No description available.",
            Logo: "",
            // Sent pre-formatted because the app prints this one verbatim.
            PERatio: filings?.peRatio != null ? filings.peRatio.toFixed(2) : "N/A",
        };

        const stats = {
            high52: window.high,
            low52: window.low,
            // Beta is a regression of this symbol's returns against an index.
            // Nothing in a filing carries it and Alpaca doesn't publish one,
            // so it stays null until something computes it from bars.
            beta: null,
            epsTTM: filings?.epsTTM ?? null,
            dividendYield: filings?.dividendYield ?? null,
            netMargin: filings?.netMargin ?? null,
            revenueGrowth: filings?.revenueGrowth ?? null,
            grossMargin: filings?.grossMargin ?? null,
            // MILLIONS of shares. The app's formatter divides by 1000 again
            // above 1000 to print "B", which is the Finnhub convention this
            // field was written against and which the iOS side still expects.
            sharesOutstanding:
                filings?.sharesOutstanding != null ? filings.sharesOutstanding / 1_000_000 : null,
        };

        const company = {
            exchange: info?.exchange ?? null,
            industry: null,
            sector: profile?.sector ?? null,
            ceo: null,
            // Not in SEC structured data. `dei` carries two facts per filer,
            // the cover-page share count and the public float; a headcount
            // lives in the 10-K's prose. Typing one by hand would print a
            // real, checkable figure that goes stale every February.
            employees: null,
            ipo: null,
            website: null,
            country: null,
            headquarters: about?.headquarters ?? null,
        };

        // Retired-ticker resolution came from a vendor feed that has been
        // removed with the rest of them; the field stays so older app builds
        // keep decoding this payload.
        return NextResponse.json({ quote, overview, stats, company, alias: null });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch stock data." }, { status: 500 });
    }
}
