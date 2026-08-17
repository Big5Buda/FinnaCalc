/**
 * Calculator math, ported 1:1 from the iOS app's Features/Calculators/*.swift
 * (which in turn came from this site's original calculators). Each function
 * returns the same labelled, colour-coded metrics the app shows, or `null`
 * when the inputs can't be computed — the screens then show the explanation
 * instead of rendering NaN.
 */

import { count, currency, percent } from "./format"

export type CalcAccent = "green" | "blue" | "red" | "purple" | "orange"

export type CalcMetric = {
    label: string
    value: string
    accent: CalcAccent
}

export type CalcResults = CalcMetric[] | null

// MARK: - Emergency fund

export function emergencyFund(input: {
    monthlyExpenses: number
    currentSavings: number
    targetType: "months" | "dollar"
    months: number
    dollarAmount: number
    contribution: number
    apy: number
}): CalcResults {
    const target = input.targetType === "months" ? input.monthlyExpenses * input.months : input.dollarAmount
    if (!(target > 0)) return null

    const remaining = Math.max(0, target - input.currentSavings)
    const progress = Math.min(100, (input.currentSavings / target) * 100)

    let balance = input.currentSavings
    let monthsToGoal: number | null
    const monthlyRate = input.apy / 100 / 12
    if (balance >= target) {
        monthsToGoal = 0
    } else if (input.contribution <= 0) {
        // No contribution means the goal is never reached.
        monthsToGoal = null
    } else {
        let elapsed = 0
        while (balance < target && elapsed < 1200) {
            balance = balance * (1 + monthlyRate) + input.contribution
            elapsed += 1
        }
        monthsToGoal = balance >= target ? elapsed : null
    }

    return [
        { label: "Target emergency fund", value: currency(target), accent: "green" },
        { label: "Still needed", value: currency(remaining), accent: "red" },
        {
            label: "Months to reach goal",
            value: monthsToGoal === null ? "Add a contribution" : `${monthsToGoal} mo`,
            accent: "blue",
        },
        { label: "Progress today", value: percent(progress, 0), accent: "orange" },
    ]
}

// MARK: - Compound interest

export function compoundInterest(input: {
    initialDeposit: number
    monthlyContribution: number
    annualRate: number
    years: number
}): CalcResults {
    if (!(input.initialDeposit > 0 || input.monthlyContribution > 0) || !(input.years > 0)) return null

    const months = Math.round(input.years * 12)
    const monthlyRate = input.annualRate / 100 / 12
    let balance = input.initialDeposit
    for (let i = 0; i < months; i++) {
        balance = balance * (1 + monthlyRate) + input.monthlyContribution
    }

    const totalContributions = input.initialDeposit + input.monthlyContribution * months
    const totalInterest = balance - totalContributions
    const growthPct = totalContributions > 0 ? (totalInterest / totalContributions) * 100 : 0

    return [
        { label: "Final balance", value: currency(balance), accent: "green" },
        { label: "Total contributions", value: currency(totalContributions), accent: "blue" },
        { label: "Interest earned", value: currency(Math.max(0, totalInterest)), accent: "purple" },
        { label: "Total growth", value: percent(growthPct, 1), accent: "orange" },
    ]
}

// MARK: - Retirement / 401(k)

export function retirement(input: {
    currentAge: number
    retirementAge: number
    currentBalance: number
    annualSalary: number
    contributionPct: number
    employerMatchRate: number
    employerMatchCapPct: number
    annualReturn: number
}): CalcResults {
    const years = input.retirementAge - input.currentAge
    if (!(years > 0) || !(input.annualSalary > 0)) return null

    const yourAnnual = input.annualSalary * (input.contributionPct / 100)
    const matchedPct = Math.min(input.contributionPct, input.employerMatchCapPct)
    const employerAnnual = input.annualSalary * (matchedPct / 100) * (input.employerMatchRate / 100)

    let balance = input.currentBalance
    let totalYours = 0
    let totalEmployer = 0
    const yearCount = Math.ceil(years)
    for (let i = 0; i < yearCount; i++) {
        balance += yourAnnual + employerAnnual
        balance *= 1 + input.annualReturn / 100
        totalYours += yourAnnual
        totalEmployer += employerAnnual
    }

    const totalContributed = input.currentBalance + totalYours + totalEmployer
    const totalGrowth = balance - totalContributed

    return [
        { label: "Projected balance at retirement", value: currency(balance), accent: "green" },
        { label: "Your total contributions", value: currency(totalYours), accent: "blue" },
        { label: "Employer match total", value: currency(totalEmployer), accent: "purple" },
        { label: "Investment growth earned", value: currency(Math.max(0, totalGrowth)), accent: "orange" },
    ]
}

// MARK: - ROI

export function roi(input: {
    initial: number
    final: number
    years: number
    inflation: number
    taxRate: number
}): CalcResults {
    if (!(input.initial > 0)) return null
    const totalReturn = input.final - input.initial
    const totalROI = (totalReturn / input.initial) * 100
    const annualized = (Math.pow(input.final / input.initial, 1 / Math.max(input.years, 0.1)) - 1) * 100
    const afterTax = totalReturn * (1 - input.taxRate / 100)
    const real = annualized - input.inflation
    return [
        { label: "Total ROI", value: percent(totalROI, 1), accent: "green" },
        { label: "Annualized return", value: percent(annualized, 1), accent: "blue" },
        { label: "Inflation-adjusted return", value: percent(real, 1), accent: "orange" },
        { label: "After-tax gain", value: currency(afterTax, 2), accent: "purple" },
    ]
}

// MARK: - Profit margin

export function profitMargin(input: {
    revenue: number
    cogs: number
    opex: number
    taxRate: number
}): CalcResults {
    if (!(input.revenue > 0)) return null
    const gross = input.revenue - input.cogs
    const grossMargin = (gross / input.revenue) * 100
    const operating = gross - input.opex
    const operatingMargin = (operating / input.revenue) * 100
    const net = operating * (1 - input.taxRate / 100)
    const netMargin = (net / input.revenue) * 100
    return [
        { label: "Net margin", value: percent(netMargin, 1), accent: "green" },
        { label: "Gross margin", value: percent(grossMargin, 1), accent: "blue" },
        { label: "Operating margin", value: percent(operatingMargin, 1), accent: "purple" },
        { label: "Net profit", value: currency(net), accent: "orange" },
    ]
}

// MARK: - Break-even

export function breakEven(input: {
    fixedCosts: number
    variableCost: number
    price: number
    businessType: "single" | "multi"
    targetMargin: number
    seasonality: number
}): CalcResults {
    const variable = input.businessType === "multi" ? input.variableCost * 1.05 : input.variableCost
    const contributionMargin = input.price - variable
    if (!(contributionMargin > 0) || !(input.fixedCosts > 0)) return null

    const beUnits = input.fixedCosts / contributionMargin
    const beRevenue = beUnits * input.price
    const denominator = contributionMargin - (input.targetMargin / 100) * input.price
    const targetUnits = denominator > 0 ? input.fixedCosts / denominator : null
    const seasonUnits = beUnits * (1 + input.seasonality / 100)

    return [
        { label: "Break-even units / month", value: `${count(Math.ceil(beUnits))} units`, accent: "green" },
        { label: "Break-even revenue", value: currency(beRevenue), accent: "blue" },
        {
            label: "Units for target margin",
            value: targetUnits === null ? "Not achievable" : `${count(Math.ceil(targetUnits))} units`,
            accent: targetUnits === null ? "red" : "orange",
        },
        {
            label: "Seasonality-adjusted units",
            value: `${count(Math.ceil(seasonUnits))} units`,
            accent: "purple",
        },
    ]
}

// MARK: - Cash flow

export function cashFlow(input: {
    startingBalance: number
    monthlyRevenue: number
    monthlyExpenses: number
    growthRate: number
    period: number
}): CalcResults {
    if (!(input.monthlyRevenue > 0 || input.monthlyExpenses > 0)) return null
    let balance = input.startingBalance
    let revenue = input.monthlyRevenue
    let lowest = balance
    let netTotal = 0
    for (let i = 0; i < Math.trunc(input.period); i++) {
        const net = revenue - input.monthlyExpenses
        balance += net
        netTotal += net
        if (balance < lowest) lowest = balance
        revenue *= 1 + input.growthRate / 100
    }
    return [
        { label: "Ending cash balance", value: currency(balance), accent: "green" },
        { label: "Total net cash flow", value: currency(netTotal), accent: "blue" },
        {
            label: "Lowest projected balance",
            value: currency(lowest),
            accent: lowest < 0 ? "red" : "purple",
        },
    ]
}

// MARK: - Startup cost

export function startupCost(input: {
    setupCosts: number
    operatingCosts: number
    runwayMonths: number
    funding: number
}): CalcResults {
    if (!(input.setupCosts > 0 || input.operatingCosts > 0)) return null
    const total = input.setupCosts + input.operatingCosts * input.runwayMonths
    const gap = total - input.funding
    return [
        { label: "Total startup cost", value: currency(total), accent: "green" },
        {
            label: gap > 0 ? "Funding gap" : "Funding surplus",
            value: currency(Math.abs(gap)),
            accent: gap > 0 ? "red" : "blue",
        },
        {
            label: "Runway reserve needed",
            value: currency(input.operatingCosts * input.runwayMonths),
            accent: "purple",
        },
    ]
}

// MARK: - Pricing

export function pricing(input: {
    cost: number
    competitorPrice: number
    positioning: "value" | "match" | "premium"
    targetMargin: number
}): CalcResults {
    if (!(input.cost > 0)) return null
    const minPrice = input.targetMargin < 100 ? input.cost / (1 - input.targetMargin / 100) : input.cost * 2
    let positionedPrice = input.competitorPrice
    if (input.positioning === "premium") positionedPrice = input.competitorPrice * 1.1
    else if (input.positioning === "value") positionedPrice = input.competitorPrice * 0.9
    const recommended = Math.max(minPrice, positionedPrice)
    return [
        { label: "Recommended price", value: currency(recommended, 2), accent: "green" },
        { label: "Minimum viable price", value: currency(minPrice, 2), accent: "blue" },
        { label: "Profit per unit", value: currency(recommended - input.cost, 2), accent: "purple" },
    ]
}

// MARK: - Employee vs contractor

export function employeeContractor(input: {
    salary: number
    benefits: number
    hourlyRate: number
    hoursPerYear: number
}): CalcResults {
    if (!(input.salary > 0 || input.hourlyRate > 0)) return null
    const employeeCost = input.salary * (1 + input.benefits / 100)
    const contractorCost = input.hourlyRate * input.hoursPerYear
    const difference = employeeCost - contractorCost
    return [
        { label: "Lower total cost", value: difference > 0 ? "Contractor" : "Employee", accent: "green" },
        { label: "Total employee cost", value: currency(employeeCost), accent: "blue" },
        { label: "Total contractor cost", value: currency(contractorCost), accent: "purple" },
        { label: "Annual savings", value: currency(Math.abs(difference)), accent: "orange" },
    ]
}

// MARK: - Loan

export type LoanMode = "payment" | "apr" | "remaining" | "initial"

/**
 * Solves the annualised rate (in %) at which the payment stream's present
 * value equals the amount borrowed, by bisection. Present value is strictly
 * decreasing in the rate, so the root is unique.
 *
 * Returns null when the payments never repay the principal — at 0% the
 * borrower would still owe money at the end, so there is no solution.
 */
function solveRate(principal: number, monthlyPayment: number, months: number): number | null {
    if (!(principal > 0) || !(monthlyPayment > 0) || monthlyPayment * months < principal) return null
    // Payments that exactly repay the principal are 0% financing, common on
    // promotional auto loans. Bisection can't return it: zero is its lower bound.
    if (monthlyPayment * months - principal < 0.005) return 0

    const presentValue = (rate: number) =>
        rate === 0 ? monthlyPayment * months : (monthlyPayment * (1 - Math.pow(1 + rate, -months))) / rate

    let lo = 0
    let hi = 1
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2
        if (presentValue(mid) > principal) lo = mid
        else hi = mid
    }
    return ((lo + hi) / 2) * 1200
}

export function loan(input: {
    amount: number
    rate: number
    term: number
    paymentsMade: number
    payment: number
    mode: LoanMode
}): CalcResults {
    const r = input.rate / 100 / 12
    const n = input.term
    if (!(n > 0)) return null

    // APR is the rate solved from the other three.
    if (input.mode === "apr") {
        if (!(input.amount > 0) || !(input.payment > 0)) return null
        const apr = solveRate(input.amount, input.payment, n)
        if (apr === null) return null
        const total = input.payment * n
        return [
            { label: "APR", value: percent(apr, 2), accent: "green" },
            { label: "Monthly payment", value: currency(input.payment, 2), accent: "blue" },
            { label: "Total paid", value: currency(total, 2), accent: "purple" },
            { label: "Total interest", value: currency(total - input.amount, 2), accent: "red" },
        ]
    }

    // Initial runs backwards from the other three: the principal is the unknown.
    if (input.mode === "initial") {
        if (!(input.payment > 0)) return null
        const principal =
            r === 0 ? input.payment * n : (input.payment * (1 - Math.pow(1 + r, -n))) / r
        const total = input.payment * n
        return [
            { label: "Initial loan amount", value: currency(principal, 2), accent: "purple" },
            { label: "Monthly payment", value: currency(input.payment, 2), accent: "green" },
            { label: "Total paid", value: currency(total, 2), accent: "blue" },
            { label: "Total interest", value: currency(total - principal, 2), accent: "red" },
        ]
    }

    const P = input.amount
    if (!(P > 0)) return null
    const pmt = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)

    if (input.mode === "remaining") {
        const k = Math.min(Math.max(Math.floor(input.paymentsMade), 0), n)
        const remaining =
            r === 0 ? P - pmt * k : P * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r)
        const clamped = Math.max(0, remaining)
        return [
            { label: "Initial amount", value: currency(P, 2), accent: "purple" },
            {
                label: `Remaining balance (${count(k)} of ${count(n)} mo)`,
                value: currency(clamped, 2),
                accent: "green",
            },
            { label: "Principal paid off", value: currency(P - clamped, 2), accent: "blue" },
            { label: "Payments made", value: `${count(k)} of ${count(n)}`, accent: "orange" },
        ]
    }

    const total = pmt * n
    return [
        { label: "Monthly payment", value: currency(pmt, 2), accent: "green" },
        { label: "Total paid", value: currency(total, 2), accent: "blue" },
        { label: "Total interest", value: currency(total - P, 2), accent: "red" },
        { label: "Principal financed", value: currency(P, 2), accent: "purple" },
    ]
}

/**
 * Compound growth year by year, on the same monthly compounding
 * `compoundInterest` uses.
 *
 * Lives here so the marketing hero, the landing widget and the app's
 * calculator screen all draw the same curve from the same arithmetic. Two
 * implementations of this drift, and then the site shows one number while the
 * product shows another.
 */
export type GrowthPoint = {
    year: number
    /** Everything paid in so far, including the opening deposit. */
    contributed: number
    /** Balance at the end of that year. */
    balance: number
    /** balance − contributed. Negative is impossible with a non-negative rate. */
    growth: number
}

export function compoundInterestSeries(input: {
    initialDeposit: number
    monthlyContribution: number
    annualRate: number
    years: number
}): GrowthPoint[] {
    const monthlyRate = input.annualRate / 100 / 12
    let balance = input.initialDeposit
    const points: GrowthPoint[] = [
        {
            year: 0,
            contributed: input.initialDeposit,
            balance: input.initialDeposit,
            growth: 0,
        },
    ]

    for (let year = 1; year <= Math.max(0, Math.round(input.years)); year++) {
        for (let month = 0; month < 12; month++) {
            balance = balance * (1 + monthlyRate) + input.monthlyContribution
        }
        const contributed = input.initialDeposit + input.monthlyContribution * 12 * year
        points.push({ year, contributed, balance, growth: balance - contributed })
    }

    return points
}

/**
 * The first year compounding has added more than the saver has paid in — the
 * point where the returns are doing more work than the deposits. null when it
 * doesn't happen inside the window, which is the common case at low rates or
 * short horizons, and saying so is better than implying it always arrives.
 */
export function crossoverYear(series: GrowthPoint[]): number | null {
    const hit = series.find((point) => point.year > 0 && point.growth > point.contributed)
    return hit ? hit.year : null
}
