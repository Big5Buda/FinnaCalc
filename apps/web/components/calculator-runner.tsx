"use client"

import { useMemo, useState } from "react"
import type { CalcAccent } from "@finnacalc/shared/calculators"
import { CALCULATOR_FORMS, type Field } from "@/lib/calculator-forms"
import type { CalculatorSlug } from "@finnacalc/shared/calculators-catalog"
import { Pill } from "@/components/site"
import { signUpUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

/**
 * The working calculator on every /calculators/[slug] page.
 *
 * Fully un-gated on purpose: the calculators are the product's front door, and
 * a visitor gets the real engine — the same shared functions the app and the
 * iOS app call — with no account, no email, nothing stored. The single ask on
 * the page is "keep this", which is the one thing that genuinely needs an
 * account to exist.
 *
 * Results are live: edit a field, the panel recomputes. When inputs can't be
 * computed the panel explains itself rather than rendering NaN — the shared
 * math returns null and this component says why that's the answer.
 */

const ACCENT: Record<CalcAccent, string> = {
    green: "text-celery",
    blue: "text-ink",
    red: "text-terracotta",
    purple: "text-ink",
    orange: "text-ink-soft",
}

export function CalculatorRunner({ slug }: { slug: CalculatorSlug }) {
    const form = CALCULATOR_FORMS[slug]
    const [values, setValues] = useState<Record<string, number | string>>(() =>
        Object.fromEntries(form.fields.map((field) => [field.key, field.initial]))
    )

    const results = useMemo(() => form.compute(values), [form, values])

    const visibleFields = form.fields.filter(
        (field) =>
            !field.showWhen || field.showWhen.values.includes(String(values[field.showWhen.key]))
    )

    return (
        <div className="grid gap-8 rounded-lg border border-line bg-chip p-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:p-8">
            <div className="flex flex-col gap-5">
                {visibleFields.map((field) => (
                    <FieldInput
                        key={field.key}
                        field={field}
                        value={values[field.key]}
                        onChange={(next) =>
                            setValues((current) => ({ ...current, [field.key]: next }))
                        }
                    />
                ))}
            </div>

            <div className="flex flex-col gap-6">
                {results ? (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                        {results.map((metric) => (
                            <div key={metric.label} className="flex flex-col gap-0.5">
                                <dt className="text-sm text-ink-muted">{metric.label}</dt>
                                <dd
                                    className={cn(
                                        "figure text-2xl font-semibold",
                                        ACCENT[metric.accent]
                                    )}
                                >
                                    {metric.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ) : (
                    <p className="rounded-md border border-dashed border-line-strong p-5 text-sm leading-relaxed text-ink-muted">
                        These inputs don&rsquo;t add up to something computable yet — a zero where
                        the math needs a real amount, usually. Adjust the fields and the results
                        appear here.
                    </p>
                )}

                <p className="text-xs leading-relaxed text-ink-muted">{form.caveat}</p>

                <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-5">
                    <Pill href={signUpUrl()} className="px-5">
                        Save this in the app
                    </Pill>
                    <span className="text-xs text-ink-muted">
                        Free account. The numbers come with you.
                    </span>
                </div>
            </div>
        </div>
    )
}

function FieldInput({
    field,
    value,
    onChange,
}: {
    field: Field
    value: number | string
    onChange: (next: number | string) => void
}) {
    const id = `calc-${field.key}`

    if (field.kind === "select") {
        return (
            <div className="flex flex-col gap-1.5">
                <label htmlFor={id} className="text-sm font-medium text-ink">
                    {field.label}
                </label>
                <select
                    id={id}
                    value={String(value)}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-11 rounded-md border border-line-strong bg-chip px-3 text-[15px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                >
                    {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {field.hint && <p className="text-xs text-ink-muted">{field.hint}</p>}
            </div>
        )
    }

    const prefix = field.kind === "money" ? "$" : null
    const suffix = field.kind === "percent" ? "%" : field.kind === "years" ? "yrs" : null

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-ink">
                {field.label}
            </label>
            <div className="flex h-11 items-center gap-2 rounded-md border border-line-strong bg-chip px-3 focus-within:outline focus-within:outline-2 focus-within:outline-ink">
                {prefix && <span className="text-sm text-ink-muted">{prefix}</span>}
                <input
                    id={id}
                    inputMode="decimal"
                    value={String(value)}
                    onChange={(event) => {
                        const cleaned = event.target.value.replace(/[^0-9.\-]/g, "")
                        onChange(cleaned)
                    }}
                    className="figure w-full bg-transparent text-[15px] text-ink outline-none"
                />
                {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
            </div>
            {field.hint && <p className="text-xs text-ink-muted">{field.hint}</p>}
        </div>
    )
}
