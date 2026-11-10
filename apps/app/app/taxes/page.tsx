"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { currency, percent } from "@/lib/format"
import { calculateFederalTax } from "@/components/tax-engine/engine"
import { SUPPORTED_TAX_YEAR } from "@/components/tax-engine/engine/constants/taxRules"
import { makeEmptyReturn } from "@/components/tax-engine/types/taxReturn"
import type { FilingStatus } from "@/components/tax-engine/types/filing"
import {
    ActionPill,
    PageBar,
    PageBody,
    Panel,
    PanelTitle,
    Stat,
} from "@/components/shell/surface"
import { cn } from "@/lib/utils"

/**
 * The federal estimate, running on the real 1040 engine.
 *
 * This page used to say the web version was "being built". The engine was
 * already here and already tested — 176 cases in
 * components/tax-engine/engine/__tests__ — so the honest move was to wire the
 * few inputs that drive most people's return rather than keep promising it.
 *
 * What this is NOT is the full interview: the engine reads dozens of forms,
 * and this screen feeds it wages, withholding, filing status, dependents and
 * a couple of common income types. Everything it can't see is stated under the
 * result, because an estimate that hides its own scope is worse than no
 * estimate.
 */

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
    { value: "single", label: "Single" },
    { value: "mfj", label: "Married filing jointly" },
    { value: "mfs", label: "Married filing separately" },
    { value: "hoh", label: "Head of household" },
    { value: "qss", label: "Qualifying surviving spouse" },
]

export default function TaxesPage() {
    const [filingStatus, setFilingStatus] = useState<FilingStatus>("single")
    const [wages, setWages] = useState(75000)
    const [withheld, setWithheld] = useState(9000)
    const [interest, setInterest] = useState(0)
    const [selfEmployment, setSelfEmployment] = useState(0)
    const [dependents, setDependents] = useState(0)
    const [age, setAge] = useState("")
    const [charity, setCharity] = useState(0)
    const [tips, setTips] = useState(0)
    const [overtime, setOvertime] = useState(0)
    const [carInterest, setCarInterest] = useState(0)
    const [activeBusiness, setActiveBusiness] = useState(false)

    const result = useMemo(() => {
        const draft = makeEmptyReturn()
        draft.filingStatus = filingStatus
        draft.taxpayer.dateOfBirth = age && Number(age)>0 ? `${SUPPORTED_TAX_YEAR-Number(age)}-06-15` : ""
        draft.itemized.charitableCash = charity
        draft.activeQbiConfirmed = activeBusiness
        draft.newDeductions = { qualifiedTips: tips, qualifiedOvertime: overtime, carLoanInterest: carInterest }

        // One W-2 carrying the wage boxes the engine needs: Social Security and
        // Medicare wages track box 1 for an ordinary employee, and the payroll
        // taxes withheld follow the statutory rates.
        if (wages > 0 || withheld > 0) {
            draft.income.flags.hasW2 = true
            draft.income.w2 = [
                {
                    id: "w2-1",
                    employerName: "Employer",
                    owner: "taxpayer",
                    box1Wages: wages,
                    box2FederalWithholding: withheld,
                    box3SsWages: wages,
                    box4SsWithheld: Math.round(wages * 0.062 * 100) / 100,
                    box5MedicareWages: wages,
                    box6MedicareWithheld: Math.round(wages * 0.0145 * 100) / 100,
                    box12: [],
                    statutoryEmployee: false,
                    box17StateWithholding: 0,
                },
            ]
        }

        if (interest > 0) {
            draft.income.flags.hasInterest = true
            draft.income.f1099Int = [
                { id: "int-1", payer: "Bank", owner: "taxpayer", box1Interest: interest } as never,
            ]
        }

        if (selfEmployment > 0) {
            draft.income.flags.hasSelfEmployment = true
            draft.income.scheduleC = [
                {
                    id: "sch-c-1",
                    owner: "taxpayer",
                    businessName: "Self-employment", description: "Business",
                    grossReceipts: selfEmployment, costOfGoodsSold:0,
                    expenses: {}, homeOfficeDeduction:0, vehicleExpense:0, isSSTB:false,
                },
            ]
        }

        // Dependents young enough for the child tax credit — the common case,
        // and the one that moves the number most.
        draft.dependents = Array.from({ length: dependents }, (_, index) => ({
            id: `dep-${index}`, firstName:"Child",lastName:"",ssn:"",dateOfBirth:"2018-01-01",
            relationshipType:"child",relationship:"child",monthsLivedWithTaxpayer:12,
            taxpayerProvidedOverHalfSupport:true,qualifiesForCTC:true,qualifiesForODC:false,
            qualifiesForEITC:true,qualifiesForCareCredit:false,
        }))


        try {
            return calculateFederalTax(draft)
        } catch {
            return null
        }
    }, [filingStatus, wages, withheld, interest, selfEmployment, dependents, age, charity, tips, overtime, carInterest, activeBusiness])

    const refund = result?.refundOrOwed ?? 0
    const effectiveRate =
        result && result.totalIncome > 0 ? (result.totalTax / result.totalIncome) * 100 : null

    return (
        <>
            <PageBar
                title={`Taxes · ${SUPPORTED_TAX_YEAR}`}
                actions={<ActionPill tone="outline" href="/calculators">Calculators</ActionPill>}
            />
            <PageBody className="flex w-full flex-col gap-5">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    A federal estimate for tax year {SUPPORTED_TAX_YEAR}.
                    Check this tool’s coverage and limitations before using an estimate; it does not file returns.
                </p>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
                    <Panel className="flex flex-col gap-5">
                        <PanelTitle>Your situation</PanelTitle>

                        <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-foreground">Filing status</span>
                            <select
                                value={filingStatus}
                                onChange={(event) =>
                                    setFilingStatus(event.target.value as FilingStatus)
                                }
                                className="h-11 rounded-md border border-input bg-card px-3 text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                            >
                                {FILING_STATUSES.map((status) => (
                                    <option key={status.value} value={status.value}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Your age at year-end (optional)</span><input type="number" min="1" max="120" value={age} onChange={e=>setAge(e.target.value === "" ? "" : String(Math.min(120,Math.max(1,Number(e.target.value)||1))))} className="h-11 rounded-md border border-input bg-card px-3 text-foreground" /><span className="text-xs text-muted-foreground">Used for senior deductions and the childless Earned Income Credit age test.</span></label>

                        <MoneyInput label="Wages (W-2 box 1)" value={wages} onChange={setWages} />
                        <MoneyInput
                            label="Federal tax withheld (box 2)"
                            value={withheld}
                            onChange={setWithheld}
                        />
                        <MoneyInput
                            label="Self-employment income"
                            value={selfEmployment}
                            onChange={setSelfEmployment}
                            hint="Net profit before the SE-tax deduction"
                        />
                        {selfEmployment > 0 && <label className="flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" checked={activeBusiness} onChange={e=>setActiveBusiness(e.target.checked)} className="mt-1" />I materially participate in this business. Use this confirmation when checking the minimum QBI deduction.</label>}
                        <MoneyInput label="Interest income" value={interest} onChange={setInterest} />
                        <MoneyInput
                            label="Dependent children"
                            value={dependents}
                            onChange={(next) => setDependents(Math.min(99, Math.max(0, Math.floor(next))))}
                            money={false}
                            hint="Qualifying children under 17 who meet the child-credit and EITC eligibility rules"
                        />
                        <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold">Additional 2026 deductions</summary><div className="mt-4 flex flex-col gap-4">
                            <MoneyInput label="Eligible cash gifts to charity" value={charity} onChange={setCharity} hint="Eligible gifts to qualifying organizations; excludes donor-advised funds. Standard-deduction cash-gift limit applies." />
                            <MoneyInput label="Qualified tips already included in income" value={tips} onChange={setTips} hint="Only tips that meet the IRS eligibility rules, not all tips or self-employment profit." />
                            <MoneyInput label="Qualified overtime premium already in wages" value={overtime} onChange={setOvertime} hint="Only the eligible FLSA overtime premium, not total overtime pay." />
                            <MoneyInput label="Eligible personal vehicle-loan interest" value={carInterest} onChange={setCarInterest} hint="Only qualifying loans and vehicles under the IRS rules; excludes leases and used vehicles." />
                            <a href="https://www.irs.gov/publications/p505" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary underline underline-offset-4">Check 2026 deduction eligibility with the IRS</a>
                        </div></details>
                    </Panel>

                    <div className="flex flex-col gap-5">
                        <Panel>
                            {result ? (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        {refund >= 0 ? "Estimated refund" : "Estimated balance due"}
                                    </p>
                                    <p
                                        className={cn(
                                            "figure pt-1 text-4xl font-semibold",
                                            refund >= 0 ? "text-positive" : "text-negative"
                                        )}
                                    >
                                        {currency(Math.abs(refund))}
                                    </p>

                                    <div className="grid grid-cols-2 gap-6 pt-6 sm:grid-cols-3">
                                        <Stat label="Total income" value={currency(result.totalIncome)} />
                                        <Stat label="AGI" value={currency(result.agi)} />
                                        <Stat
                                            label="Deduction"
                                            value={currency(result.deductionAmount)}
                                            hint={
                                                result.deductionUsed === "standard"
                                                    ? "Standard"
                                                    : "Itemized"
                                            }
                                        />
                                        <Stat
                                            label="Taxable income"
                                            value={currency(result.taxableIncome)}
                                        />
                                        <Stat label="Total tax" value={currency(result.totalTax)} />
                                        <Stat
                                            label="Effective rate"
                                            // null when there's no income — a dash,
                                            // never a 0% that reads like a finding.
                                            value={
                                                effectiveRate === null
                                                    ? "—"
                                                    : percent(effectiveRate, 1)
                                            }
                                        />
                                    </div>

                                    {result.seTax > 0 && (
                                        <p className="figure pt-5 text-sm text-muted-foreground">
                                            Includes {currency(result.seTax)} self-employment tax.
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    These inputs don&rsquo;t make a return the engine can compute yet.
                                </p>
                            )}
                        </Panel>

                        {result && result.warnings.length > 0 && <Panel className="flex flex-col gap-3"><PanelTitle>Check before relying on this estimate</PanelTitle><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{result.warnings.map(w => <li key={w.code}>{w.message}</li>)}</ul></Panel>}

                        <Panel className="flex flex-col gap-3">
                            <PanelTitle>What this estimate leaves out</PanelTitle>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Itemized deductions, retirement and HSA contributions, capital gains,
                                education and care credits, Social Security income, and state tax.
                                This screen does not collect those inputs. It is a first-pass federal estimate;
                                2026 state income tax is not included.
                            </p>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                It is an estimate for planning, not a filed return. E-filing
                                isn&rsquo;t enabled and nothing is transmitted to the IRS.{" "}
                                <Link href="/calculators" className="font-medium text-foreground underline underline-offset-4">
                                    Run other numbers with the calculators
                                </Link>
                                .
                            </p>
                        </Panel>
                    </div>
                </div>
            </PageBody>
        </>
    )
}

function MoneyInput({
    label,
    value,
    onChange,
    hint,
    money = true,
}: {
    label: string
    value: number
    onChange: (next: number) => void
    hint?: string
    money?: boolean
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-card px-3 focus-within:outline focus-within:outline-2 focus-within:outline-ring">
                {money && <span className="text-sm text-muted-foreground">$</span>}
                <input
                    inputMode="decimal"
                    value={String(value)}
                    onChange={(event) => {
                        const cleaned = event.target.value.replace(/[^0-9.]/g, "")
                        const parsed = cleaned === "" ? 0 : Number(cleaned)
                        if (Number.isFinite(parsed)) onChange(Math.max(0, Math.min(parsed, 1_000_000_000)))
                    }}
                    className="figure w-full bg-transparent text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
            </span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </label>
    )
}
