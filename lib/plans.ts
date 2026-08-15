/**
 * The three paid tiers and everything the Plans page says about them — ported
 * from Features/Plans/PlanCatalog.swift. Single source of truth for copy and
 * savings math: every savings percentage on screen is derived from these
 * numbers (house rule — no figure appears that isn't). Prices must match the
 * Stripe prices behind STRIPE_PRICE_*.
 */

export type PlanTier = "plus" | "trader" | "pro"
export type BillingInterval = "monthly" | "annual"

export type PlanBenefit = { icon: string; text: string }

export type Plan = {
    tier: PlanTier
    name: string
    tagline: string
    icon: string
    monthly: number
    annual: number
    benefits: PlanBenefit[]
    /** The visually elevated recommendation (Pro only). */
    recommended: boolean
}

/** Pro first — the recommended plan leads the page. */
export const PLANS: Plan[] = [
    {
        tier: "pro",
        name: "FinnaCalc Pro",
        tagline: "Both plans, one price",
        icon: "Sparkles",
        monthly: 16.99,
        annual: 159.99,
        benefits: [
            { icon: "PieChart", text: "Everything in Budgeting Plus" },
            { icon: "TrendingUp", text: "Everything in Investing Plus" },
            { icon: "Ban", text: "No ads" },
            { icon: "Sparkles", text: "First in line for every new feature" },
        ],
        recommended: true,
    },
    {
        tier: "plus",
        name: "Budgeting Plus",
        tagline: "Your budget keeps itself up to date",
        icon: "PieChart",
        monthly: 9.99,
        annual: 94.99,
        benefits: [
            { icon: "Landmark", text: "Bank connections that sync your budget on their own" },
            { icon: "Wand2", text: "Advanced budget analysis with follow-up chat" },
            { icon: "Target", text: "Extra goals with alerts and widgets" },
            { icon: "Ban", text: "Ad-free budgeting" },
            { icon: "BookOpen", text: "Early and exclusive lessons in Education" },
        ],
        recommended: false,
    },
    {
        tier: "trader",
        name: "Investing Plus",
        tagline: "See exactly what you own",
        icon: "TrendingUp",
        monthly: 9.99,
        annual: 94.99,
        benefits: [
            { icon: "BarChart3", text: "Portfolio Analysis: your mix, sectors, dividends, and a tax view" },
            { icon: "FileText", text: "Ten years of company financials you can actually read" },
            { icon: "Users", text: "Trade Tracker alerts for investors and insiders" },
            { icon: "Ban", text: "Ad-free investing" },
            { icon: "BookOpen", text: "Early and exclusive lessons in Education" },
        ],
        recommended: false,
    },
]

export function planFor(tier: PlanTier | null | undefined): Plan | undefined {
    return PLANS.find((plan) => plan.tier === tier)
}

export function priceFor(plan: Plan, interval: BillingInterval): number {
    return interval === "monthly" ? plan.monthly : plan.annual
}

/** What a year costs on the annual price vs. paying monthly, e.g. 33. */
export function annualSavingsPercent(plan: Plan): number {
    const yearAtMonthly = plan.monthly * 12
    if (yearAtMonthly <= 0) return 0
    return Math.round(((yearAtMonthly - plan.annual) / yearAtMonthly) * 100)
}

/** Largest annual saving across tiers — the toggle's "Save up to X%". */
export function maxAnnualSavingsPercent(): number {
    return Math.max(...PLANS.map(annualSavingsPercent))
}

/** "$16.99" — prices are catalog constants, USD only. */
export function priceString(amount: number): string {
    return amount.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

export function ctaTitle(tier: PlanTier): string {
    switch (tier) {
        case "plus":
            return "Start Budgeting Plus"
        case "trader":
            return "Start Investing Plus"
        default:
            return "Start Pro"
    }
}
