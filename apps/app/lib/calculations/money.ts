/**
 * Currency-aware formatting for the modelling dashboard.
 *
 * The shared `currency()` helper hard-codes a dollar sign because every other
 * screen in the app is dollar-denominated. This dashboard lets you pick the
 * unit, so it needs its own pair of formatters — same em-dash-for-unknown rule,
 * different symbol.
 */

import { decimal, fixed, int } from "@finnacalc/shared/format"

/** `$1,234` — or an em dash when the figure isn't real. Never "NaN", never 0. */
export function money(value: number | null | undefined, symbol: string, fractionDigits = 0): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—"
    const magnitude = decimal(Math.abs(value), fractionDigits)
    return `${value < 0 ? "-" : ""}${symbol}${magnitude}`
}

/** `$1.04M` / `$480k` / `$920` — the same tiers as the marketing site's figures. */
export function compact(value: number | null | undefined, symbol: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—"
    const sign = value < 0 ? "-" : ""
    const magnitude = Math.abs(value)
    if (magnitude >= 1_000_000) {
        const millions = magnitude / 1_000_000
        return `${sign}${symbol}${millions >= 10 ? millions.toFixed(0) : millions.toFixed(2)}M`
    }
    if (magnitude >= 1000) {
        const thousands = magnitude / 1000
        const digits = thousands === Math.round(thousands) ? 0 : 1
        return `${sign}${symbol}${thousands.toFixed(digits)}k`
    }
    return `${sign}${symbol}${int(magnitude)}`
}

/** `12.5%`, em dash when unknown. */
export function pct(value: number | null | undefined, fractionDigits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—"
    return `${fixed(value, fractionDigits)}%`
}
