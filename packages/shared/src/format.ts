/**
 * Number formatting shared by the calculators and the Home cards.
 *
 * Ported from the iOS app's Features/Calculators/CalcSupport.swift
 * (`CalcFormat` / `CalcFmt`) and PaperHome's `compactMoney`, which were
 * themselves ports of this site's original helpers. Non-finite results render
 * as an em dash rather than NaN/Infinity — the app never shows a fabricated or
 * broken figure.
 */

/** `num()` — strips everything except digits, a dot and a minus sign. */
export function calcValue(text: string): number {
    const cleaned = (text ?? "").replace(/[^0-9.-]/g, "")
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
}

/** Grouped with a fixed number of fraction digits. */
export function decimal(value: number, fraction = 2): string {
    if (!Number.isFinite(value)) return "0"
    return value.toLocaleString(undefined, {
        minimumFractionDigits: fraction,
        maximumFractionDigits: fraction,
    })
}

/** Grouped integer. */
export function int(value: number): string {
    if (!Number.isFinite(value)) return "0"
    return Math.round(value).toLocaleString()
}

/** Fixed fraction digits, no grouping. */
export function fixed(value: number, n: number): string {
    if (!Number.isFinite(value)) return "0"
    return value.toFixed(n)
}

/** `$1,234.00`, or an em dash when the figure isn't real. */
export function currency(value: number, fractionDigits = 0): string {
    if (!Number.isFinite(value)) return "—"
    return "$" + decimal(value, fractionDigits)
}

/** `12.5%`, or an em dash when the figure isn't real. */
export function percent(value: number, fractionDigits = 1): string {
    if (!Number.isFinite(value)) return "—"
    return fixed(value, fractionDigits) + "%"
}

/** Integer with grouping, em dash when not finite. */
export function count(value: number): string {
    if (!Number.isFinite(value)) return "—"
    return int(value)
}

/**
 * "$3.2k / $5k"-style compact currency. Values under $10 keep their cents:
 * rounding $2.90 to "$3" made a tiny real portfolio read as a different number
 * on Home than on the Portfolio page.
 */
export function compactMoney(value: number): string {
    if (!Number.isFinite(value)) return "—"
    if (value >= 1000) {
        const k = value / 1000
        const str = k === Math.round(k) ? k.toFixed(0) : k.toFixed(1)
        return `$${str}k`
    }
    if (value < 10 && value !== Math.round(value)) {
        return "$" + fixed(value, 2)
    }
    return "$" + int(value)
}
