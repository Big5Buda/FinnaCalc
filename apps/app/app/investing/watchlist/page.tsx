"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import { marketStats, sparklines, type MarketStat } from "@/lib/investing/market"
import { useWatchlist, DEFAULT_WATCHLIST } from "@/components/providers/watchlist-provider"
import { CompanyLogo } from "@/components/investing/pieces"
import { Button, Notice } from "@/components/ui/primitives"

/**
 * The watchlist — symbols the user follows, with a live quote and a sparkline
 * each. Ported from DashboardWatchlistView.swift; the list lives in
 * localStorage under the app's own key, so it stays on the device.
 */
export default function WatchlistPage() {
    const watchlist = useWatchlist()
    const [stats, setStats] = useState<Record<string, MarketStat>>({})
    const [series, setSeries] = useState<Record<string, number[]>>({})
    const [adding, setAdding] = useState("")

    const symbols = watchlist.symbols

    useEffect(() => {
        if (!watchlist.ready || symbols.length === 0) return
        let active = true
        // market-stats caps at six symbols per call, so a long list is chunked.
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
        sparklines(symbols)
            .then((data) => active && setSeries(data.sparklines ?? {}))
            .catch(() => {})
        return () => {
            active = false
        }
    }, [symbols, watchlist.ready])

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href="/investing" className="text-sm font-semibold text-primary">
                    ← Investing
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Watchlist</h1>
                <p className="text-sm text-muted-foreground">
                    {watchlist.saved === null
                        ? "A starter list until you save your own. Add or remove anything."
                        : `${symbols.length} symbol${symbols.length === 1 ? "" : "s"}, kept on this device.`}
                </p>
            </header>

            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    const symbol = adding.trim().toUpperCase()
                    if (!symbol) return
                    watchlist.add(symbol)
                    setAdding("")
                }}
            >
                <input
                    value={adding}
                    onChange={(event) => setAdding(event.target.value.toUpperCase())}
                    placeholder="Add a symbol"
                    aria-label="Add a symbol to your watchlist"
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                />
                <Button type="submit" disabled={adding.trim() === ""}>
                    <Plus className="h-4 w-4" />
                    Add
                </Button>
            </form>

            {symbols.length === 0 ? (
                <Notice tone="info">
                    Your watchlist is empty. Add a symbol above, or open any stock and use the bookmark.
                </Notice>
            ) : (
                <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                    {symbols.map((symbol, index) => {
                        const stat = stats[symbol.toUpperCase()]
                        const closes = series[symbol.toUpperCase()] ?? []
                        const up = (stat?.changePct ?? 0) >= 0
                        return (
                            <li
                                key={symbol}
                                className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border")}
                            >
                                <CompanyLogo symbol={symbol} size={36} />
                                <Link
                                    href={`/investing/stocks/${symbol}`}
                                    className="flex min-w-0 flex-1 flex-col"
                                >
                                    <span className="truncate text-sm font-semibold text-foreground">
                                        {stat?.name || symbol}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{symbol}</span>
                                </Link>

                                {closes.length > 1 && <Sparkline closes={closes} isUp={up} />}

                                <span className="flex shrink-0 flex-col items-end">
                                    <span className="figure text-sm font-semibold text-foreground">
                                        {stat ? `$${fixed(stat.price, 2)}` : "—"}
                                    </span>
                                    <span
                                        className={cn(
                                            "figure text-xs",
                                            stat ? (up ? "text-positive" : "text-negative") : "text-muted-foreground"
                                        )}
                                    >
                                        {stat ? `${up ? "+" : "−"}${fixed(Math.abs(stat.changePct), 2)}%` : "—"}
                                    </span>
                                </span>

                                <button
                                    type="button"
                                    onClick={() => watchlist.remove(symbol)}
                                    aria-label={`Remove ${symbol} from your watchlist`}
                                    className="text-muted-foreground transition hover:text-destructive"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}

            {watchlist.saved !== null && watchlist.saved.length === 0 && (
                <Button
                    variant="ghost"
                    className="self-start"
                    onClick={() => DEFAULT_WATCHLIST.forEach((symbol) => watchlist.add(symbol))}
                >
                    Restore the starter list
                </Button>
            )}
        </div>
    )
}

function Sparkline({ closes, isUp }: { closes: number[]; isUp: boolean }) {
    const width = 80
    const height = 28
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const span = max - min || 1
    const points = closes
        .map((close, index) => {
            const x = (index / (closes.length - 1)) * width
            const y = height - ((close - min) / span) * height
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(" ")

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="hidden h-7 w-20 shrink-0 sm:block" aria-hidden="true">
            <polyline
                points={points}
                fill="none"
                stroke={isUp ? "rgb(var(--positive))" : "rgb(var(--negative))"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}
