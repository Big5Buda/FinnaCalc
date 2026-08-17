"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import * as Icons from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import { sectorById } from "@/lib/investing/catalog"
import { marketOverview, type MarketOverview } from "@/lib/investing/market"
import { CompanyLogo } from "@/components/investing/pieces"

/**
 * One sector's page — the market-overview universe filtered to that sector,
 * ported from CategoryPageView.swift. Same source as the Discover tiles, so the
 * average on the tile and the rows here can't disagree.
 */
export default function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
    const { sector: sectorId } = use(params)
    const meta = sectorById(sectorId)
    const [overview, setOverview] = useState<MarketOverview | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let active = true
        marketOverview()
            .then((data) => active && setOverview(data))
            .catch(() => active && setFailed(true))
        return () => {
            active = false
        }
    }, [])

    if (!meta) {
        return (
            <div className="w-full max-w-6xl px-6 py-10 lg:px-10">
                <p className="text-sm text-muted-foreground">No such sector.</p>
                <Link href="/investing" className="mt-3 inline-block text-sm font-semibold text-primary">
                    ← Investing
                </Link>
            </div>
        )
    }

    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? Icons.Boxes
    const stocks = (overview?.stocks ?? [])
        .filter((quote) => quote.sector === meta.name)
        .sort((a, b) => b.changesPercentage - a.changesPercentage)
    const summary = overview?.sectorSummary.find((entry) => entry.id === meta.id)

    return (
        <div className="flex w-full max-w-6xl flex-col gap-5 px-6 py-6 lg:px-10">
            <Link href="/investing" className="text-sm font-semibold text-primary">
                ← Investing
            </Link>

            <header className="flex flex-col gap-3">
                <span
                    className="inline-flex h-16 w-16 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: meta.color }}
                >
                    <Icon className="h-7 w-7" />
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{meta.name}</h1>
                <p className="text-base text-muted-foreground">{meta.blurb}</p>
                {summary && summary.stockCount > 0 && (
                    <p
                        className={cn(
                            "figure text-sm font-semibold",
                            summary.avgChange >= 0 ? "text-positive" : "text-negative"
                        )}
                    >
                        {summary.avgChange >= 0 ? "+" : "−"}
                        {fixed(Math.abs(summary.avgChange), 2)}% average across {summary.stockCount} tracked
                        companies today
                    </p>
                )}
            </header>

            {failed && (
                <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    Market data isn&rsquo;t available right now.
                </p>
            )}

            {!failed && stocks.length === 0 && (
                <div className="h-40 animate-pulse rounded-xl bg-card" />
            )}

            {stocks.length > 0 && (
                <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                    {stocks.map((quote, index) => (
                        <li key={quote.symbol} className={cn(index > 0 && "border-t border-border")}>
                            <Link
                                href={`/investing/stocks/${quote.symbol}`}
                                className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/60"
                            >
                                <CompanyLogo symbol={quote.symbol} size={36} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-semibold text-foreground">
                                        {quote.name}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{quote.symbol}</span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end">
                                    <span className="figure text-sm font-semibold text-foreground">
                                        ${fixed(quote.price, 2)}
                                    </span>
                                    <span
                                        className={cn(
                                            "figure text-xs",
                                            quote.changesPercentage >= 0 ? "text-positive" : "text-negative"
                                        )}
                                    >
                                        {quote.changesPercentage >= 0 ? "+" : "−"}
                                        {fixed(Math.abs(quote.changesPercentage), 2)}%
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
