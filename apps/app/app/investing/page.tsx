"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import * as Icons from "lucide-react"
import { ChevronRight, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import {
    marketNews,
    marketOverview,
    marketStats,
    searchSymbols,
    type MarketOverview,
    type MarketStat,
    type NewsArticle,
    type SearchResult,
} from "@/lib/investing/market"
import { MARKET_INDEX_ETFS, SECTORS } from "@/lib/investing/catalog"
import { CompanyLogo, NewsList } from "@/components/investing/pieces"
import { SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * Investing — the Discover landing, ported from StocksDiscoverView.swift: a
 * universal symbol search, highlight cards (Market / Most Active / Gainers /
 * Losers), news, and the category tiles, plus the research entry points the
 * app's tab lists.
 */
export default function InvestingPage() {
    const [overview, setOverview] = useState<MarketOverview | null>(null)
    const [indexStats, setIndexStats] = useState<MarketStat[]>([])
    const [news, setNews] = useState<NewsArticle[]>([])
    const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")

    useEffect(() => {
        let active = true
        marketOverview()
            .then((data) => {
                if (!active) return
                setOverview(data)
                setStatus("ready")
            })
            .catch(() => active && setStatus("failed"))
        marketStats(MARKET_INDEX_ETFS.map((entry) => entry.symbol))
            .then((data) => active && setIndexStats(data.stats))
            .catch(() => {})
        marketNews()
            .then((data) => active && setNews(data.articles))
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    const cards = useMemo(() => {
        const statBySymbol = new Map(indexStats.map((stat) => [stat.symbol.toUpperCase(), stat]))
        const market = MARKET_INDEX_ETFS.flatMap((entry) => {
            const stat = statBySymbol.get(entry.symbol)
            return stat
                ? [{ symbol: entry.symbol, name: entry.name, changePct: stat.changePct, badge: entry.badge, color: entry.color }]
                : []
        })
        const rows = (quotes: MarketOverview["gainers"] | undefined) =>
            (quotes ?? []).slice(0, 3).map((quote) => ({
                symbol: quote.symbol,
                name: quote.name,
                changePct: quote.changesPercentage,
                badge: undefined as string | undefined,
                color: undefined as string | undefined,
            }))

        return [
            {
                title: "Market",
                blurb: "How the whole market is doing today, through the big index ETFs.",
                rows: market,
            },
            {
                title: "Most Active",
                blurb: "The most-traded stocks on the market right now.",
                rows: rows(overview?.mostActive),
            },
            {
                title: "Biggest Gainers",
                blurb: "These companies gained the most value today.",
                rows: rows(overview?.gainers),
            },
            {
                title: "Biggest Losers",
                blurb: "These companies lost the most value today.",
                rows: rows(overview?.losers),
            },
        ].filter((card) => card.rows.length > 0)
    }, [overview, indexStats])

    return (
        <>
            <PageBar title="Investing" />
            <PageBody className="flex w-full max-w-6xl flex-col gap-6">
                <div className="contents">

            <SymbolSearch />

            <nav className="flex flex-wrap gap-2">
                {[
                    { href: "/investing/portfolio", label: "Portfolio" },
                    { href: "/investing/watchlist", label: "Watchlist" },
                    { href: "/investing/goals", label: "Goals" },
                    { href: "/investing/tracker", label: "Trade Tracker" },
                    { href: "/investing/screener", label: "Screener" },
                    { href: "/investing/etfs", label: "ETFs & index funds" },
                    { href: "/investing/safe-investments", label: "Safe investments" },
                    { href: "/investing/bonds", label: "Bonds" },
                ].map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>

            {status === "failed" && (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    Market data isn&rsquo;t available right now. Nothing here is cached from an earlier session,
                    so rather than show stale figures the page waits for a live one.
                </p>
            )}

            {status === "loading" && (
                <div className="h-40 animate-pulse rounded-card border border-border bg-card" />
            )}

            {cards.length > 0 && (
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
                    {cards.map((card) => (
                        <section
                            key={card.title}
                            className="paper-card w-[85%] shrink-0 snap-start rounded-card p-[18px] sm:w-[70%]"
                        >
                            <h2 className="text-xl font-bold text-foreground">{card.title}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{card.blurb}</p>
                            <ul className="mt-4 flex flex-col gap-3.5">
                                {card.rows.map((row) => (
                                    <li key={row.symbol}>
                                        <Link
                                            href={`/investing/stocks/${row.symbol}`}
                                            className="flex items-center gap-3"
                                        >
                                            {row.badge ? (
                                                <span
                                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                                    style={{ backgroundColor: row.color }}
                                                >
                                                    {row.badge}
                                                </span>
                                            ) : (
                                                <CompanyLogo symbol={row.symbol} size={40} />
                                            )}
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="truncate text-sm font-semibold text-foreground">
                                                    {row.name}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {row.symbol}
                                                </span>
                                            </span>
                                            <span
                                                className={cn(
                                                    "figure text-sm font-semibold",
                                                    row.changePct >= 0 ? "text-positive" : "text-negative"
                                                )}
                                            >
                                                {row.changePct >= 0 ? "+" : "−"}
                                                {fixed(Math.abs(row.changePct), 2)}%
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {news.length > 0 && (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>News</SectionLabel>
                    <NewsList articles={news} limit={6} />
                </section>
            )}

            <section className="flex flex-col gap-2.5">
                <SectionLabel>Categories</SectionLabel>
                <div className="grid grid-cols-2 gap-2.5">
                    {SECTORS.map((sector) => {
                        const Icon =
                            (Icons as unknown as Record<string, Icons.LucideIcon>)[sector.icon] ?? Icons.Boxes
                        const summary = overview?.sectorSummary.find((entry) => entry.id === sector.id)
                        return (
                            <Link
                                key={sector.id}
                                href={`/investing/sectors/${sector.id}`}
                                className="flex flex-col gap-2 rounded-xl p-4 text-white transition hover:brightness-105"
                                style={{ backgroundColor: sector.color }}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="text-sm font-bold">{sector.name}</span>
                                <span className="figure text-[11px] font-normal text-white/85">
                                    {summary && summary.stockCount > 0
                                        ? `${summary.avgChange >= 0 ? "+" : "−"}${fixed(
                                              Math.abs(summary.avgChange),
                                              2
                                          )}% avg today`
                                        : "—"}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </section>
                </div>
            </PageBody>
        </>
    )
}

/** Universal search with a debounced typeahead, as on the app's tab. */
function SymbolSearch() {
    const [term, setTerm] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const trimmed = term.trim()
        if (timer.current) clearTimeout(timer.current)
        if (trimmed.length < 2) {
            setResults([])
            setSearching(false)
            return
        }
        setSearching(true)
        timer.current = setTimeout(() => {
            searchSymbols(trimmed)
                .then((rows) => {
                    setResults(rows)
                    setSearching(false)
                })
                .catch(() => {
                    setResults([])
                    setSearching(false)
                })
        }, 250)
        return () => {
            if (timer.current) clearTimeout(timer.current)
        }
    }, [term])

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                    value={term}
                    onChange={(event) => setTerm(event.target.value.toUpperCase())}
                    placeholder="Search stocks"
                    aria-label="Search stocks"
                    className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                />
                {term !== "" && (
                    <button type="button" onClick={() => setTerm("")} aria-label="Clear search">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}
            </div>

            {searching && <p className="px-1 text-sm text-muted-foreground">Searching…</p>}

            {!searching && results.length > 0 && (
                <ul className="overflow-hidden rounded-lg border border-border bg-card">
                    {results.slice(0, 8).map((result) => (
                        <li key={result["1. symbol"]} className="border-t border-border first:border-t-0">
                            <Link
                                href={`/investing/stocks/${result["1. symbol"]}`}
                                className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-secondary/60"
                            >
                                <CompanyLogo symbol={result["1. symbol"]} size={32} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-sm font-bold text-foreground">
                                        {result["1. symbol"]}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {result["2. name"]}
                                    </span>
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {!searching && term.trim().length >= 2 && results.length === 0 && (
                <p className="px-1 text-sm text-muted-foreground">No results found.</p>
            )}
        </div>
    )
}
