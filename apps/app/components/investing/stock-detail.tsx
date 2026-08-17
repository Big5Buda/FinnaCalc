"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Bookmark, BookmarkCheck, Info, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed, int } from "@/lib/format"
import {
    candles,
    financials,
    statements,
    stockDetail,
    symbolNews,
    type CandlePoint,
    type FinancialPeriod,
    type NewsArticle,
    type StatementsResponse,
    type StockDetail,
} from "@/lib/investing/market"
import { useWatchlist } from "@/components/providers/watchlist-provider"
import { CompanyLogo, NewsList } from "@/components/investing/pieces"
import {
    ChartRangePicker,
    PriceChart,
    type ChartRange,
    type ChartStyle,
} from "@/components/investing/price-chart"
import { Button, Notice, SectionLabel } from "@/components/ui/primitives"
import { SegmentedControl } from "@/components/shell/surface"

/**
 * What we say when a source didn't answer and gave no reason of its own.
 * Deliberately about us, not about the company: we don't know either way.
 */
const UNAVAILABLE = "SEC filings couldn't be loaded right now."

/**
 * The stock detail page, ported from StocksPageView.swift: hero, chart with the
 * range pills and a candle/scale toggle, key stats with their explainers,
 * about, SEC statements, the revenue/profit bars and per-symbol news.
 *
 * Alpaca serves prices, not fundamentals, so most Key Stats rows are absent for
 * every symbol today — each row renders only when its figure is real, which is
 * the same rule the app screen follows.
 */

/** Candle size follows the window: a 1-minute candle can't reach back a year. */
function candleInterval(range: ChartRange): string {
    switch (range) {
        case "1D":
            return "5min"
        case "1W":
            return "30min"
        case "1M":
            return "1day"
        case "1Y":
            return "1day"
        default:
            return "1week"
    }
}

export function StockDetailPage({ symbol }: { symbol: string }) {
    const ticker = symbol.toUpperCase()
    const watchlist = useWatchlist()

    const [stock, setStock] = useState<StockDetail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [range, setRange] = useState<ChartRange>("1D")
    const [style, setStyle] = useState<ChartStyle>("line")
    const [showScales, setShowScales] = useState(false)
    const [points, setPoints] = useState<CandlePoint[]>([])
    const [scrub, setScrub] = useState<CandlePoint | null>(null)
    const [news, setNews] = useState<NewsArticle[]>([])
    const [openInfo, setOpenInfo] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        setStock(null)
        setError(null)
        stockDetail(ticker)
            .then((data) => active && setStock(data))
            .catch((err: unknown) =>
                active && setError(err instanceof Error ? err.message : `No data found for "${ticker}".`)
            )
        symbolNews(ticker)
            .then((data) => active && setNews(data.articles))
            .catch(() => {})
        return () => {
            active = false
        }
    }, [ticker])

    useEffect(() => {
        let active = true
        setPoints([])
        candles(ticker, range, style === "candles" ? candleInterval(range) : undefined)
            .then((data) => active && setPoints(data.points))
            .catch(() => active && setPoints([]))
        return () => {
            active = false
        }
    }, [ticker, range, style])

    const price = stock ? Number(stock.quote["05. price"]) : null
    const change = stock ? Number(stock.quote["09. change"]) : null
    const changePct = stock ? Number.parseFloat(stock.quote["10. change percent"]) : null
    /**
     * Yesterday's close, for colouring the 1D chart against the same reference
     * the header's "% today" uses. Derived from the quote (price − change)
     * rather than the candles response.
     */
    const previousClose =
        price !== null && change !== null && Number.isFinite(price) && Number.isFinite(change)
            ? price - change
            : null

    const following = watchlist.contains(ticker)

    if (error) {
        return (
            <div className="w-full max-w-6xl px-6 py-10 lg:px-10">
                <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                    {error}
                </p>
                <Link href="/investing" className="mt-4 inline-block text-sm font-semibold text-primary">
                    ← Back to Investing
                </Link>
            </div>
        )
    }

    if (!stock || price === null) {
        return (
            <div className="flex w-full max-w-6xl flex-col gap-4 px-6 py-6 lg:px-10">
                <div className="h-24 animate-pulse rounded-xl bg-card" />
                <div className="h-56 animate-pulse rounded-xl bg-card" />
            </div>
        )
    }

    const isUp = (changePct ?? 0) >= 0

    return (
        <div className="flex w-full max-w-6xl flex-col gap-6 px-6 py-6 lg:px-10">
            <Link href="/investing" className="text-sm font-semibold text-primary">
                ← Investing
            </Link>

            <header className="flex flex-col gap-1">
                <div className="flex items-start gap-3">
                    <CompanyLogo symbol={ticker} size={44} />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <h1 className="truncate text-[23px] font-bold text-foreground">
                            {stock.overview.Name}
                        </h1>
                        <p className="text-base font-semibold text-muted-foreground">{ticker}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => watchlist.toggle(ticker)}
                        aria-label={following ? "Remove from watchlist" : "Add to watchlist"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
                    >
                        {following ? (
                            <BookmarkCheck className="h-4 w-4 text-primary" />
                        ) : (
                            <Bookmark className="h-4 w-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowScales((shown) => !shown)}
                        aria-label={showScales ? "Hide price scale" : "Show price scale"}
                        aria-pressed={showScales}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                    </button>
                </div>

                {scrub ? (
                    <>
                        <p className="figure text-[28px] font-bold text-foreground">${fixed(scrub.c, 2)}</p>
                        <p className="text-[13px] text-muted-foreground">
                            {new Date(scrub.t * 1000).toLocaleString()}
                        </p>
                    </>
                ) : (
                    <>
                        <p className="figure text-[28px] font-bold text-foreground">${fixed(price, 2)}</p>
                        <p className={cn("figure text-sm font-semibold", isUp ? "text-positive" : "text-negative")}>
                            {isUp ? "+" : "−"}${fixed(Math.abs(change ?? 0), 2)} (
                            {fixed(Math.abs(changePct ?? 0), 2)}%) today
                        </p>
                    </>
                )}
            </header>

            <section className="flex flex-col gap-3">
                <PriceChart
                    points={points}
                    style={style}
                    previousClose={range === "1D" ? previousClose : null}
                    showScales={showScales}
                    onScrub={setScrub}
                />
                <ChartRangePicker range={range} onChange={setRange} />
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={style === "candles" ? "default" : "outline"}
                        onClick={() => setStyle(style === "candles" ? "line" : "candles")}
                    >
                        {style === "candles" ? "Candles" : "Line"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => watchlist.toggle(ticker)}>
                        {following ? "In your watchlist" : "Add to watchlist"}
                    </Button>
                </div>
            </section>

            <KeyStats
                stock={stock}
                price={price}
                openInfo={openInfo}
                onToggleInfo={(label) => setOpenInfo(openInfo === label ? null : label)}
            />

            {stock.overview.Description && stock.overview.Description !== "No description available." && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-foreground">About</h2>
                    <p className="text-base text-body">{stock.overview.Description}</p>
                </section>
            )}

            <StatementsSection symbol={ticker} />
            <FinancialsSection symbol={ticker} />

            {news.length > 0 && (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>News</SectionLabel>
                    <NewsList articles={news} limit={8} />
                </section>
            )}
        </div>
    )
}

/** Plain-language notes behind the Key Stats info dots, ported verbatim. */
const STAT_INFO: Record<string, string> = {
    "Market cap":
        "The total value of all the company's shares: share price times shares outstanding. Under about $2 billion is usually called small cap, $2 to $10 billion mid cap, and above that large cap. Bigger companies tend to swing less in price than smaller ones, and smaller ones swing more in both directions.",
    "P/E ratio":
        "Share price divided by the last 12 months of earnings per share, so it shows what buyers are paying for each dollar the company earns. The S&P 500 has mostly traded between about 15x and 25x in recent decades, so readings near that band are ordinary, well above it usually means high growth is expected, and well below it often means the market sees slow growth or trouble. A company with no profit has no P/E at all.",
    Beta: "How much the stock tends to move when the overall market moves. 1 means about in line with the market, above 1 swings harder in both directions, below 1 swings less, and a negative beta has tended to move opposite the market. Most large companies land between about 0.5 and 1.5; utilities often sit near the bottom of that range and tech near the top.",
    "EPS (12 mos)":
        "Earnings per share: profit over the last 12 months divided by the number of shares. It is the E in the P/E ratio. A negative figure means the company lost money over that stretch.",
    "Dividend yield":
        "The cash paid out per year as a share of today's price. At a 2% yield, $100 of stock pays about $2 a year. The S&P 500 overall has yielded roughly 1 to 2% in recent years; steady payers often sit around 2 to 4%, and a yield far above that is worth a closer look since it can mean the price recently fell or the payout may not hold.",
    "Gross margin":
        "What is left from each dollar of sales after the direct cost of making the product, before overhead. It varies hugely by industry: software often runs 70% or higher while retailers and grocers commonly run 20 to 35%.",
    "Net margin":
        "The share of each dollar of sales kept as profit after every cost, taxes and interest included. Under about 5% is thin, around 10% is solid, and 20% or more is unusually strong, though the normal level differs a lot by industry.",
    "Revenue growth (yoy)":
        "How much sales changed compared with the same period a year earlier. Mature companies often grow single digits a year, while businesses priced as fast growers are usually expected to grow 15% or more.",
    "52-week high": "The highest price the stock traded at over the past year, summed from daily bars.",
    "52-week low": "The lowest price the stock traded at over the past year, summed from daily bars.",
}

function KeyStats({
    stock,
    price,
    openInfo,
    onToggleInfo,
}: {
    stock: StockDetail
    price: number
    openInfo: string | null
    onToggleInfo: (label: string) => void
}) {
    const stats = stock.stats
    const marketCap = Number(stock.overview.MarketCapitalization)
    const rows: { label: string; value: string }[] = [{ label: "Current price", value: `$${fixed(price, 2)}` }]

    if (Number.isFinite(marketCap) && marketCap > 0) {
        rows.push({ label: "Market cap", value: formatMarketCap(marketCap) })
    }
    if (stock.overview.PERatio && !["N/A", "None", ""].includes(stock.overview.PERatio)) {
        rows.push({ label: "P/E ratio", value: stock.overview.PERatio })
    }
    if (stats?.high52 != null) rows.push({ label: "52-week high", value: `$${fixed(stats.high52, 2)}` })
    if (stats?.low52 != null) rows.push({ label: "52-week low", value: `$${fixed(stats.low52, 2)}` })
    if (stats?.beta != null) rows.push({ label: "Beta", value: fixed(stats.beta, 2) })
    if (stats?.epsTTM != null) rows.push({ label: "EPS (12 mos)", value: `$${fixed(stats.epsTTM, 2)}` })
    if (stats?.dividendYield != null && stats.dividendYield > 0) {
        rows.push({ label: "Dividend yield", value: `${fixed(stats.dividendYield, 2)}%` })
    }
    if (stats?.grossMargin != null) rows.push({ label: "Gross margin", value: `${fixed(stats.grossMargin, 1)}%` })
    if (stats?.netMargin != null) rows.push({ label: "Net margin", value: `${fixed(stats.netMargin, 1)}%` })
    if (stats?.revenueGrowth != null) {
        rows.push({ label: "Revenue growth (yoy)", value: `${fixed(stats.revenueGrowth, 1)}%` })
    }

    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-foreground">Key Stats</h2>
            {rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-base text-muted-foreground">{row.label}</span>
                        {STAT_INFO[row.label] && (
                            <button
                                type="button"
                                onClick={() => onToggleInfo(row.label)}
                                aria-label={`What ${row.label} means`}
                                aria-expanded={openInfo === row.label}
                            >
                                <Info
                                    className={cn(
                                        "h-3.5 w-3.5",
                                        openInfo === row.label ? "text-primary" : "text-muted-foreground/70"
                                    )}
                                />
                            </button>
                        )}
                        <span className="figure ml-auto text-base font-semibold text-foreground">
                            {row.value}
                        </span>
                    </div>
                    {openInfo === row.label && STAT_INFO[row.label] && (
                        <p className="rounded-md bg-muted/50 p-2.5 text-sm text-muted-foreground">
                            {STAT_INFO[row.label]}
                        </p>
                    )}
                </div>
            ))}
        </section>
    )
}

function formatMarketCap(value: number): string {
    if (value >= 1e12) return `$${fixed(value / 1e12, 2)}T`
    if (value >= 1e9) return `$${fixed(value / 1e9, 2)}B`
    if (value >= 1e6) return `$${fixed(value / 1e6, 2)}M`
    return `$${int(value)}`
}

/**
 * Revenue and net profit bars, annual or quarterly.
 *
 * Hides when the company genuinely files nothing we can read — most ETFs and
 * foreign listings — and says so when the SEC refused us instead. Those used to
 * look identical from here, so a rejected request silently removed the section
 * and read as a fact about the company.
 */
function FinancialsSection({ symbol }: { symbol: string }) {
    const [annual, setAnnual] = useState<FinancialPeriod[]>([])
    const [quarterly, setQuarterly] = useState<FinancialPeriod[]>([])
    const [problem, setProblem] = useState<string | null>(null)
    const [freq, setFreq] = useState<"annual" | "quarterly">("annual")

    useEffect(() => {
        let active = true
        financials(symbol)
            .then((data) => {
                if (!active) return
                setAnnual(data.annual)
                setQuarterly(data.quarterly)
                setProblem(data.status === "unavailable" ? data.reason ?? UNAVAILABLE : null)
            })
            // The request itself failing tells us just as little as the SEC
            // refusing, so it reads the same to the user.
            .catch(() => active && setProblem(UNAVAILABLE))
        return () => {
            active = false
        }
    }, [symbol])

    const periods = freq === "annual" ? annual : quarterly
    const max = useMemo(
        () => Math.max(1, ...periods.map((period) => Math.abs(period.revenue))),
        [periods]
    )

    if (annual.length === 0 && quarterly.length === 0) {
        if (!problem) return null
        return (
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-foreground">Financials</h2>
                <Notice tone="caution">
                    {problem} We&rsquo;d rather say that than show you an empty chart that looks like{" "}
                    {symbol} reports nothing.
                </Notice>
            </section>
        )
    }

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Financials</h2>
                <SegmentedControl
                    label="Statement frequency"
                    size="sm"
                    value={freq}
                    onChange={setFreq}
                    options={[
                        { value: "annual" as const, label: "Annual" },
                        { value: "quarterly" as const, label: "Quarterly" },
                    ]}
                />
            </div>

            <ul className="flex flex-col gap-2">
                {periods.map((period) => (
                    <li key={`${period.year}-${period.quarter ?? 0}`} className="flex items-center gap-3">
                        <span className="figure w-16 shrink-0 text-[11px] font-normal text-muted-foreground">
                            {period.quarter
                                ? `Q${period.quarter} '${String(period.year).slice(-2)}`
                                : period.year}
                        </span>
                        <span className="flex h-6 flex-1 items-center gap-1">
                            <span
                                className="h-2.5 rounded-sm bg-primary"
                                style={{ width: `${(Math.abs(period.revenue) / max) * 100}%` }}
                            />
                        </span>
                        <span className="figure w-20 shrink-0 text-right text-[11px] font-normal text-foreground">
                            {compactUSD(period.revenue)}
                        </span>
                        <span
                            className={cn(
                                "figure w-20 shrink-0 text-right text-[11px] font-normal",
                                period.netProfit >= 0 ? "text-positive" : "text-negative"
                            )}
                        >
                            {compactUSD(period.netProfit)}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
                Revenue and net profit as filed with the SEC. Bars are scaled to revenue.
            </p>
        </section>
    )
}

/**
 * Ten years of income statement, balance sheet and cash flow, from SEC filings.
 *
 * Same rule as the section above: absent because the company files nothing is a
 * fact and hides quietly; absent because the SEC wouldn't answer is a gap, and
 * gaps get said out loud.
 */
function StatementsSection({ symbol }: { symbol: string }) {
    const [data, setData] = useState<StatementsResponse | null>(null)
    const [problem, setProblem] = useState<string | null>(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        let active = true
        statements(symbol)
            .then((response) => {
                if (!active) return
                setData(response)
                setProblem(
                    response.status === "unavailable" ? response.reason ?? UNAVAILABLE : null
                )
            })
            .catch(() => active && setProblem(UNAVAILABLE))
        return () => {
            active = false
        }
    }, [symbol])

    if (!data || data.statements.length === 0 || data.years.length === 0) {
        if (!problem) return null
        return (
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-foreground">Financial statements</h2>
                <Notice tone="caution">{problem}</Notice>
            </section>
        )
    }

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Financial statements</h2>
                <button
                    type="button"
                    onClick={() => setOpen((shown) => !shown)}
                    className="text-xs font-semibold text-primary"
                >
                    {open ? "Hide" : "Show"}
                </button>
            </div>

            {open && (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full min-w-[560px] text-left text-xs">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="p-3 font-semibold text-muted-foreground">Line</th>
                                {data.years.map((year) => (
                                    <th key={String(year)} className="p-3 text-right font-semibold text-muted-foreground">
                                        {year}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.statements.map((statement) => (
                                <StatementRows key={statement.name} statement={statement} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">
                Straight from the company&rsquo;s own SEC filings (XBRL company facts). A blank cell means the
                filer didn&rsquo;t tag that line that year.
            </p>
        </section>
    )
}

function StatementRows({ statement }: { statement: StatementsResponse["statements"][number] }) {
    return (
        <>
            <tr className="border-b border-border bg-secondary/40">
                <td colSpan={99} className="p-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
                    {statement.name}
                </td>
            </tr>
            {statement.rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-b-0">
                    <td className="p-3 text-foreground">{row.label}</td>
                    {row.values.map((value, index) => (
                        <td key={index} className="figure p-3 text-right font-normal text-muted-foreground">
                            {value === null ? "—" : compactUSD(value)}
                        </td>
                    ))}
                </tr>
            ))}
        </>
    )
}

function compactUSD(value: number): string {
    const abs = Math.abs(value)
    const sign = value < 0 ? "−" : ""
    if (abs >= 1e12) return `${sign}$${fixed(abs / 1e12, 2)}T`
    if (abs >= 1e9) return `${sign}$${fixed(abs / 1e9, 2)}B`
    if (abs >= 1e6) return `${sign}$${fixed(abs / 1e6, 1)}M`
    if (abs >= 1e3) return `${sign}$${fixed(abs / 1e3, 1)}K`
    return `${sign}$${fixed(abs, 2)}`
}
