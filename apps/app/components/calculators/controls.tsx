"use client"

import { useId, useState, type ReactNode } from "react"
import { Info, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Calculator field controls, ported from CalcSupport.swift: labelled currency,
 * percent, stepper, select and segmented fields, each with the optional ⓘ that
 * reveals a methodology hint inline.
 */

const INPUT_CHROME =
    "h-11 w-full rounded-md border border-input bg-background text-base text-foreground transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background"

function FieldContainer({
    label,
    hint,
    htmlFor,
    children,
}: {
    label: string
    hint?: string
    htmlFor?: string
    children: ReactNode
}) {
    const [hintShown, setHintShown] = useState(false)
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-1.5">
                <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
                    {label}
                </label>
                {hint && (
                    <button
                        type="button"
                        onClick={() => setHintShown((shown) => !shown)}
                        aria-label={hintShown ? "Hide explanation" : "Show explanation"}
                        aria-expanded={hintShown}
                        className={cn(
                            "mt-0.5 inline-flex h-[17px] w-[17px] items-center justify-center rounded-full transition",
                            hintShown ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        )}
                    >
                        <Info className="h-2.5 w-2.5" strokeWidth={3} />
                    </button>
                )}
            </div>
            {children}
            {hint && hintShown && (
                <p className="border-l-2 border-border pl-2.5 text-sm text-muted-foreground">{hint}</p>
            )}
        </div>
    )
}

/**
 * `$` prefix + live thousands-separator formatting as the user types: one
 * decimal point, max 2 fraction digits, leading zeros stripped.
 */
export function formatCurrencyTyping(raw: string): string {
    let digitsAndDot = raw.replace(/[^0-9.]/g, "")
    if (!digitsAndDot) return ""
    const firstDot = digitsAndDot.indexOf(".")
    if (firstDot >= 0) {
        const intPart = digitsAndDot.slice(0, firstDot)
        const afterDot = digitsAndDot.slice(firstDot + 1).replace(/\./g, "")
        digitsAndDot = `${intPart}.${afterDot}`
    }
    const [rawInt = "", rawDec] = digitsAndDot.split(".")
    let intPart = rawInt.replace(/^0+(?=\d)/, "")
    if (!intPart) intPart = digitsAndDot.startsWith(".") ? "0" : ""
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    if (rawDec === undefined) return grouped
    return `${grouped}.${rawDec.slice(0, 2)}`
}

/** One-word placeholder derived from the label's last word carrying a letter. */
function lastWord(label: string): string {
    const words = label.split(/[ /]/).filter((word) => /[a-zA-Z]/.test(word))
    const word = words[words.length - 1] ?? label
    return word.replace(/[()%$#]/g, "")
}

export function CurrencyField({
    label,
    value,
    onChange,
    hint,
    placeholder,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    hint?: string
    placeholder?: string
}) {
    const id = useId()
    return (
        <FieldContainer label={label} hint={hint} htmlFor={id}>
            <div className={cn(INPUT_CHROME, "flex items-center")}>
                <span className="pl-3.5 text-sm font-medium text-muted-foreground">$</span>
                <input
                    id={id}
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(formatCurrencyTyping(e.target.value))}
                    placeholder={placeholder ?? lastWord(label)}
                    className="figure h-full w-full bg-transparent pl-2 pr-3.5  placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
            </div>
        </FieldContainer>
    )
}

export function PercentField({
    label,
    value,
    onChange,
    hint,
    placeholder,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    hint?: string
    placeholder?: string
}) {
    const id = useId()
    return (
        <FieldContainer label={label} hint={hint} htmlFor={id}>
            <div className={cn(INPUT_CHROME, "flex items-center")}>
                <input
                    id={id}
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => {
                        // Digits, one decimal point and a leading minus (growth
                        // rates can model a decline).
                        const cleaned = e.target.value
                            .replace(/[^0-9.-]/g, "")
                            .replace(/(?!^)-/g, "")
                            .replace(/(\..*)\./g, "$1")
                        onChange(cleaned)
                    }}
                    placeholder={placeholder ?? lastWord(label)}
                    className="figure h-full w-full bg-transparent pl-3.5 pr-2  placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
                <span className="pr-3.5 text-sm font-medium text-muted-foreground">%</span>
            </div>
        </FieldContainer>
    )
}

export function StepperField({
    label,
    value,
    onChange,
    min = 0,
    step = 1,
    unit = "",
    hint,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    min?: number
    step?: number
    unit?: string
    hint?: string
}) {
    const id = useId()
    const current = Number.parseInt(value, 10) || 0
    return (
        <FieldContainer label={label} hint={hint} htmlFor={id}>
            <div className={cn(INPUT_CHROME, "flex items-center justify-between px-1.5")}>
                <button
                    type="button"
                    aria-label={`Decrease ${label}`}
                    onClick={() => onChange(String(Math.max(min, current - step)))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-muted text-foreground"
                >
                    <Minus className="h-3 w-3" strokeWidth={3} />
                </button>
                <div className="flex items-baseline gap-1">
                    {/* Typing beats stepping for a big jump: 360 months is 300 taps away. */}
                    <input
                        id={id}
                        inputMode="numeric"
                        value={value}
                        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
                        size={Math.max(2, value.length)}
                        className="figure bg-transparent text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                    />
                    {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
                </div>
                <button
                    type="button"
                    aria-label={`Increase ${label}`}
                    onClick={() => onChange(String(current + step))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-muted text-foreground"
                >
                    <Plus className="h-3 w-3" strokeWidth={3} />
                </button>
            </div>
        </FieldContainer>
    )
}

export function SelectField<T extends string>({
    label,
    value,
    onChange,
    options,
    hint,
}: {
    label: string
    value: T
    onChange: (value: T) => void
    options: { value: T; label: string }[]
    hint?: string
}) {
    const id = useId()
    return (
        <FieldContainer label={label} hint={hint} htmlFor={id}>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className={cn(INPUT_CHROME, "appearance-none bg-background px-3.5 text-base")}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </FieldContainer>
    )
}

export function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    ariaLabel,
}: {
    value: T
    onChange: (value: T) => void
    options: { value: T; label: string }[]
    ariaLabel?: string
}) {
    return (
        <div role="tablist" aria-label={ariaLabel} className="flex gap-1 rounded-md bg-muted p-1">
            {options.map((option) => {
                const selected = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "h-9 flex-1 rounded-sm px-2 text-sm transition",
                            selected
                                ? "bg-card font-semibold text-foreground shadow-sm"
                                : "font-medium text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

export function SegmentedField<T extends string>({
    label,
    value,
    onChange,
    options,
}: {
    label: string
    value: T
    onChange: (value: T) => void
    options: { value: T; label: string }[]
}) {
    return (
        <FieldContainer label={label}>
            <SegmentedControl value={value} onChange={onChange} options={options} ariaLabel={label} />
        </FieldContainer>
    )
}

/** One field-group card; a segmented field always sits on its own full row. */
export function SectionCard({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm sm:px-[18px]">
            <p className="mb-2.5 text-sm font-medium text-foreground">{label}</p>
            {children}
        </section>
    )
}

/** Two-column grid for grouped inputs; a lone field sits half-width. */
export function FieldGrid({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">{children}</div>
}
