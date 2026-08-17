"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import { CURATED_ETFS } from "@/lib/investing/catalog"
import { marketStats, type MarketStat } from "@/lib/investing/market"
import { CompanyLogo } from "@/components/investing/pieces"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * Curated ETFs and index funds — an on-ramp, not a catalog of the universe.
 * Every row opens the same stock detail page, since quotes, bars and news
 * already work for ETF tickers. Ported from ETFListView.swift.
 */
export default function ETFsPage() {
    const [stats, setStats] = useState<Record<string, MarketStat>>({})

    useEffect(() => {
        let active = true
        const symbols = CURATED_ETFS.map((etf) => etf.symbol)
        const chunks: string[][] = []
        for (let i = 0; i < symbols.length; i += 6) chunks.push(symbols.slice(i, i + 6))
        Promise.all(chunks.map((chunk) => marketStats(chunk).catch(() => ({ stats: [] }))))
            .then((responses) => {
                if (!active) return
                const merged: Record<string, MarketStat> = {}
                for (const response of responses) {
                    for (const stat of response.stats) merged[stat.symbol.toUpperCase()] = stat
                }
                setStats(merged)
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/investing" className="text-muted-foreground hover:text-foreground">
                            Investing
                        </Link>
                        <span className="text-border-strong">/</span>
                        ETFs & Index Funds
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-5xl flex-col gap-5">

            <header className="flex flex-col gap-3">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-pill bg-foreground text-background">
                    <Layers className="h-7 w-7" />
                </span>
                <p className="text-base text-muted-foreground">
                    One purchase, hundreds of companies. The simplest way to own the whole market.
                </p>
            </header>

            <ul className="flex flex-col gap-3">
                {CURATED_ETFS.map((etf) => {
                    const stat = stats[etf.symbol]
                    const up = (stat?.changePct ?? 0) >= 0
                    return (
                        <li key={etf.symbol}>
                            <Link
                                href={`/investing/stocks/${etf.symbol}`}
                                className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition hover:border-border-strong"
                            >
                                <CompanyLogo symbol={etf.symbol} size={44} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-base font-semibold text-foreground">
                                        {etf.name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {etf.symbol} · {etf.blurb}
                                    </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end">
                                    <span className="figure text-base font-semibold text-foreground">
                                        {stat ? `$${fixed(stat.price, 2)}` : "—"}
                                    </span>
                                    <span
                                        className={cn(
                                            "figure text-sm font-semibold",
                                            stat ? (up ? "text-positive" : "text-negative") : "text-muted-foreground"
                                        )}
                                    >
                                        {stat ? `${up ? "+" : "−"}${fixed(Math.abs(stat.changePct), 2)}%` : "—"}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
            </PageBody>
        </>
    )
}
