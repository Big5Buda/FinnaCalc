"use client"
import Link from "next/link"
import { useId, useRef, useState } from "react"
import { useManualPortfolio } from "@/components/providers/manual-portfolio-provider"
import { holdingSymbol, validateHolding, type ManualHolding } from "@/lib/manual-portfolio"
import { portfolioInsights } from "@/lib/manual-portfolio-insights"
import { researchHref } from "@/lib/tradingview"
import { Button, Notice } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

const money = (n: number | null) => n === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

export function HoldingEditor({ symbol = "", holding }: { symbol?: string; holding?: ManualHolding }) {
    const portfolio = useManualPortfolio()
    const existing = holding ?? portfolio.holdings.find(h => h.symbol === holdingSymbol(symbol))
    const dialog = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const form = useRef<HTMLFormElement>(null)
    const [error, setError] = useState<string | null>(null)
    const open = () => { setError(null); form.current?.reset(); dialog.current?.showModal() }
    return <>
        <Button type="button" disabled={!portfolio.ready} onClick={open}>{existing ? "Edit holding" : "Add to portfolio"}</Button>
        <dialog ref={dialog} className="m-auto max-h-[90vh] overflow-y-auto w-[min(94vw,460px)] rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
            <h2 id={titleId} className="text-xl font-semibold">{existing ? "Edit holding" : "Add to portfolio"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Record what you own in USD. This does not buy or sell shares. Adding an existing ticker updates its total holding.</p>
            <form ref={form} key={existing ? JSON.stringify(existing) : symbol} className="mt-5 flex flex-col gap-4" onSubmit={event => {
                event.preventDefault(); setError(null)
                const data = new FormData(event.currentTarget)
                try {
                    const required = (name: string) => { const raw = String(data.get(name) ?? "").trim(); if (!raw) throw new Error("Enter shares and average cost."); return Number(raw) }
                    const rawPrice = String(data.get("currentPrice") ?? "").trim()
                    const value = validateHolding({ symbol: data.get("symbol"), shares: required("shares"), averageCost: required("averageCost"), currentPrice: rawPrice === "" ? null : Number(rawPrice), priceAsOf: data.get("priceAsOf") })
                    portfolio.save(value); dialog.current?.close()
                } catch (e) { setError(e instanceof Error ? e.message : "Check the holding details.") }
            }}>
                <label className="text-sm font-medium">Ticker<input autoFocus name="symbol" required maxLength={30} readOnly={!!existing} defaultValue={existing?.symbol ?? holdingSymbol(symbol) ?? symbol} className={field} placeholder="AAPL" /></label>
                <label className="text-sm font-medium">Total shares owned<input name="shares" required type="number" min="0.000001" step="any" defaultValue={existing?.shares ?? ""} className={field} /></label>
                <label className="text-sm font-medium">Average cost per share ($)<input name="averageCost" required type="number" min="0" step="any" defaultValue={existing?.averageCost ?? ""} className={field} /></label>
                <label className="text-sm font-medium">Current price per share ($, optional)<input name="currentPrice" type="number" min="0" step="any" defaultValue={existing?.currentPrice ?? ""} className={field} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Enter your own price to estimate value and gain/loss. Quotes are not imported from the chart.</span></label>
                <label className="text-sm font-medium">Price as of<input name="priceAsOf" type="date" defaultValue={existing?.priceAsOf ?? today()} className={field} /></label>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Cancel</Button><Button type="submit">Save holding</Button></div>
            </form>
        </dialog>
    </>
}

const percentage = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`
const gainColor = (value: number | null) => value === null || value === 0 ? "" : value > 0 ? "text-positive" : "text-negative"

export function ManualPortfolio({ analysis = false }: { analysis?: boolean }) {
    const portfolio = useManualPortfolio()
    const report = portfolioInsights(portfolio.holdings)
    let cursor = 0
    const segments = report.sectors.map(sector => { const start = cursor; cursor += sector.weight ?? 0; return `${sector.color} ${start}% ${cursor}%` })
    const hasMix = report.sectors.some(sector => sector.weight !== null)
    return <>
        <PageBar title={analysis ? "Portfolio analysis" : "Portfolio"} back={{ href: analysis ? "/investing/portfolio" : "/investing", label: analysis ? "Portfolio" : "Investing" }} />
        <PageBody className="flex flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{analysis ? "Your portfolio, at a glance" : "Your portfolio"}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Track your holdings, returns and mix with manually entered USD values. Saved only in this browser, without an account or brokerage sync; clearing browser data removes them.</p></div><div className="flex flex-wrap gap-3"><HoldingEditor />{!analysis && <Link className="rounded-lg border border-border px-4 py-2 text-sm font-medium" href="/investing/portfolio/analysis">View analysis</Link>}</div></header>
            {portfolio.notice && <Notice tone="info">{portfolio.notice}</Notice>}
            {!portfolio.ready ? <p role="status">Loading your saved holdings…</p> : report.rows.length === 0 ? <section className="rounded-2xl border border-border bg-card p-8"><h3 className="text-xl font-semibold">Build your portfolio view</h3><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Add stocks or ETFs with your shares and average cost. Include a current price to see unrealized gains and returns. Your holdings list, sector mix and key stats appear here as you add investments.</p><div className="mt-5 flex flex-wrap gap-3"><HoldingEditor /><Link href="/investing" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Explore stocks</Link></div></section> : <>
                <section aria-label="Portfolio key stats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
                    { label: "Portfolio value", value: money(report.value), hint: `${report.pricedCount} of ${report.rows.length} holdings priced` },
                    { label: "Cost basis", value: money(report.cost), hint: "Shares × average cost" },
                    { label: "Unrealized gain / loss", value: money(report.gain), hint: percentage(report.gainPercent), color: gainColor(report.gain) },
                    { label: "Holdings", value: String(report.rows.length), hint: `${report.winners} gaining · ${report.losers} declining (priced only)` },
                ].map(stat => <div key={stat.label} className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{stat.label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${stat.color ?? ""}`}>{stat.value}</p><p className={`mt-2 text-xs ${stat.color || "text-muted-foreground"}`}>{stat.hint}</p></div>)}</section>
                <p className="text-xs leading-relaxed text-muted-foreground">Values and unrealized returns use your entered prices and dates, not live quotes. Returns are gains relative to cost, excluding dividends, fees, cash flows and taxes; they are not annualized. {!report.complete && "Portfolio value and return stay blank until every holding has a price."} {report.oldestPrice && `Price dates: ${report.oldestPrice}${report.newestPrice !== report.oldestPrice ? ` to ${report.newestPrice}` : ""}.`}</p>
                <div className="grid items-start gap-5 lg:grid-cols-2">
                    <section className="rounded-2xl border border-border bg-card p-6"><h3 className="text-lg font-semibold">Sector mix</h3><p className="mt-1 text-xs text-muted-foreground">By {report.allocationBasis}. Funds are grouped separately, without looking through to their holdings.</p><div className="mt-6 flex flex-wrap items-center gap-7"><div role="img" aria-label={hasMix ? `Sector mix: ${report.sectors.map(sector => `${sector.name} ${sector.weight?.toFixed(1)}%`).join(", ")}` : "Sector mix unavailable for zero total cost and value"} className="relative mx-auto flex h-44 w-44 shrink-0 items-center justify-center rounded-full" style={{ background: hasMix ? `conic-gradient(${segments.join(", ")})` : "var(--mix-empty, #64748b)" }}><div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card text-center"><span className="text-2xl font-semibold">{report.rows.length}</span><span className="text-xs text-muted-foreground">holdings</span></div></div><ul className="min-w-[160px] flex-1 space-y-3">{report.sectors.map(sector => <li key={sector.id} className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sector.color }} />{sector.name}</span><span className="tabular-nums">{sector.weight === null ? "—" : `${sector.weight.toFixed(1)}%`}</span></li>)}</ul></div><p className="mt-5 text-xs text-muted-foreground">Company sectors use a curated classification. Unrecognized tickers remain unclassified.</p></section>
                    <section className="rounded-2xl border border-border bg-card p-6"><h3 className="text-lg font-semibold">Portfolio snapshot</h3><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Largest holding</dt><dd className="text-right font-medium">{report.allocations[0].symbol} · {report.allocations[0].weight === null ? "—" : `${report.allocations[0].weight.toFixed(1)}%`}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Top {Math.min(3, report.rows.length)} concentration</dt><dd className="font-medium">{report.topThreeWeight === null ? "—" : `${report.topThreeWeight.toFixed(1)}%`}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Largest sector / group</dt><dd className="text-right font-medium">{report.sectors[0].name}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Allocation basis</dt><dd className="font-medium capitalize">{report.allocationBasis}</dd></div></dl><p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">These observations describe the holdings you entered. Historical volatility, benchmark comparisons and risk-adjusted returns need price history and are not estimated here.</p></section>
                </div>
                {analysis && <section className="rounded-2xl border border-border bg-card p-6"><h3 className="text-lg font-semibold">Holding allocation</h3><ul className="mt-5 flex flex-col gap-4">{report.allocations.map(row => <li key={row.symbol}><div className="mb-2 flex justify-between gap-3 text-sm"><Link className="font-medium text-primary" href={researchHref(row.symbol)}>{row.symbol}</Link><span>{row.weight === null ? "—" : `${row.weight.toFixed(1)}%`} · {money(row.amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${row.weight ?? 0}%` }} /></div></li>)}</ul></section>}
                <section><h3 className="mb-4 text-xl font-semibold">Your holdings</h3><div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Your manually entered USD holdings and unrealized returns</caption><thead><tr className="border-b border-border text-muted-foreground">{["Holding", "Shares", "Average cost", "Price / date", "Value", "Gain / loss", "Return", "Manage"].map(t => <th key={t} className="p-4 font-medium">{t}</th>)}</tr></thead><tbody>{report.rows.map(h => <tr key={h.symbol} className="border-b border-border last:border-0"><td className="p-4"><Link className="font-semibold text-primary" href={researchHref(h.symbol)}>{h.symbol}</Link><span className="mt-1 block max-w-44 text-xs text-muted-foreground">{h.name !== h.symbol ? h.name : ""}</span></td><td className="p-4 tabular-nums">{h.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td><td className="p-4 tabular-nums">{money(h.averageCost)}</td><td className="p-4 tabular-nums">{money(h.currentPrice)}<span className="block text-xs text-muted-foreground">{h.priceAsOf ?? "Not entered"}</span></td><td className="p-4 tabular-nums">{money(h.value)}</td><td className={`p-4 tabular-nums ${gainColor(h.gain)}`}>{money(h.gain)}</td><td className={`p-4 tabular-nums ${gainColor(h.gainPercent)}`}>{percentage(h.gainPercent)}</td><td className="p-4"><div className="flex gap-2"><HoldingEditor holding={h} /><Button variant="outline" type="button" onClick={() => portfolio.remove(h.symbol)}>Remove</Button></div></td></tr>)}</tbody></table></div><p className="mt-2 text-xs text-muted-foreground">On smaller screens, scroll the holdings table horizontally to see all columns.</p></section>
            </>}
            {portfolio.canUndo && <div role="status" className="flex items-center gap-3 text-sm">Holding removed.<Button type="button" variant="outline" onClick={portfolio.undo}>Undo</Button></div>}
        </PageBody>
    </>
}
