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
    Utilities: { icon: "Zap", tint: "#098460" },
    Food: { icon: "Utensils", tint: "#C94D0A" },
    Transportation: { icon: "Car", tint: "#5F3DC4" },
    Entertainment: { icon: "Tv", tint: "#CC4071" },
    Healthcare: { icon: "Stethoscope", tint: "#E03131" },
    Insurance: { icon: "Shield", tint: "#0D7F91" },
    "Debt Payments": { icon: "CreditCard", tint: "#AA6300" },
    Savings: { icon: "Banknote", tint: "#278639" },
    Retirement: { icon: "Hourglass", tint: "#9C36B5" },

    // Business
    "Cost of Goods Sold (COGS)": { icon: "Package", tint: "#C94D0A" },
    "Salaries/Wages": { icon: "Users", tint: "#3B5BDB" },
    "Marketing & Advertising": { icon: "Megaphone", tint: "#CC4071" },
    "Rent/Lease": { icon: "Building2", tint: "#5F3DC4" },
    "Software & Subscriptions": { icon: "Laptop", tint: "#7048E8" },
    Supplies: { icon: "Boxes", tint: "#AA6300" },
    "Repairs & Maintenance": { icon: "Wrench", tint: "#495057" },
    "Professional Fees": { icon: "Briefcase", tint: "#9C36B5" },
    Taxes: { icon: "FileText", tint: "#E03131" },
    Travel: { icon: "Plane", tint: "#278639" },
    Depreciation: { icon: "TrendingDown", tint: "#868E96" },
    "Loan Payments": { icon: "CreditCard", tint: "#AA6300" },
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
/*
 * Every entry clears 4.5:1 against the white text drawn on it — these tints
 * back the symbol monogram in components/investing/pieces.tsx as well as chart
 * slices, and axe caught seven of the originals between 2.4:1 and 3.7:1.
 * Retuning one means re-checking its contrast, not just its swatch.
 */
export const CHART_PALETTE = [
    "#3B5BDB", "#098460", "#C94D0A", "#CC4071", "#AA6300",
    "#7048E8", "#0D7F91", "#52820F", "#D6336C", "#6741D9",
    "#E03131", "#278639", "#9C36B5", "#0B7285", "#495057",
]

export function chartColor(index: number): string {
    return CHART_PALETTE[index % CHART_PALETTE.length]
}
