/**
 * A symbol and a tint per budget category, so lists of spending read as
 * something other than a column of identical chips. Ported from
 * Features/Budgeting/BudgetCategoryStyle.swift, with SF Symbols mapped to the
 * lucide icons they approximate.
 */

export type CategoryStyle = { icon: string; tint: string }

const TABLE: Record<string, CategoryStyle> = {
    // Personal
    Housing: { icon: "House", tint: "#3B5BDB" },
    Utilities: { icon: "Zap", tint: "#0CA678" },
    Food: { icon: "Utensils", tint: "#E8590C" },
    Transportation: { icon: "Car", tint: "#5F3DC4" },
    Entertainment: { icon: "Tv", tint: "#E64980" },
    Healthcare: { icon: "Stethoscope", tint: "#E03131" },
    Insurance: { icon: "Shield", tint: "#1098AD" },
    "Debt Payments": { icon: "CreditCard", tint: "#F08C00" },
    Savings: { icon: "Banknote", tint: "#2F9E44" },
    Retirement: { icon: "Hourglass", tint: "#9C36B5" },

    // Business
    "Cost of Goods Sold (COGS)": { icon: "Package", tint: "#E8590C" },
    "Salaries/Wages": { icon: "Users", tint: "#3B5BDB" },
    "Marketing & Advertising": { icon: "Megaphone", tint: "#E64980" },
    "Rent/Lease": { icon: "Building2", tint: "#5F3DC4" },
    "Software & Subscriptions": { icon: "Laptop", tint: "#7048E8" },
    Supplies: { icon: "Boxes", tint: "#F08C00" },
    "Repairs & Maintenance": { icon: "Wrench", tint: "#495057" },
    "Professional Fees": { icon: "Briefcase", tint: "#9C36B5" },
    Taxes: { icon: "FileText", tint: "#E03131" },
    Travel: { icon: "Plane", tint: "#2F9E44" },
    Depreciation: { icon: "TrendingDown", tint: "#868E96" },
    "Loan Payments": { icon: "CreditCard", tint: "#F08C00" },
}

/** Anything unrecognised gets the neutral pair. */
export function categoryStyle(category: string): CategoryStyle {
    return TABLE[category] ?? { icon: "RefreshCw", tint: "#64748B" }
}

/**
 * Slice colours for the budget donuts, in order. Long enough for the biggest
 * category list (business expenses, 15), so a chart showing every category
 * never repeats a colour. The first ten match the Home donut, so the two charts
 * stay one family.
 *
 * Deliberately not the per-category tints above: those repeat across Personal
 * and Business, which is fine for an icon and ambiguous for a pie slice.
 */
export const CHART_PALETTE = [
    "#3B5BDB", "#0CA678", "#E8590C", "#E64980", "#F08C00",
    "#7048E8", "#1098AD", "#74B816", "#D6336C", "#6741D9",
    "#E03131", "#2F9E44", "#9C36B5", "#0B7285", "#495057",
]

export function chartColor(index: number): string {
    return CHART_PALETTE[index % CHART_PALETTE.length]
}
