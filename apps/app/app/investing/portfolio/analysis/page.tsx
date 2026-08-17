"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { compactMoney, currency, fixed } from "@/lib/format"
import { chartColor } from "@/lib/budget/category-style"
import { marketStats } from "@/lib/investing/market"
import {
    accounts as fetchAccounts,
    orders as fetchOrders,
    type Order,
} from "@/lib/investing/snaptrade"
import {
    diversification,
    diversificationLabel,
    holdings,
    provisionalPositions,
    taxLots,
    type Holding,
} from "@/lib/investing/analytics"
import { Donut } from "@/components/budget/charts"
import { Notice, SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * Portfolio analysis — what the money is spread across, how concentrated it is,
 * and the cost-basis view built from executed orders. Ported from
 * PortfolioAnalyticsViews.swift.
 *
 * The app's sector, risk and dividend sections are absent here, and the page
 * says so: those need per-symbol fundamentals, and no provider on this backend
 * serves them since market data moved to Alpaca. Showing the sections filled
 * with guesses would be worse than not showing them.
 */
export default function PortfolioAnalysisPage() {
    const [rows, setRows] = useState<Holding[]>([])
    const [orderRows, setOrderRows] = useState<Order[]>([])
    const [state, setState] = useState<"loading" | "ready" | "empty">("loading")

    useEffect(() => {
        let active = true
        ;(async () => {
            try {
                const response = await fetchAccounts()
                if (response.accounts.length === 0) {
                    if (active) setState("empty")
                    return
                }
                const orderResponses = await Promise.all(
                    response.accounts.map((account) =>
                        fetchOrders(account.id).catch(() => ({ orders: [] as Order[] }))
                    )
                )
                const allOrders = orderResponses.flatMap((entry) => entry.orders)

                const positions = [
                    ...response.positions,
                    ...provisionalPositions(allOrders, response.positions.map((p) => p.symbol)),
                ]
                const unpriced = positions
                    .filter((p) => p.marketValue === null && p.price === null)
                    .map((p) => p.symbol.toUpperCase())
                let prices: Record<string, number> = {}
                if (unpriced.length > 0) {
                    const stats = await marketStats([...new Set(unpriced)].slice(0, 6)).catch(() => ({
                        stats: [],
                    }))
                    prices = Object.fromEntries(
                        stats.stats.map((stat) => [stat.symbol.toUpperCase(), stat.price])
                    )
                }

                if (!active) return
                const computed = holdings(positions, prices)
                setRows(computed)
                setOrderRows(allOrders)
                setState(computed.length > 0 ? "ready" : "empty")
            } catch {
                if (active) setState("empty")
            }
        })()
        return () => {
            active = false
        }
    }, [])

    const spread = diversification(rows)
    const lots = taxLots(rows, orderRows)
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
    const totalUnrealized = lots.reduce((sum, lot) => sum + lot.unrealized, 0)

    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/investing" className="text-muted-foreground hover:text-foreground">
                            Investing
                        </Link>
                        <span className="text-border-strong">/</span>
                        Portfolio analysis
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-5xl flex-col gap-5">
            <header className="flex flex-col gap-1">
                <Link href="/investing/portfolio" className="text-sm font-semibold text-primary">
                    ← Portfolio
                </Link>
                <p className="text-sm text-muted-foreground">
                    Where the money sits, and how much of it rides on one name.
                </p>
            </header>

            {state === "loading" && <div className="h-48 animate-pulse rounded-card bg-card" />}

            {state === "empty" && (
                <Notice tone="info">
                    Nothing to analyse yet.{" "}
                    <Link href="/investing/portfolio" className="font-semibold text-primary">
                        Connect a brokerage
                    </Link>{" "}
                    and this fills in from your own holdings.
                </Notice>
            )}

            {state === "ready" && (
                <>
                    <section className="flex items-center gap-4 rounded-card border-[1.5px] border-border bg-card p-5">
                        <Donut
                            slices={rows.slice(0, 8).map((row) => ({ name: row.symbol, value: row.value }))}
                            size={104}
                            centerLabel={compactMoney(totalValue)}
                            centerTone="ink"
                        />
                        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                            {rows.slice(0, 6).map((row, index) => (
                                <li key={row.symbol} className="flex items-center gap-2">
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-sm"
                                        style={{ backgroundColor: chartColor(index) }}
                                    />
                                    <span className="truncate text-xs font-semibold text-foreground">
                                        {row.symbol}
                                    </span>
                                    <span className="figure ml-auto text-[11px] font-normal text-muted-foreground">
                                        {fixed(row.weight * 100, 1)}%
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {spread && (
                        <section className="flex flex-col gap-2 rounded-card border-[1.5px] border-border bg-card p-5">
                            <div className="flex items-baseline gap-2">
                                <p className="figure text-3xl font-bold text-foreground">{spread.score}</p>
                                <p className="text-sm font-semibold text-foreground">
                                    {diversificationLabel(spread.score)}
                                </p>
                            </div>
                            <p className="text-[13px] text-muted-foreground">
                                {spread.holdingCount} holdings, but the spread is worth about{" "}
                                <span className="figure">{fixed(spread.effectiveHoldings, 1)}</span> equally
                                sized ones. {spread.topSymbol} alone is{" "}
                                <span className="figure">{fixed(spread.topWeight * 100, 1)}%</span>, and the
                                top three are{" "}
                                <span className="figure">{fixed(spread.topThreeWeight * 100, 1)}%</span>.
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                Scored on how evenly the money sits across holdings. The app also weighs
                                sector spread; that needs per-symbol sector data this backend no longer has,
                                and docking the score for data we couldn&rsquo;t fetch would be worse than
                                leaving it out.
                            </p>
                        </section>
                    )}

                    {lots.length > 0 && (
                        <section className="flex flex-col gap-2.5">
                            <SectionLabel>Cost basis</SectionLabel>
                            <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                                {lots.map((lot, index) => (
                                    <li
                                        key={lot.symbol}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3",
                                            index > 0 && "border-t border-border"
                                        )}
                                    >
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="text-sm font-semibold text-foreground">
                                                {lot.symbol}
                                            </span>
                                            <span className="figure text-[11px] font-normal text-muted-foreground">
                                                cost {currency(lot.costBasis, 2)} · now{" "}
                                                {currency(lot.marketValue, 2)} ·{" "}
                                                {lot.longTerm ? "held over a year" : "under a year"}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                "figure shrink-0 text-sm font-semibold",
                                                lot.unrealized >= 0 ? "text-positive" : "text-negative"
                                            )}
                                        >
                                            {lot.unrealized >= 0 ? "+" : "−"}
                                            {currency(Math.abs(lot.unrealized), 2)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="figure text-sm font-semibold text-foreground">
                                Unrealized total: {totalUnrealized >= 0 ? "+" : "−"}
                                {currency(Math.abs(totalUnrealized), 2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                Built from the buys your connected orders prove, so it covers what was bought
                                through a connected account and nothing transferred in. It is arithmetic, not
                                tax advice, and says nothing about what any gain would be taxed at.
                            </p>
                        </section>
                    )}

                    <Notice tone="info">
                        Sector mix, dividend income and portfolio beta are in the iOS app. They need
                        per-symbol fundamentals, which this backend stopped carrying when market data moved to
                        Alpaca — so they&rsquo;re left out here rather than estimated.
                    </Notice>
                </>
            )}
            </PageBody>
        </>
    )
}
