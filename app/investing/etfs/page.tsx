"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import { CURATED_ETFS } from "@/lib/investing/catalog"
import { marketStats, type MarketStat } from "@/lib/investing/market"
import { CompanyLogo } from "@/components/investing/pieces"

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
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <Link href="/investing" className="text-sm font-semibold text-primary">
                ← Investing
            </Link>

            <header className="flex flex-col gap-3">
                <span
                    className="inline-flex h-16 w-16 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: "#0B7285" }}
                >
                    <Layers className="h-7 w-7" />
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">ETFs &amp; Index Funds</h1>
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
        </div>
    )
}
