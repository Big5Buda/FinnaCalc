import {
    breakEven,
    cashFlow,
    compoundInterest,
    emergencyFund,
    employeeContractor,
    loan,
    pricing,
    profitMargin,
    retirement,
    roi,
    startupCost,
    type CalcResults,
    type LoanMode,
} from "@finnacalc/shared/calculators"
import type { CalculatorSlug } from "@finnacalc/shared/calculators-catalog"

/**
 * Field definitions for every calculator, driving one shared form component.
 *
 * The math itself is NOT here — every compute call goes to @finnacalc/shared,
 * the same functions the app and the iOS port run. This file only says which
 * inputs exist, their labels and sensible starting values.
 *
 * Starting values are worked examples, not suggestions: each page's results
 * panel is labelled with the assumption that produced it, and every value is
 * editable before anything is believed.
 */

export type FieldKind = "money" | "percent" | "number" | "years" | "select"

export type Field = {
    key: string
    label: string
    kind: FieldKind
    initial: number | string
    /** For selects. */
    options?: { value: string; label: string }[]
    /** Optional hint under the input. */
    hint?: string
    /** Only show when another field has one of these values. */
    showWhen?: { key: string; values: string[] }
}

export type CalculatorForm = {
    slug: CalculatorSlug
    /** The verb in "Your … calculation". */
    verb: string
    fields: Field[]
    compute: (values: Record<string, number | string>) => CalcResults
    /** What can't be computed from these inputs — shown under the results. */
    caveat: string
}

const n = (values: Record<string, number | string>, key: string): number => {
    const raw = values[key]
    const parsed = typeof raw === "number" ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : 0
}

export const CALCULATOR_FORMS: Record<CalculatorSlug, CalculatorForm> = {
    "compound-interest": {
        slug: "compound-interest",
        verb: "Compound Interest",
        fields: [
            { key: "initialDeposit", label: "Starting amount", kind: "money", initial: 5000 },
            { key: "monthlyContribution", label: "Monthly contribution", kind: "money", initial: 400 },
            { key: "annualRate", label: "Annual return", kind: "percent", initial: 7 },
            { key: "years", label: "Years", kind: "years", initial: 20 },
        ],
        compute: (v) =>
            compoundInterest({
                initialDeposit: n(v, "initialDeposit"),
                monthlyContribution: n(v, "monthlyContribution"),
                annualRate: n(v, "annualRate"),
                years: n(v, "years"),
            }),
        caveat: "A steady return compounded monthly. Real returns vary year to year and can be negative.",
    },
    loan: {
        slug: "loan",
        verb: "Loan",
        fields: [
            {
                key: "mode",
                label: "Solve for",
                kind: "select",
                initial: "payment",
                options: [
                    { value: "payment", label: "Monthly payment" },
                    { value: "apr", label: "Interest rate (APR)" },
                    { value: "remaining", label: "Remaining balance" },
                    { value: "initial", label: "Affordable amount" },
                ],
            },
            {
                key: "amount",
                label: "Loan amount",
                kind: "money",
                initial: 25000,
                showWhen: { key: "mode", values: ["payment", "apr", "remaining"] },
            },
            {
                key: "rate",
                label: "Interest rate (APR)",
                kind: "percent",
                initial: 7.5,
                showWhen: { key: "mode", values: ["payment", "remaining", "initial"] },
            },
            {
                key: "term",
                label: "Term (years)",
                kind: "years",
                initial: 5,
                hint: "Payments are monthly; the engine works in months",
            },
            {
                key: "payment",
                label: "Monthly payment",
                kind: "money",
                initial: 500,
                showWhen: { key: "mode", values: ["apr", "initial"] },
            },
            {
                key: "paymentsMade",
                label: "Payments made so far",
                kind: "number",
                initial: 12,
                showWhen: { key: "mode", values: ["remaining"] },
            },
        ],
        compute: (v) =>
            loan({
                amount: n(v, "amount"),
                rate: n(v, "rate"),
                // The shared engine amortizes in months; the field asks in years
                // because that's how people know their loans.
                term: Math.round(n(v, "term") * 12),
                paymentsMade: n(v, "paymentsMade"),
                payment: n(v, "payment"),
                mode: String(v.mode) as LoanMode,
            }),
        caveat: "Fixed-rate amortization. Fees, points and variable rates change the real cost.",
    },
    retirement: {
        slug: "retirement",
        verb: "Retirement",
        fields: [
            { key: "currentAge", label: "Current age", kind: "number", initial: 30 },
            { key: "retirementAge", label: "Retirement age", kind: "number", initial: 65 },
            { key: "currentBalance", label: "Current balance", kind: "money", initial: 25000 },
            { key: "annualSalary", label: "Annual salary", kind: "money", initial: 70000 },
            { key: "contributionPct", label: "Your contribution", kind: "percent", initial: 10 },
            {
                key: "employerMatchRate",
                label: "Employer match",
                kind: "percent",
                initial: 50,
                hint: "The share of your contribution your employer matches",
            },
            {
                key: "employerMatchCapPct",
                label: "Match cap",
                kind: "percent",
                initial: 6,
                hint: "Matched only up to this share of salary",
            },
            { key: "annualReturn", label: "Annual return", kind: "percent", initial: 7 },
        ],
        compute: (v) =>
            retirement({
                currentAge: n(v, "currentAge"),
                retirementAge: n(v, "retirementAge"),
                currentBalance: n(v, "currentBalance"),
                annualSalary: n(v, "annualSalary"),
                contributionPct: n(v, "contributionPct"),
                employerMatchRate: n(v, "employerMatchRate"),
                employerMatchCapPct: n(v, "employerMatchCapPct"),
                annualReturn: n(v, "annualReturn"),
            }),
        caveat: "Assumes steady salary and return. Raises, breaks and markets will all disagree.",
    },
    "emergency-fund": {
        slug: "emergency-fund",
        verb: "Emergency Fund",
        fields: [
            { key: "monthlyExpenses", label: "Monthly expenses", kind: "money", initial: 3500 },
            { key: "currentSavings", label: "Saved so far", kind: "money", initial: 2000 },
            {
                key: "targetType",
                label: "Target",
                kind: "select",
                initial: "months",
                options: [
                    { value: "months", label: "Months of expenses" },
                    { value: "dollar", label: "A dollar amount" },
                ],
            },
            {
                key: "months",
                label: "Months to cover",
                kind: "number",
                initial: 6,
                showWhen: { key: "targetType", values: ["months"] },
            },
            {
                key: "dollarAmount",
                label: "Target amount",
                kind: "money",
                initial: 15000,
                showWhen: { key: "targetType", values: ["dollar"] },
            },
            { key: "contribution", label: "Monthly contribution", kind: "money", initial: 300 },
            { key: "apy", label: "Savings APY", kind: "percent", initial: 4 },
        ],
        compute: (v) =>
            emergencyFund({
                monthlyExpenses: n(v, "monthlyExpenses"),
                currentSavings: n(v, "currentSavings"),
                targetType: String(v.targetType) as "months" | "dollar",
                months: n(v, "months"),
                dollarAmount: n(v, "dollarAmount"),
                contribution: n(v, "contribution"),
                apy: n(v, "apy"),
            }),
        caveat: "APY moves with rates; the months-to-goal figure assumes yours holds.",
    },
    roi: {
        slug: "roi",
        verb: "ROI",
        fields: [
            { key: "initial", label: "Amount invested", kind: "money", initial: 10000 },
            { key: "final", label: "Value now (or at exit)", kind: "money", initial: 14000 },
            { key: "years", label: "Years held", kind: "years", initial: 3 },
            { key: "inflation", label: "Inflation", kind: "percent", initial: 2.5 },
            { key: "taxRate", label: "Tax rate on gains", kind: "percent", initial: 15 },
        ],
        compute: (v) =>
            roi({
                initial: n(v, "initial"),
                final: n(v, "final"),
                years: n(v, "years"),
                inflation: n(v, "inflation"),
                taxRate: n(v, "taxRate"),
            }),
        caveat: "Return after inflation and tax — the honest version of “it doubled”.",
    },
    "profit-margin": {
        slug: "profit-margin",
        verb: "Profit Margin",
        fields: [
            { key: "revenue", label: "Revenue", kind: "money", initial: 20000 },
            { key: "cogs", label: "Cost of goods sold", kind: "money", initial: 8000 },
            { key: "opex", label: "Operating expenses", kind: "money", initial: 6000 },
            { key: "taxRate", label: "Tax rate", kind: "percent", initial: 21 },
        ],
        compute: (v) =>
            profitMargin({
                revenue: n(v, "revenue"),
                cogs: n(v, "cogs"),
                opex: n(v, "opex"),
                taxRate: n(v, "taxRate"),
            }),
        caveat: "Gross, operating and net margin from your own figures — one month or one year, your choice of window.",
    },
    "break-even": {
        slug: "break-even",
        verb: "Break-Even",
        fields: [
            { key: "fixedCosts", label: "Fixed costs (monthly)", kind: "money", initial: 5000 },
            { key: "variableCost", label: "Variable cost per unit", kind: "money", initial: 12 },
            { key: "price", label: "Price per unit", kind: "money", initial: 30 },
            {
                key: "businessType",
                label: "Business type",
                kind: "select",
                initial: "single",
                options: [
                    { value: "single", label: "One product" },
                    { value: "multi", label: "Several products (blended)" },
                ],
            },
            { key: "targetMargin", label: "Target profit margin", kind: "percent", initial: 20 },
            {
                key: "seasonality",
                label: "Seasonal swing",
                kind: "percent",
                initial: 0,
                hint: "How much a slow month dips below average",
            },
        ],
        compute: (v) =>
            breakEven({
                fixedCosts: n(v, "fixedCosts"),
                variableCost: n(v, "variableCost"),
                price: n(v, "price"),
                businessType: String(v.businessType) as "single" | "multi",
                targetMargin: n(v, "targetMargin"),
                seasonality: n(v, "seasonality"),
            }),
        caveat: "Assumes costs stay linear; volume discounts and stepped costs move the real point.",
    },
    "cash-flow": {
        slug: "cash-flow",
        verb: "Cash Flow",
        fields: [
            { key: "startingBalance", label: "Starting balance", kind: "money", initial: 20000 },
            { key: "monthlyRevenue", label: "Monthly revenue", kind: "money", initial: 12000 },
            { key: "monthlyExpenses", label: "Monthly expenses", kind: "money", initial: 14000 },
            { key: "growthRate", label: "Monthly revenue growth", kind: "percent", initial: 5 },
            { key: "period", label: "Months to project", kind: "number", initial: 12 },
        ],
        compute: (v) =>
            cashFlow({
                startingBalance: n(v, "startingBalance"),
                monthlyRevenue: n(v, "monthlyRevenue"),
                monthlyExpenses: n(v, "monthlyExpenses"),
                growthRate: n(v, "growthRate"),
                period: n(v, "period"),
            }),
        caveat: "Growth compounds monthly and expenses hold flat — both are assumptions worth stress-testing.",
    },
    "startup-cost": {
        slug: "startup-cost",
        verb: "Startup Cost",
        fields: [
            { key: "setupCosts", label: "One-time setup costs", kind: "money", initial: 15000 },
            { key: "operatingCosts", label: "Monthly operating costs", kind: "money", initial: 4000 },
            { key: "runwayMonths", label: "Months of runway wanted", kind: "number", initial: 6 },
            { key: "funding", label: "Funding available", kind: "money", initial: 25000 },
        ],
        compute: (v) =>
            startupCost({
                setupCosts: n(v, "setupCosts"),
                operatingCosts: n(v, "operatingCosts"),
                runwayMonths: n(v, "runwayMonths"),
                funding: n(v, "funding"),
            }),
        caveat: "First-year costs run over plan more often than under it. Pad accordingly.",
    },
    pricing: {
        slug: "pricing",
        verb: "Pricing",
        fields: [
            { key: "cost", label: "Your cost per unit", kind: "money", initial: 18 },
            { key: "competitorPrice", label: "Competitor's price", kind: "money", initial: 45 },
            {
                key: "positioning",
                label: "Positioning",
                kind: "select",
                initial: "match",
                options: [
                    { value: "value", label: "Undercut (value)" },
                    { value: "match", label: "Match the market" },
                    { value: "premium", label: "Premium" },
                ],
            },
            { key: "targetMargin", label: "Target margin", kind: "percent", initial: 40 },
        ],
        compute: (v) =>
            pricing({
                cost: n(v, "cost"),
                competitorPrice: n(v, "competitorPrice"),
                positioning: String(v.positioning) as "value" | "match" | "premium",
                targetMargin: n(v, "targetMargin"),
            }),
        caveat: "A starting point from costs and the market. What customers will pay is an experiment, not a formula.",
    },
    "employee-contractor": {
        slug: "employee-contractor",
        verb: "Employee vs Contractor",
        fields: [
            { key: "salary", label: "Employee salary", kind: "money", initial: 80000 },
            {
                key: "benefits",
                label: "Annual benefits cost",
                kind: "money",
                initial: 15000,
                hint: "Health, retirement match, payroll taxes and the rest",
            },
            { key: "hourlyRate", label: "Contractor hourly rate", kind: "money", initial: 85 },
            { key: "hoursPerYear", label: "Hours needed per year", kind: "number", initial: 1000 },
        ],
        compute: (v) =>
            employeeContractor({
                salary: n(v, "salary"),
                benefits: n(v, "benefits"),
                hourlyRate: n(v, "hourlyRate"),
                hoursPerYear: n(v, "hoursPerYear"),
            }),
        caveat: "Pure cost comparison. Control, continuity and classification law are the parts a calculator can't price.",
    },
}
