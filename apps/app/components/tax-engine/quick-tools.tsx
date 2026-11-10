"use client"
import { useState } from "react"
import { PageBar, PageBody, Panel, PanelTitle, Stat } from "@/components/shell/surface"
import { currency, percent } from "@/lib/format"
import { parseTaxMoney } from "@/lib/quick-tax-estimate"
import { SUPPORTED_TAX_YEAR } from "./engine/constants/taxRules"
import { computeRegularTax } from "./engine/pipeline/regularTax"
import { computeSelfEmploymentTax } from "./engine/pipeline/scheduleSE"
import type { FilingStatus } from "./types/filing"
import { TAX_FILING_STATUSES } from "./quick-estimator"

type ToolResult = { label: string; amount: number; detail: string; secondary: number }
export function QuickTaxTool({ kind }: { kind: "brackets" | "self-employment" }) {
    const brackets = kind === "brackets"
    const title = brackets ? "Tax bracket calculator" : "Self-employment tax calculator"
    const [income, setIncome] = useState("")
    const [wages, setWages] = useState("")
    const [status, setStatus] = useState<FilingStatus | "">("")
    const [result, setResult] = useState<ToolResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const clear = () => { setResult(null); setError(null) }
    const inputStyle = "h-11 rounded-lg border border-input bg-card px-3 text-foreground"
    return <><PageBar title={`${title} · ${SUPPORTED_TAX_YEAR}`} back={{ href: "/taxes", label: "Taxes" }} /><PageBody className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{brackets ? "Enter taxable income after deductions. This calculates ordinary federal income tax before credits; capital gains and other taxes are separate." : "Calculate the Schedule SE portion for one person's net profit. Income tax and Additional Medicare Tax are separate."}</p>
        <div className="grid items-start gap-6 lg:grid-cols-2"><Panel><form className="flex flex-col gap-5" onSubmit={event => {
            event.preventDefault(); clear()
            try {
                if (income.trim() === "") throw new Error("Enter an income amount.")
                const amount = parseTaxMoney(income, brackets ? "Taxable income" : "Net profit")
                if (brackets) {
                    if (!status) throw new Error("Choose your filing status.")
                    const tax = computeRegularTax(amount, status, SUPPORTED_TAX_YEAR)
                    setResult({ label: "Ordinary income tax", amount: tax.tax, detail: "Marginal rate", secondary: tax.marginalRate * 100 })
                } else {
                    const tax = computeSelfEmploymentTax({ taxpayer: amount, spouse: 0 }, { taxpayer: parseTaxMoney(wages, "W-2 Social Security wages"), spouse: 0 }, SUPPORTED_TAX_YEAR)
                    setResult({ label: "Self-employment tax", amount: tax.seTax, detail: "Deductible portion", secondary: tax.deduction })
                }
            } catch (e) { setError(e instanceof Error ? e.message : "Check your entries.") }
        }}>
            <PanelTitle>Your figures</PanelTitle>
            {brackets && <label className="flex flex-col gap-2 text-sm font-medium">Filing status<select required value={status} className={inputStyle} onChange={e => { setStatus(e.target.value as FilingStatus); clear() }}><option value="" disabled>Choose filing status</option>{TAX_FILING_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            <label className="flex flex-col gap-2 text-sm font-medium">{brackets ? "Taxable income ($)" : "Net self-employment profit ($)"}<input required inputMode="decimal" maxLength={32} value={income} className={inputStyle} onChange={e => { setIncome(e.target.value); clear() }} /></label>
            {!brackets && <label className="flex flex-col gap-2 text-sm font-medium">W-2 Social Security wages ($, optional)<input inputMode="decimal" maxLength={32} value={wages} className={inputStyle} onChange={e => { setWages(e.target.value); clear() }} /><span className="text-xs font-normal text-muted-foreground">Use box 3 wages for this person only. Leave blank if there are none.</span></label>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3"><button type="submit" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Calculate</button><button type="button" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold" onClick={() => { setIncome(""); setWages(""); setStatus(""); clear() }}>Reset</button></div>
        </form></Panel><Panel><div aria-live="polite" aria-atomic="true">{result ? <><p className="text-sm text-muted-foreground">{result.label}</p><p className="figure mt-2 text-4xl font-semibold">{currency(result.amount)}</p><div className="mt-6"><Stat label={result.detail} value={brackets ? percent(result.secondary, 1) : currency(result.secondary)} /></div><p className="mt-5 text-xs leading-relaxed text-muted-foreground">{brackets ? "Uses the IRS Tax Table method below $100,000 and the tax rate schedule above it." : "This is the Schedule SE tax component, not an estimated payment or total income-tax bill."}</p></> : <><PanelTitle>Your result will appear here</PanelTitle><p className="mt-3 text-sm text-muted-foreground">Enter your figures and select Calculate.</p></>}</div></Panel></div>
    </PageBody></>
}
