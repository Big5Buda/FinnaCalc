"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { cn } from "@/lib/utils"
import {
    CURRENCIES,
    CURRENCY_SYMBOL,
    useCalculatorStore,
    type CurrencyCode,
} from "@/lib/stores/calculator-store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/primitives"

/**
 * The model's inputs.
 *
 * Validation is a Zod schema rather than scattered checks, so the bounds are
 * stated once and the same rule produces the error text. The bounds themselves
 * are deliberate: a negative principal isn't a model, and a 40% expected yield
 * isn't a projection, it's a fantasy — the field says so rather than quietly
 * computing it.
 *
 * Values flow into the Zustand store on every valid change, which is what the
 * other two panels read. The form owns what's being typed; the store owns what
 * the model currently is.
 */

const schema = z.object({
    initialPrincipal: z.coerce
        .number()
        .min(0, "Can't start with less than nothing.")
        .max(100_000_000, "Above $100M this stops being a useful model."),
    monthlyContribution: z.coerce
        .number()
        .min(0, "Use 0 if you're not adding anything.")
        .max(1_000_000, "Above $1M a month, model it as principal instead."),
    expectedYield: z.coerce
        .number()
        .min(-20, "Below −20% a year, a projection isn't the right tool.")
        .max(30, "Above 30% a year isn't a projection anyone should plan on."),
    inflationRate: z.coerce
        .number()
        .min(-5, "Sustained deflation below −5% has no modern precedent.")
        .max(25, "Above 25%, annual compounding stops describing what happens."),
    taxBracket: z.coerce
        .number()
        .min(0, "A negative rate would be a refund, not a bracket.")
        .max(60, "No US federal bracket reaches 60%."),
    years: z.coerce
        .number()
        .int("Whole years only.")
        .min(1, "Model at least one year.")
        .max(50, "Past 50 years the assumptions matter more than the arithmetic."),
})

type FormValues = z.infer<typeof schema>

export function ControlSidebar() {
    const parameters = useCalculatorStore((state) => state.parameters)
    const currency = useCalculatorStore((state) => state.currency)
    const setParameters = useCalculatorStore((state) => state.setParameters)
    const setCurrency = useCalculatorStore((state) => state.setCurrency)
    const reset = useCalculatorStore((state) => state.reset)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: parameters,
        mode: "onChange",
    })

    const { watch, setValue, formState } = form
    const values = watch()

    // Push every valid edit straight into the store — the panels beside this
    // one are meant to move as you type, not on submit. Invalid input holds the
    // last good model rather than blanking the charts.
    useEffect(() => {
        if (!formState.isValid) return
        setParameters(values)
        // Watching the object identity would loop; the individual fields are
        // what actually change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        values.initialPrincipal,
        values.monthlyContribution,
        values.expectedYield,
        values.inflationRate,
        values.taxBracket,
        values.years,
        formState.isValid,
    ])

    const symbol = CURRENCY_SYMBOL[currency]

    return (
        <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()}>
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Parameters
                </h2>
                <Select value={currency} onValueChange={(next) => setCurrency(next as CurrencyCode)}>
                    <SelectTrigger className="h-8 w-[92px]" aria-label="Currency">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CURRENCIES.map((code) => (
                            <SelectItem key={code} value={code}>
                                {CURRENCY_SYMBOL[code]} {code}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <MoneyField
                id="initialPrincipal"
                label="Initial principal"
                symbol={symbol}
                value={values.initialPrincipal}
                error={formState.errors.initialPrincipal?.message}
                onChange={(next) => setValue("initialPrincipal", next, { shouldValidate: true })}
                min={0}
                max={500_000}
                step={1000}
            />

            <MoneyField
                id="monthlyContribution"
                label="Monthly contribution"
                symbol={symbol}
                value={values.monthlyContribution}
                error={formState.errors.monthlyContribution?.message}
                onChange={(next) => setValue("monthlyContribution", next, { shouldValidate: true })}
                min={0}
                max={20_000}
                step={50}
            />

            <PercentField
                id="expectedYield"
                label="Expected yield"
                hint="Nominal annual return, before inflation and tax."
                value={values.expectedYield}
                error={formState.errors.expectedYield?.message}
                onChange={(next) => setValue("expectedYield", next, { shouldValidate: true })}
                min={-10}
                max={20}
                step={0.1}
            />

            <PercentField
                id="inflationRate"
                label="Inflation rate"
                hint="Used to restate balances in today's money."
                value={values.inflationRate}
                error={formState.errors.inflationRate?.message}
                onChange={(next) => setValue("inflationRate", next, { shouldValidate: true })}
                min={0}
                max={15}
                step={0.1}
            />

            <PercentField
                id="taxBracket"
                label="Tax bracket"
                hint="Marginal rate on gains when realised. An estimate, not tax advice."
                value={values.taxBracket}
                error={formState.errors.taxBracket?.message}
                onChange={(next) => setValue("taxBracket", next, { shouldValidate: true })}
                min={0}
                max={50}
                step={1}
            />

            <PercentField
                id="years"
                label="Horizon"
                unit="yrs"
                value={values.years}
                error={formState.errors.years?.message}
                onChange={(next) => setValue("years", Math.round(next), { shouldValidate: true })}
                min={1}
                max={50}
                step={1}
            />

            <Button type="button" variant="ghost" onClick={reset} className="self-start">
                Reset to defaults
            </Button>
        </form>
    )
}

/**
 * One parameter: a card that lifts on hover and takes the brand border when
 * anything inside it has focus, so the panel shows which row you're editing
 * without a separate selection state.
 */
function FieldCard({
    children,
    error,
}: {
    children: React.ReactNode
    error?: string
}) {
    return (
        <div
            className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors",
                "hover:border-border-strong focus-within:border-primary",
                error ? "border-destructive" : "border-border"
            )}
        >
            {children}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    )
}

function MoneyField({
    id,
    label,
    symbol,
    value,
    error,
    onChange,
    min,
    max,
    step,
}: {
    id: string
    label: string
    symbol: string
    value: number
    error?: string
    onChange: (value: number) => void
    min: number
    max: number
    step: number
}) {
    return (
        <FieldCard error={error}>
            <div className="flex items-center justify-between gap-3">
                <Label htmlFor={id}>{label}</Label>
                <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">{symbol}</span>
                    <Input
                        id={id}
                        inputMode="decimal"
                        // Grouped as you type, in the chosen currency's own
                        // convention — a raw 2000000 is unreadable at a glance.
                        value={Number.isFinite(value) ? value.toLocaleString() : ""}
                        onChange={(event) => onChange(Number(event.target.value.replace(/[^0-9.-]/g, "")))}
                        className="figure h-8 w-28 text-right"
                    />
                </div>
            </div>
            <Slider
                aria-label={label}
                value={[Math.min(Math.max(value, min), max)]}
                onValueChange={([next]) => onChange(next)}
                min={min}
                max={max}
                step={step}
            />
        </FieldCard>
    )
}

function PercentField({
    id,
    label,
    hint,
    unit = "%",
    value,
    error,
    onChange,
    min,
    max,
    step,
}: {
    id: string
    label: string
    hint?: string
    unit?: string
    value: number
    error?: string
    onChange: (value: number) => void
    min: number
    max: number
    step: number
}) {
    return (
        <FieldCard error={error}>
            <div className="flex items-center justify-between gap-3">
                <Label htmlFor={id}>{label}</Label>
                <div className="flex items-center gap-1">
                    <Input
                        id={id}
                        inputMode="decimal"
                        value={Number.isFinite(value) ? String(value) : ""}
                        onChange={(event) => onChange(Number(event.target.value.replace(/[^0-9.-]/g, "")))}
                        className="figure h-8 w-20 text-right"
                    />
                    <span className="text-sm text-muted-foreground">{unit}</span>
                </div>
            </div>
            <Slider
                aria-label={label}
                value={[Math.min(Math.max(value, min), max)]}
                onValueChange={([next]) => onChange(next)}
                min={min}
                max={max}
                step={step}
            />
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </FieldCard>
    )
}
