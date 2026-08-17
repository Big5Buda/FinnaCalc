"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { compactMoney, currency, fixed, int } from "@/lib/format"
import { apiGet } from "@/lib/api-client"
import { personById } from "@/lib/investing/tracker"
import { CompanyLogo } from "@/components/investing/pieces"
import { Notice, SectionLabel } from "@/components/ui/primitives"

/**
 * One tracked person: their real filings, read at request time.
 *
 * Insiders file Form 4 (each transaction, within two business days), investors
 * file 13F (a whole portfolio, quarterly, up to 45 days after the quarter
 * ends), and House members file disclosures whose PDFs the clerk publishes.
 * Nobody's page invents a figure: without a verified filer number it says so.
 */

type InsiderTrade = {
    date: string
    filedAt: string
    symbol: string | null
    issuerName: string | null
    role: string | null
    label: string
    acquired: boolean
    shares: number
    price: number | null
    value: number | null
    url: string
}

type FundHolding = { symbol: string | null; name: string; value: number; shares: number; weight: number }

type Filing = {
    name: string
    district: string | null
    typeLabel: string
    isTradeReport: boolean
    filedAt: string
    url: string
}

/**
 * Every filing route now says whether an empty list means "nothing on file" or
 * "we couldn't read the record" (see lib/sec.ts). The difference matters more
 * here than anywhere else in the app: an empty list under someone's name reads
 * as a claim about that person's conduct, and we're only entitled to make it
 * when the source actually answered.
 */
type SourceReport = { status?: "ok" | "no-data" | "unavailable"; reason?: string | null }

const UNREADABLE = "The filing record couldn't be read right now."

/** The sentence to show above a list, or null when there's nothing to flag. */
function caveat(report: SourceReport | null): string | null {
    if (!report) return UNREADABLE
    if (report.status === "unavailable") return report.reason ?? UNREADABLE
    // "ok" with a reason is a partial read — some of the record loaded, some
    // didn't — and the list is shown with the gap named above it.
    if (report.status === "ok" && report.reason) return report.reason
    return null
}

export default function TrackedPersonPage({ params }: { params: Promise<{ person: string }> }) {
    const { person: personId } = use(params)
    const person = personById(personId)

    const [trades, setTrades] = useState<InsiderTrade[] | null>(null)
    const [holdings, setHoldings] = useState<{ holdings: FundHolding[]; reportDate: string | null; total: number } | null>(null)
    const [filings, setFilings] = useState<Filing[] | null>(null)
    /** Null while loading, then whatever the route said about its own answer. */
    const [report, setReport] = useState<SourceReport | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!person) return
        let active = true
        ;(async () => {
            try {
                if (person.category === "insiders" && person.cik) {
                    const data = await apiGet<SourceReport & { trades: InsiderTrade[] }>(
                        "/api/insider-trades",
                        { cik: person.cik }
                    )
                    if (active) {
                        setTrades(data.trades)
                        setReport(data)
                    }
                } else if (person.category === "investors" && person.cik) {
                    const data = await apiGet<
                        SourceReport & {
                            holdings: FundHolding[]
                            reportDate: string | null
                            total: number
                        }
                    >("/api/fund-holdings", { cik: person.cik })
                    if (active) {
                        setHoldings(data)
                        setReport(data)
                    }
                } else if (person.category === "politicians") {
                    const [first, ...rest] = person.name.split(" ")
                    const data = await apiGet<SourceReport & { filings: Filing[] }>(
                        "/api/congress-filings",
                        { last: rest[rest.length - 1] ?? person.name, first }
                    )
                    if (active) {
                        setFilings(data.filings)
                        setReport(data)
                    }
                }
            } catch {
                // The request itself failed, so we know nothing. The section
                // still renders — with an empty payload and `report` left null,
                // which `caveat` reads as "couldn't be read". Rendering nothing
                // at all would be the same silent gap in a different place.
                if (!active) return
                if (person.category === "insiders") setTrades([])
                else if (person.category === "investors")
                    setHoldings({ holdings: [], reportDate: null, total: 0 })
                else if (person.category === "politicians") setFilings([])
            }
            if (active) setLoading(false)
        })()
        return () => {
            active = false
        }
    }, [person])

    if (!person) {
        return (
            <div className="w-full max-w-4xl px-6 py-10 lg:px-10">
                <p className="text-sm text-muted-foreground">No such person in the tracker.</p>
                <Link href="/investing/tracker" className="mt-3 inline-block text-sm font-semibold text-primary">
                    ← Trade Tracker
                </Link>
            </div>
        )
    }

    const initials = person.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")

    return (
        <div className="flex w-full max-w-4xl flex-col gap-5 px-6 py-6 lg:px-10">
            <Link href="/investing/tracker" className="text-sm font-semibold text-primary">
                ← Trade Tracker
            </Link>

            <header className="flex items-start gap-4">
                <span
                    aria-hidden="true"
                    className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-bold text-foreground"
                >
                    {person.emojiBadge || initials}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{person.name}</h1>
                    <p className="text-sm font-semibold text-muted-foreground">{person.org}</p>
                    <p className="text-sm text-muted-foreground">{person.blurb}</p>
                </div>
            </header>

            {loading && <div className="h-32 animate-pulse rounded-card bg-card" />}

            {!loading && !person.cik && person.category !== "politicians" && (
                <Notice tone="info">
                    We don&rsquo;t have a verified SEC filer number for {person.name}, so there&rsquo;s no feed
                    to read. An empty list here would look like &ldquo;never trades&rdquo;, which isn&rsquo;t
                    what we know.
                </Notice>
            )}

            {trades && (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>Form 4 filings</SectionLabel>
                    {/* A gap in the record is named above the list, so a short
                        list is never mistaken for a complete one. */}
                    {caveat(report) && <Notice tone="caution">{caveat(report)}</Notice>}
                    {trades.length === 0 && !caveat(report) ? (
                        <Notice tone="info">No Form 4 transactions on file recently.</Notice>
                    ) : trades.length === 0 ? null : (
                        <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                            {trades.slice(0, 25).map((trade, index) => (
                                <li
                                    key={`${trade.url}-${index}`}
                                    className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border")}
                                >
                                    {trade.symbol && <CompanyLogo symbol={trade.symbol} size={32} />}
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {trade.label} {trade.symbol ?? trade.issuerName ?? ""}
                                        </span>
                                        <span className="figure text-[11px] font-normal text-muted-foreground">
                                            {int(trade.shares)} shares
                                            {trade.price ? ` at ${currency(trade.price, 2)}` : " · no price (grant)"} ·{" "}
                                            {trade.date}
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        <span
                                            className={cn(
                                                "figure text-sm font-semibold",
                                                trade.acquired ? "text-positive" : "text-negative"
                                            )}
                                        >
                                            {trade.value !== null ? compactMoney(trade.value) : "—"}
                                        </span>
                                        <a href={trade.url} target="_blank" rel="noopener noreferrer" aria-label="Open the filing">
                                            <ArrowUpRight className="h-3.5 w-3.5 text-border-strong" />
                                        </a>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                        Straight from SEC Form 4. A grant has no price, so it shows a dash rather than $0.
                    </p>
                </section>
            )}

            {holdings && (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>13F holdings</SectionLabel>
                    {caveat(report) && <Notice tone="caution">{caveat(report)}</Notice>}
                    {holdings.holdings.length === 0 && !caveat(report) ? (
                        <Notice tone="info">No recent 13F on file.</Notice>
                    ) : holdings.holdings.length === 0 ? null : (
                        <>
                            <p className="figure text-sm font-semibold text-foreground">
                                {compactMoney(holdings.total)} reported
                                {holdings.reportDate ? ` as of ${holdings.reportDate}` : ""}
                            </p>
                            <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                                {holdings.holdings.slice(0, 25).map((holding, index) => (
                                    <li
                                        key={`${holding.name}-${index}`}
                                        className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border")}
                                    >
                                        {holding.symbol && <CompanyLogo symbol={holding.symbol} size={32} />}
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-sm font-semibold text-foreground">
                                                {holding.name}
                                            </span>
                                            <span className="figure text-[11px] font-normal text-muted-foreground">
                                                {int(holding.shares)} shares · {fixed(holding.weight * 100, 1)}%
                                            </span>
                                        </span>
                                        <span className="figure shrink-0 text-sm font-semibold text-foreground">
                                            {compactMoney(holding.value)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[11px] text-muted-foreground">
                                A 13F describes a quarter that has already ended and can be filed up to 45 days
                                after it closes, so this is a snapshot of the past, not of today.
                            </p>
                        </>
                    )}
                </section>
            )}

            {filings && (
                <section className="flex flex-col gap-2.5">
                    <SectionLabel>House disclosures</SectionLabel>
                    {caveat(report) && <Notice tone="caution">{caveat(report)}</Notice>}
                    {filings.length === 0 && !caveat(report) ? (
                        <Notice tone="info">No disclosures found for this name.</Notice>
                    ) : filings.length === 0 ? null : (
                        <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                            {filings.slice(0, 25).map((filing, index) => (
                                <li
                                    key={`${filing.url}-${index}`}
                                    className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border")}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {filing.typeLabel}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {filing.name}
                                            {filing.district ? ` · ${filing.district}` : ""} · filed{" "}
                                            {filing.filedAt}
                                        </span>
                                    </span>
                                    <a
                                        href={filing.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 text-xs font-semibold text-primary"
                                    >
                                        PDF
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                        The House clerk publishes these as PDFs, and the index says which filing is a periodic
                        transaction report — the trades themselves are inside the document, so they are linked
                        rather than parsed and restated here.
                    </p>
                </section>
            )}
        </div>
    )
}
