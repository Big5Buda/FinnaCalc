"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { currency, percent } from "@/lib/format"
import { calculateFederalTax } from "@/components/tax-engine/engine"
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

    const result = useMemo(() => {
        const draft = makeEmptyReturn()
        draft.filingStatus = filingStatus

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
                    businessName: "Self-employment",
                    grossReceipts: selfEmployment,
                    expenses: {},
                    totalExpenses: 0,
                } as never,
            ]
        }

        // Dependents young enough for the child tax credit — the common case,
        // and the one that moves the number most.
        draft.dependents = Array.from({ length: dependents }, (_, index) => ({
            id: `dep-${index}`,
            firstName: "Dependent",
            lastName: "",
            ssn: "",
            dateOfBirth: "2018-01-01",
            relationship: "child",
            monthsLivedWithYou: 12,
            isStudent: false,
            isDisabled: false,
            providedOwnSupport: false,
        })) as never

        try {
            return calculateFederalTax(draft)
        } catch {
            return null
        }
    }, [filingStatus, wages, withheld, interest, selfEmployment, dependents])

    const refund = result?.refundOrOwed ?? 0
    const effectiveRate =
        result && result.totalIncome > 0 ? (result.totalTax / result.totalIncome) * 100 : null

    return (
        <>
            <PageBar
                title="Taxes"
                actions={<ActionPill tone="outline" href="/calculators">Calculators</ActionPill>}
            />
            <PageBody className="flex w-full max-w-5xl flex-col gap-5">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    A federal estimate for 2024, computed by the same 1040 engine the iPhone app
                    runs — checked against 176 test returns.
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
                        <MoneyInput label="Interest income" value={interest} onChange={setInterest} />
                        <MoneyInput
                            label="Dependent children"
                            value={dependents}
                            onChange={(next) => setDependents(Math.max(0, Math.round(next)))}
                            money={false}
                            hint="Under 17, for the child tax credit"
                        />
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

                        <Panel className="flex flex-col gap-3">
                            <PanelTitle>What this estimate leaves out</PanelTitle>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Itemized deductions, retirement and HSA contributions, capital gains,
                                education and care credits, Social Security income, and state tax.
                                The engine computes all of those — this screen just doesn&rsquo;t ask
                                for them yet, so treat the figure as a first pass rather than a
                                return.
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
                        onChange(cleaned === "" ? 0 : Number(cleaned))
                    }}
                    className="figure w-full bg-transparent text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
            </span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </label>
    )
}
