/**
 * The modelling maths behind the calculator dashboard.
 *
 * Everything here is defined rather than assumed: each figure says what it
 * measures and over what window, because "burn" and "velocity" mean different
 * things at different companies and a KPI whose definition is guessed at is
 * worse than no KPI. Where a figure can't be computed the function returns
 * null, and the UI shows a dash — never a zero standing in for "unknown".
 *
 * Compound growth itself is NOT reimplemented here. It lives in
 * @finnacalc/shared alongside the calculator screens and the marketing site,
 * so a projection on this page and the same projection on /calculators agree.
 */

import { compoundInterestSeries, type GrowthPoint } from "@finnacalc/shared/calculators"

export type ModelParameters = {
    /** What's invested on day one. */
    initialPrincipal: number
    monthlyContribution: number
    /** Nominal annual return, before inflation and tax, as a percent. */
    expectedYield: number
    /** Annual inflation, as a percent. Used to express results in today's money. */
    inflationRate: number
    /** Marginal rate applied to gains when they're realised, as a percent. */
    taxBracket: number
    years: number
}

export type ProjectionPoint = GrowthPoint & {
    /** Balance restated in today's money: nominal ÷ (1 + inflation)^year. */
    realBalance: number
    /** Tax owed if the whole gain were realised that year, at the marginal rate. */
    taxIfRealised: number
    /** Real balance after that tax — the honest "what you'd keep" figure. */
    afterTaxReal: number
    /** Growth added during this year alone, not cumulative. */
    interestThisYear: number
}

/**
 * The full year-by-year projection: nominal growth from the shared engine, then
 * inflation and tax applied on top.
 *
 * Inflation is applied as a deflator rather than by reducing the return, so the
 * nominal column still matches what a brokerage statement would show and the
 * real column is visibly derived from it.
 */
export function project(parameters: ModelParameters): ProjectionPoint[] {
    const nominal = compoundInterestSeries({
        initialDeposit: parameters.initialPrincipal,
        monthlyContribution: parameters.monthlyContribution,
        annualRate: parameters.expectedYield,
        years: parameters.years,
    })

    const deflator = 1 + parameters.inflationRate / 100
    const taxRate = parameters.taxBracket / 100

    return nominal.map((point, index) => {
        const realBalance = point.balance / Math.pow(deflator, point.year)
        const taxIfRealised = Math.max(0, point.growth) * taxRate
        const previous = index > 0 ? nominal[index - 1] : null
        return {
            ...point,
            realBalance,
            taxIfRealised,
            afterTaxReal: (point.balance - taxIfRealised) / Math.pow(deflator, point.year),
            interestThisYear: previous
                ? point.balance - previous.balance - parameters.monthlyContribution * 12
                : 0,
        }
    })
}

/**
 * Share of income kept rather than spent, as a percent.
 *
 * null when there's no income: a savings rate off zero income is a division by
 * zero, not a 0%.
 */
export function savingsRate(monthlyIncome: number, monthlyExpenses: number): number | null {
    if (!(monthlyIncome > 0)) return null
    return ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
}

/**
 * Monthly burn: what leaves each month. Stated as its own figure rather than
 * folded into the savings rate, because a business with no income still has a
 * burn and needs to see it.
 */
export function monthlyBurn(monthlyExpenses: number): number {
    return Math.max(0, monthlyExpenses)
}

/**
 * Spending velocity — the average rate money leaves, per day.
 *
 * Defined explicitly because "velocity" is used loosely elsewhere to mean
 * turnover, momentum, or month-over-month change. Here it is simply monthly
 * spend spread over an average month (30.44 days), which is the reading that
 * makes it comparable to a daily allowance.
 */
export function spendingVelocity(monthlyExpenses: number): number {
    return monthlyExpenses / 30.44
}

/** What's left each month: income minus expenses. Negative is a real answer. */
export function netBalance(monthlyIncome: number, monthlyExpenses: number): number {
    return monthlyIncome - monthlyExpenses
}

/**
 * Months of expenses the modelled balance would cover — the runway a founder
 * actually asks about. null when nothing is being spent, since dividing by zero
 * burn implies infinite runway and saying "∞" would be a claim, not a figure.
 */
export function runwayMonths(balance: number, monthlyExpenses: number): number | null {
    if (!(monthlyExpenses > 0)) return null
    return balance / monthlyExpenses
}

/**
 * The real (inflation-adjusted) annual return, as a percent.
 *
 * Deliberately NOT a CAGR of the final balance over the starting one: with
 * monthly contributions, most of the ending balance is money that was paid in,
 * not return, and dividing one by the other reports a rate several times the
 * real one. That figure looks authoritative and is wrong, which is the worst
 * combination a dashboard can produce.
 *
 * What this returns instead is the stated yield compounded monthly (the
 * effective annual rate the projection actually applies), then deflated by
 * inflation — the Fisher relation, ((1 + r) / (1 + i)) - 1. It's independent of
 * how much is contributed and when, which is what makes it comparable.
 */
export function realAnnualReturn(parameters: ModelParameters): number {
    const effective = Math.pow(1 + parameters.expectedYield / 100 / 12, 12) - 1
    return ((1 + effective) / (1 + parameters.inflationRate / 100) - 1) * 100
}

/** What inflation quietly removed: nominal balance minus its value in today's money. */
export function inflationCost(point: ProjectionPoint): number {
    return point.balance - point.realBalance
}
