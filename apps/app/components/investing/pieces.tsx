"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import { CHART_PALETTE } from "@/lib/budget/category-style"
import { tickerLogoURL, type NewsArticle } from "@/lib/investing/market"

/**
 * Shared investing pieces: the company mark, a quote row, and the news list —
 * ported from CompanyLogoView.swift and NewsViews.swift.
 */

/**
 * A circular company mark keyed by ticker: Brandfetch's ticker CDN, falling
 * back to a monogram tinted per symbol. The monogram is a real state, not dead
 * code — the CDN is asked for a 404 on a miss precisely so an unknown ticker
 * lands here instead of showing a stranger's mark.
 */
export function CompanyLogo({
    symbol,
    size = 40,
    className,
}: {
    symbol: string
    size?: number
    className?: string
}) {
    const [failed, setFailed] = useState(false)
    useEffect(() => setFailed(false), [symbol])

    // Stable tint per symbol — summed scalars, so a symbol keeps its colour
    // across reloads.
    const ticker = symbol.toUpperCase()
    const code = [...ticker].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) & 0xffff, 0)
    const tint = CHART_PALETTE[code % CHART_PALETTE.length]
    const monogram = ticker.slice(0, ticker.length > 3 ? 1 : 2)

    if (failed) {
        return (
            <span
                className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
                style={{ width: size, height: size, backgroundColor: tint, fontSize: size * 0.36 }}
                aria-hidden="true"
            >
                {monogram}
            </span>
        )
    }

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={tickerLogoURL(symbol, size)}
            alt=""
            width={size}
            height={size}
            onError={() => setFailed(true)}
            className={cn("shrink-0 rounded-full bg-white object-contain", className)}
            style={{ width: size, height: size }}
        />
    )
}

/** One symbol row: mark, name, price and the day's move. */
export function QuoteRow({
    symbol,
    name,
    price,
    changePct,
    detail,
    href,
    trailing,
}: {
    symbol: string
    name?: string
    price?: number | null
    changePct?: number | null
    detail?: string
    href?: string
    trailing?: React.ReactNode
}) {
    const body = (
        <>
            <CompanyLogo symbol={symbol} size={40} />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{name || symbol}</span>
                <span className="truncate text-[11px] text-muted-foreground">{detail ?? symbol}</span>
            </span>
            {trailing ?? (
                <span className="flex shrink-0 flex-col items-end">
                    {/* Never a placeholder figure: an unquoted symbol shows a dash. */}
                    <span className="figure text-sm font-semibold text-foreground">
                        {typeof price === "number" ? `$${fixed(price, 2)}` : "—"}
                    </span>
                    <span
                        className={cn(
                            "figure text-xs",
                            typeof changePct !== "number"
                                ? "text-muted-foreground"
                                : changePct >= 0
                                  ? "text-positive"
                                  : "text-negative"
                        )}
                    >
                        {typeof changePct === "number"
                            ? `${changePct >= 0 ? "+" : "−"}${fixed(Math.abs(changePct), 2)}%`
                            : "—"}
                    </span>
                </span>
            )}
        </>
    )

    if (!href) {
        return <div className="flex items-center gap-3 px-4 py-3">{body}</div>
    }

    return (
        <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/60">
            {body}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
        </Link>
    )
}

export function NewsList({ articles, limit }: { articles: NewsArticle[]; limit?: number }) {
    const shown = limit ? articles.slice(0, limit) : articles
    if (shown.length === 0) return null

    return (
        <ul className="flex flex-col gap-2.5">
            {shown.map((article) => (
                <li key={article.id}>
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition hover:border-border-strong"
                    >
                        {article.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={article.image}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-md bg-secondary object-contain"
                            />
                        ) : (
                            <span className="h-10 w-10 shrink-0 rounded-md bg-secondary" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-sm font-semibold leading-snug text-foreground">
                                {article.headline}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                                {article.source}
                                {article.datetime ? ` · ${timeAgo(article.datetime)}` : ""}
                            </span>
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                    </a>
                </li>
            ))}
        </ul>
    )
}

function timeAgo(epochSeconds: number): string {
    const minutes = Math.round((Date.now() / 1000 - epochSeconds) / 60)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.round(hours / 24)}d ago`
}
