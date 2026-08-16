/**
 * Turns a CSV bank statement into budget lines — the web twin of
 * Features/Budgeting/BankStatementParser.swift: the same column handling, the
 * same categorizer, the same conventions (negative = money out).
 */

import Papa from "papaparse"
import { categorize } from "@/lib/budget/categorizer"
import { UNDATED_MONTH, type BudgetItem, type BudgetType, type ItemType } from "@/lib/budget/types"

export type ParseResult = { items: BudgetItem[] } | { error: string }

function toNumber(raw: string): number | null {
    // Strip currency symbols, spaces and thousands separators; keep the sign,
    // including the accountant's "(12.34)" for a negative.
    const cleaned = raw.replace(/[^0-9.()-]/g, "").trim()
    if (!cleaned) return null
    const negative = cleaned.startsWith("(") && cleaned.endsWith(")")
    const value = Number.parseFloat(negative ? cleaned.slice(1, -1) : cleaned)
    if (!Number.isFinite(value)) return null
    return negative ? -value : value
}

export function parseStatement(csv: string, budgetType: BudgetType): ParseResult {
    const parsed = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true })
    const rows = (parsed.data ?? []).filter((row) => Array.isArray(row) && row.length > 0)
    if (rows.length < 2) return { error: "That CSV has no data rows." }

    const header = rows[0].map((field) => String(field ?? "").toLowerCase().trim())
    const col = (candidates: string[]) => {
        const index = header.findIndex((field) => candidates.some((candidate) => field.includes(candidate)))
        return index >= 0 ? index : null
    }

    const dateIdx = col(["date"])
    const descIdx = col(["description", "memo", "payee", "merchant", "name", "details"])
    const amountIdx = col(["amount"])
    const debitIdx = col(["debit", "withdrawal"])
    const creditIdx = col(["credit", "deposit"])

    if (amountIdx === null && debitIdx === null && creditIdx === null) {
        return {
            error: 'Couldn\'t find an amount column. Expected a header with "Amount" (or Debit/Credit).',
        }
    }

    const items: BudgetItem[] = []
    for (const row of rows.slice(1)) {
        const field = (index: number | null) =>
            index === null || index >= row.length ? "" : String(row[index] ?? "").trim()

        let amount = 0
        let type: ItemType = "income"
        if (amountIdx !== null) {
            const value = toNumber(field(amountIdx))
            if (value === null || value === 0) continue
            // Statement convention: negative = money out.
            type = value < 0 ? "expense" : "income"
            amount = Math.abs(value)
        } else {
            const debit = toNumber(field(debitIdx)) ?? 0
            const credit = toNumber(field(creditIdx)) ?? 0
            if (debit > 0) {
                type = "expense"
                amount = debit
            } else if (credit > 0) {
                type = "income"
                amount = credit
            } else {
                continue
            }
        }

        // Read the payee/memo for a real category instead of dropping every row
        // into "Other" — the list, the cap bars and the donut all group on this.
        const description = field(descIdx)
        items.push({
            id: crypto.randomUUID(),
            category: categorize(description, type, budgetType),
            subcategory: description,
            amount,
            frequency: "monthly",
            type,
            isFixed: false,
            budgetType,
            importDate: field(dateIdx) || null,
            month: UNDATED_MONTH,
        })
    }

    if (items.length === 0) return { error: "No usable rows found in that CSV." }
    return { items }
}

const DATE_PATTERNS: RegExp[] = [
    /^(\d{4})-(\d{2})-(\d{2})/, // yyyy-MM-dd
    /^(\d{4})\/(\d{2})\/(\d{2})/, // yyyy/MM/dd
]

/**
 * Statements write dates a dozen ways and a snapshot needs real ones for its
 * header. Parsed leniently; null when nothing parses.
 */
export function parseStatementDate(raw: string): Date | null {
    const trimmed = raw.slice(0, 20).trim()
    if (!trimmed) return null

    for (const pattern of DATE_PATTERNS) {
        const match = pattern.exec(trimmed)
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    }

    // M/d/yyyy, MM/dd/yy and friends.
    const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(trimmed)
    if (slash) {
        const year = Number(slash[3])
        return new Date(year < 100 ? 2000 + year : year, Number(slash[1]) - 1, Number(slash[2]))
    }

    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** The statement's own date range, for a snapshot's header. */
export function statementDateRange(items: BudgetItem[]): { start: Date; end: Date } | null {
    const dates = items
        .map((item) => (item.importDate ? parseStatementDate(item.importDate) : null))
        .filter((date): date is Date => date !== null)
    if (dates.length === 0) return null
    return {
        start: new Date(Math.min(...dates.map((d) => d.getTime()))),
        end: new Date(Math.max(...dates.map((d) => d.getTime()))),
    }
}
