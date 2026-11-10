"use client"
import Link from "next/link"
import { useId, useRef, useState } from "react"
import { useManualPortfolio } from "@/components/providers/manual-portfolio-provider"
import { manualPortfolioAnalysis, holdingSymbol, validateHolding, type ManualHolding } from "@/lib/manual-portfolio"
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

export function ManualPortfolio({ analysis = false }: { analysis?: boolean }) {
    const portfolio = useManualPortfolio()
    const report = manualPortfolioAnalysis(portfolio.holdings)
    return <>
        <PageBar title={analysis ? "Portfolio analysis" : "Portfolio"} back={{ href: analysis ? "/investing/portfolio" : "/investing", label: analysis ? "Portfolio" : "Investing" }} />
        <PageBody className="flex flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{analysis ? "Your portfolio, at a glance" : "Your manual portfolio"}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Holdings are entered by you and saved only in this browser, without an account. They do not sync to a brokerage or other devices. Clearing browser data removes them.</p></div><div className="flex flex-wrap gap-3"><HoldingEditor />{!analysis && <Link className="rounded-lg border border-border px-4 py-2 text-sm font-medium" href="/investing/portfolio/analysis">View analysis</Link>}</div></header>
            {portfolio.notice && <Notice tone="info">{portfolio.notice}</Notice>}
            {!portfolio.ready ? <p role="status">Loading your saved holdings…</p> : report.rows.length === 0 ? <div className="rounded-2xl border border-border bg-card p-8"><h3 className="text-lg font-semibold">Start with a holding</h3><p className="mt-2 text-sm text-muted-foreground">Add a ticker, the number of shares you own, and your average cost. No brokerage connection is needed.</p></div> : <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
                    ["Cost basis", money(report.cost)], ["Entered value", money(report.value)], ["Unrealized gain / loss", money(report.gain)], ["Holdings", String(report.rows.length)],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>)}</div>
                <p className="text-xs text-muted-foreground">Values use your manually entered prices and dates, not live quotes. {report.pricedCount} of {report.rows.length} holdings have a price. {report.complete ? "Unrealized gain/loss excludes fees, dividends, cash flows and taxes." : "Portfolio value and gain/loss stay blank until every holding has a price."}</p>
                {analysis ? <>
                    <section className="rounded-2xl border border-border bg-card p-6"><h3 className="text-lg font-semibold">Allocation by {report.allocationBasis}</h3><ul className="mt-5 flex flex-col gap-4">{report.allocations.map(row => <li key={row.symbol}><div className="mb-2 flex justify-between gap-3 text-sm"><Link className="font-medium text-primary" href={researchHref(row.symbol)}>{row.symbol}</Link><span>{row.weight === null ? "—" : `${row.weight.toFixed(1)}%`} · {money(row.amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${row.weight ?? 0}%` }} /></div></li>)}</ul></section>
                    <section className="rounded-2xl border border-border bg-card p-6"><h3 className="text-lg font-semibold">Key observations</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground"><li>{report.allocations[0]?.weight !== null ? `${report.allocations[0].symbol} is the largest holding at ${report.allocations[0].weight!.toFixed(1)}% of your ${report.allocationBasis}.` : "Allocation percentages require a positive cost basis or entered value."}</li><li>{report.gainPercent === null ? "A percentage gain/loss requires a complete valuation and positive cost basis." : `Unrealized gain/loss is ${report.gainPercent.toFixed(1)}% of entered cost basis; it is not a time-weighted or annualized return.`}</li><li>These calculations do not measure market risk, volatility, sector diversification or future returns. No AI report is generated.</li></ul></section>
                </> : <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Your manually entered USD holdings</caption><thead><tr className="border-b border-border text-muted-foreground">{["Holding", "Shares", "Average cost", "Price / date", "Value", "Gain / loss", "Manage"].map(t => <th key={t} className="p-4 font-medium">{t}</th>)}</tr></thead><tbody>{report.rows.map(h => <tr key={h.symbol} className="border-b border-border last:border-0"><td className="p-4 font-semibold"><Link className="text-primary" href={researchHref(h.symbol)}>{h.symbol}</Link></td><td className="p-4">{h.shares.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td><td className="p-4">{money(h.averageCost)}</td><td className="p-4">{money(h.currentPrice)}<span className="block text-xs text-muted-foreground">{h.priceAsOf ?? "Not entered"}</span></td><td className="p-4">{money(h.value)}</td><td className="p-4">{money(h.gain)}</td><td className="p-4"><div className="flex gap-2"><HoldingEditor holding={h} /><Button variant="outline" type="button" onClick={() => portfolio.remove(h.symbol)}>Remove</Button></div></td></tr>)}</tbody></table></div>}
            </>}
            {portfolio.canUndo && <div role="status" className="flex items-center gap-3 text-sm">Holding removed.<Button type="button" variant="outline" onClick={portfolio.undo}>Undo</Button></div>}
        </PageBody>
    </>
}
