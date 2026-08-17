/**
 * The calculator catalog — titles, summaries, categories and icons ported from
 * the iOS app's Features/Calculators/CalculatorCatalog.swift, with each SF
 * Symbol mapped to the lucide icon it approximates. One symbol per calculator:
 * the row on Home is the header on the page it opens.
 */

export type CalculatorSlug =
    | "emergency-fund"
    | "break-even"
    | "startup-cost"
    | "cash-flow"
    | "loan"
    | "pricing"
    | "roi"
    | "employee-contractor"
    | "profit-margin"
    | "retirement"
    | "compound-interest"

export type CalculatorEntry = {
    slug: CalculatorSlug
    title: string
    /** Row title — drops the redundant Calculator/Estimator/Projector suffix. */
    shortTitle: string
    summary: string
    category: "Personal Finance" | "Business" | "Loans" | "Investment"
    icon: string
}

export const CALCULATORS: CalculatorEntry[] = [
    {
        slug: "emergency-fund",
        title: "Emergency Fund Calculator",
        shortTitle: "Emergency fund",
        summary:
            "Calculate how much you need in your emergency fund and track progress toward your goal",
        category: "Personal Finance",
        icon: "LifeBuoy",
    },
    {
        slug: "break-even",
        title: "Break-Even Point Calculator",
        shortTitle: "Break-Even Point",
        summary:
            "Find out exactly how many units you need to sell to cover all costs and reach profitability",
        category: "Business",
        icon: "Equal",
    },
    {
        slug: "startup-cost",
        title: "Startup Cost Estimator",
        shortTitle: "Startup Cost",
        summary: "Estimate total startup costs with industry templates and funding gap analysis",
        category: "Business",
        icon: "Building2",
    },
    {
        slug: "cash-flow",
        title: "Cash Flow Projector",
        shortTitle: "Cash Flow",
        summary: "Project your business cash flow over time with growth rate modeling",
        category: "Business",
        icon: "LineChart",
    },
    {
        slug: "loan",
        title: "Loan Calculator",
        shortTitle: "Loan",
        summary:
            "Calculate payments, true APR, and the initial and remaining loan amount for any loan type",
        category: "Loans",
        icon: "Banknote",
    },
    {
        slug: "pricing",
        title: "Pricing Calculator",
        shortTitle: "Pricing",
        summary: "Set the right price for your products and services with competitive analysis",
        category: "Business",
        icon: "Tag",
    },
    {
        slug: "roi",
        title: "ROI Calculator",
        shortTitle: "ROI",
        summary: "Calculate annualized return on investment with inflation and tax adjustments",
        category: "Investment",
        icon: "PieChart",
    },
    {
        slug: "employee-contractor",
        title: "Employee vs Contractor Calculator",
        shortTitle: "Employee vs Contractor",
        summary: "Compare the true total cost of hiring employees versus independent contractors",
        category: "Business",
        icon: "Users",
    },
    {
        slug: "profit-margin",
        title: "Profit Margin Calculator",
        shortTitle: "Profit Margin",
        summary: "Calculate gross, operating, and net profit margins with industry benchmarks",
        category: "Business",
        icon: "Percent",
    },
    {
        slug: "retirement",
        title: "Retirement / 401(k) Calculator",
        shortTitle: "Retirement / 401(k)",
        summary: "Project your 401(k) balance at retirement, including employer match and growth",
        category: "Personal Finance",
        icon: "PersonStanding",
    },
    {
        slug: "compound-interest",
        title: "Compound Interest Calculator",
        shortTitle: "Compound interest",
        summary: "See how your savings grow over time with compound interest and contributions",
        category: "Personal Finance",
        icon: "TrendingUp",
    },
]

export function calculatorBySlug(slug: string): CalculatorEntry | undefined {
    return CALCULATORS.find((entry) => entry.slug === slug)
}
