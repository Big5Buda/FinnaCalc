"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed, int } from "@/lib/format"
import { screener, type ScreenerRow } from "@/lib/investing/market"
import { CompanyLogo } from "@/components/investing/pieces"
import { Button, Notice } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * The screener, ported from DashboardScreenerView.swift and narrowed to what
 * the data can honestly support.
 *
 * Alpaca screens by activity, not fundamentals: the universe is the day's
 * most-active symbols, and the filters are the ones derivable from a snapshot.
 * Market cap, beta, dividend yield and sector filters went with the
 * fundamentals vendors — the page says so rather than showing controls that
 * quietly do nothing.
 */
export default function ScreenerPage() {
    const [rows, setRows] = useState<ScreenerRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [priceMin, setPriceMin] = useState("")
    const [priceMax, setPriceMax] = useState("")
    const [changeMin, setChangeMin] = useState("")
    const [volumeMin, setVolumeMin] = useState("")

    const run = useCallback(async () => {
        setLoading(true)
        setError(null)
        const query: Record<string, string> = { limit: "50" }
        if (priceMin.trim()) query.priceMoreThan = priceMin.trim()
        if (priceMax.trim()) query.priceLowerThan = priceMax.trim()
        if (changeMin.trim()) query.changeMoreThan = changeMin.trim()
        if (volumeMin.trim()) query.volumeMoreThan = volumeMin.trim()
        try {
            const data = await screener(query)
            setRows(data.rows)
            if (data.error) setError(data.error)
        } catch (err) {
            setError(err instanceof Error ? err.message : "The screener didn't run.")
            setRows([])
        }
        setLoading(false)
    }, [priceMin, priceMax, changeMin, volumeMin])

    useEffect(() => {
        void run()
        // Only on mount: after that the user runs it deliberately.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                        Screener
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-6xl flex-col gap-5">
            <header className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                    The day&rsquo;s most-active stocks, filtered on price, move and volume.
                </p>
            </header>

            <section className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
                <Field label="Price min" value={priceMin} onChange={setPriceMin} />
                <Field label="Price max" value={priceMax} onChange={setPriceMax} />
                <Field label="Change % min" value={changeMin} onChange={setChangeMin} />
                <Field label="Volume min" value={volumeMin} onChange={setVolumeMin} />
                <div className="col-span-2 flex gap-2 sm:col-span-4">
                    <Button onClick={() => void run()} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Run screen
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setPriceMin("")
                            setPriceMax("")
                            setChangeMin("")
                            setVolumeMin("")
                        }}
                    >
                        Clear
                    </Button>
                </div>
            </section>

            {error && <Notice tone="error">{error}</Notice>}

            <Notice tone="info">
                Market cap, beta, dividend and sector filters need a fundamentals source, which this backend no
                longer has. They&rsquo;re left out rather than shown as controls that do nothing.
            </Notice>

            {loading ? (
                <div className="h-40 animate-pulse rounded-xl bg-card" />
            ) : rows.length === 0 ? (
                <Notice tone="info">No stocks matched. Widen the filters and run it again.</Notice>
            ) : (
                <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                    {rows.map((row, index) => (
                        <li key={row.symbol} className={cn(index > 0 && "border-t border-border")}>
                            <Link
                                href={`/investing/stocks/${row.symbol}`}
                                className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/60"
                            >
                                <CompanyLogo symbol={row.symbol} size={36} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-semibold text-foreground">
                                        {row.company}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {row.symbol}
                                        {row.exchange ? ` · ${row.exchange}` : ""}
                                        {row.volume ? ` · ${int(row.volume)} shares` : ""}
                                    </span>
                                </span>
                                <span className="figure shrink-0 text-sm font-semibold text-foreground">
                                    ${fixed(row.price, 2)}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            </PageBody>
        </>
    )
}

function Field({
    label,
    value,
    onChange,
}: {
    label: string
    value: string
    onChange: (value: string) => void
}) {
    return (
        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
            {label}
            <input
                value={value}
                onChange={(event) => onChange(event.target.value.replace(/[^0-9.-]/g, ""))}
                inputMode="decimal"
                placeholder="—"
                className="figure h-9 rounded-md border border-input bg-background px-2.5 text-sm font-normal text-foreground  focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            />
        </label>
    )
}
