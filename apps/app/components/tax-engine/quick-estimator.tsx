"use client"
import Link from "next/link"
import { useId, useState } from "react"
import { currency, percent } from "@/lib/format"
import { calculateQuickTax, emptyQuickTaxForm, type QuickTaxForm, type TaxMoneyField } from "@/lib/quick-tax-estimate"
import { SUPPORTED_TAX_YEAR } from "./engine/constants/taxRules"
import { ActionPill, PageBar, PageBody, Panel, PanelTitle, Stat } from "@/components/shell/surface"
import { cn } from "@/lib/utils"

export const TAX_FILING_STATUSES = [
    ["single", "Single"], ["mfj", "Married filing jointly"], ["mfs", "Married filing separately"],
    ["hoh", "Head of household"], ["qss", "Qualifying surviving spouse"],
]
export function QuickTaxEstimator({ fromHub = false }: { fromHub?: boolean }) {
    const [form, setForm] = useState(emptyQuickTaxForm)
    const [result, setResult] = useState<ReturnType<typeof calculateQuickTax> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const update = <K extends keyof QuickTaxForm>(key: K, value: QuickTaxForm[K]) => {
        setForm(previous => ({ ...previous, [key]: value })); setResult(null); setError(null)
    }
    const moneyField = (key: TaxMoneyField, label: string, hint?: string) => <AmountInput label={label} value={form[key]} onChange={value => update(key, value)} hint={hint} />
    const refund = result?.refundOrOwed ?? 0
    const effectiveRate = result && result.totalIncome > 0 ? result.totalTax / result.totalIncome * 100 : null
    return <>
        <PageBar title={`Federal tax estimator · ${SUPPORTED_TAX_YEAR}`} back={fromHub ? { href: "/taxes", label: "Taxes" } : undefined} actions={<ActionPill tone="outline" href="/taxes">Tax tools</ActionPill>} />
        <PageBody className="flex flex-col gap-6">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Estimate federal taxes for {SUPPORTED_TAX_YEAR} using your own figures. Choose your filing status and enter your income and withholding, then calculate.</p>
            <div className="grid items-start gap-6 lg:grid-cols-2">
                <Panel>
                    <form className="flex flex-col gap-5" onSubmit={event => {
                        event.preventDefault(); setError(null); setResult(null)
                        try { setResult(calculateQuickTax(form)) }
                        catch (e) { setError(e instanceof Error ? e.message : "Check your entries and try again.") }
                    }}>
                        <PanelTitle>Your situation</PanelTitle>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-sm font-medium">Filing status</span><select required aria-label="Filing status" value={form.filingStatus} onChange={event => update("filingStatus", event.target.value as QuickTaxForm["filingStatus"])} className="h-11 rounded-lg border border-input bg-card px-3 text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><option value="" disabled>Choose filing status</option>{TAX_FILING_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                            <AmountInput label="Age at year-end (optional)" value={form.age} onChange={value => update("age", value)} money={false} hint="Used for senior deductions and the childless Earned Income Credit age test." />
                            <AmountInput label="Dependent children" value={form.dependents} onChange={value => update("dependents", value)} money={false} hint="Qualifying children under 17 who meet the child-credit and EITC rules." />
                            {moneyField("wages", "Wages (W-2 box 1)")}
                            {moneyField("withheld", "Federal tax withheld (box 2)")}
                            {moneyField("selfEmployment", "Self-employment income", "Net profit before the SE-tax deduction.")}
                            {moneyField("interest", "Interest income")}
                            {Number(form.selfEmployment.replace(/,/g, "")) > 0 && <label className="flex items-start gap-2 text-sm leading-relaxed sm:col-span-2"><input type="checkbox" checked={form.activeBusiness} onChange={event => update("activeBusiness", event.target.checked)} className="mt-1" />I materially participate in this business. Use this confirmation when checking the minimum QBI deduction.</label>}
                        </div>
                        <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold">Additional {SUPPORTED_TAX_YEAR} deductions</summary><div className="mt-4 grid gap-5 sm:grid-cols-2">
                            {moneyField("charity", "Eligible cash gifts to charity", "Qualifying organizations only; excludes donor-advised funds. Standard-deduction cash-gift limits apply.")}
                            {moneyField("tips", "Qualified tips already included in income", "Only tips meeting IRS eligibility rules, not all tips or self-employment profit.")}
                            {moneyField("overtime", "Qualified overtime premium already in wages", "Only the eligible FLSA premium, not total overtime pay.")}
                            {moneyField("carInterest", "Eligible personal vehicle-loan interest", "Only qualifying loans and vehicles; excludes leases and used vehicles.")}
                            <a href="https://www.irs.gov/publications/p505" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary underline sm:col-span-2">Check deduction eligibility with the IRS</a>
                        </div></details>
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                        <div className="flex flex-wrap gap-3 border-t border-border pt-5"><button type="submit" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Calculate estimate</button><button type="button" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold" onClick={() => { setForm(emptyQuickTaxForm()); setResult(null); setError(null) }}>Reset</button></div>
                    </form>
                </Panel>
                <div className="flex min-w-0 flex-col gap-5">
                    <Panel>
                        <div aria-live="polite" aria-atomic="true">{result ? <>
                            <p className="text-sm text-muted-foreground">{refund >= 0 ? "Estimated refund" : "Estimated balance due"}</p>
                            <p className={cn("figure pt-1 text-4xl font-semibold", refund >= 0 ? "text-positive" : "text-negative")}>{currency(Math.abs(refund))}</p>
                            <div className="grid grid-cols-2 gap-5 pt-6 xl:grid-cols-3"><Stat label="Total income" value={currency(result.totalIncome)} /><Stat label="AGI" value={currency(result.agi)} /><Stat label="Deduction" value={currency(result.deductionAmount)} hint={result.deductionUsed === "standard" ? "Standard" : "Itemized"} /><Stat label="Taxable income" value={currency(result.taxableIncome)} /><Stat label="Total tax" value={currency(result.totalTax)} /><Stat label="Effective rate" value={effectiveRate === null ? "—" : percent(effectiveRate, 1)} /></div>
                            {result.seTax > 0 && <p className="figure pt-5 text-sm text-muted-foreground">Includes {currency(result.seTax)} self-employment tax.</p>}
                        </> : <><PanelTitle>Your estimate will appear here</PanelTitle><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Complete your situation and choose Calculate estimate. Changing an entry clears the previous result until you calculate again.</p></>}</div>
                    </Panel>
                    {result && result.warnings.length > 0 && <Panel className="flex flex-col gap-3"><PanelTitle>Check before relying on this estimate</PanelTitle><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{result.warnings.map(w => <li key={w.code}>{w.message}</li>)}</ul></Panel>}
                    <Panel className="flex flex-col gap-3"><PanelTitle>Scope of this estimate</PanelTitle><p className="text-sm leading-relaxed text-muted-foreground">This is a first-pass federal estimate. It does not include itemized deductions, retirement or HSA contributions, capital gains, education or care credits, Social Security income, or state tax.</p><p className="text-sm leading-relaxed text-muted-foreground">It does not file a return or transmit information to the IRS. <Link href="/taxes" className="font-medium underline">Explore tax tools</Link>.</p></Panel>
                </div>
            </div>
        </PageBody>
    </>
}
function AmountInput({ label, value, onChange, hint, money = true }: { label: string; value: string; onChange: (value: string) => void; hint?: string; money?: boolean }) {
    const hintId = useId()
    return <label className="flex min-w-0 flex-col gap-1.5"><span className="text-sm font-medium">{label}</span><span className="flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:outline focus-within:outline-2 focus-within:outline-ring">{money && <span className="text-sm text-muted-foreground" aria-hidden="true">$</span>}<input inputMode={money ? "decimal" : "numeric"} maxLength={32} value={value} onChange={event => onChange(event.target.value)} aria-describedby={hint ? hintId : undefined} autoComplete="off" className="figure min-w-0 w-full bg-transparent text-[15px] text-foreground outline-none" /></span>{hint && <span id={hintId} className="text-xs text-muted-foreground">{hint}</span>}</label>
}
