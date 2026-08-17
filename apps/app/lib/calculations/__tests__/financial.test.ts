import { describe, expect, it } from "vitest"
import {
    inflationCost,
    monthlyBurn,
    netBalance,
    project,
    realAnnualReturn,
    runwayMonths,
    savingsRate,
    spendingVelocity,
    type ModelParameters,
} from "@/lib/calculations/financial"

/**
 * These cover the cases where the maths could quietly lie: a figure that can't
 * be computed rendering as zero, inflation being applied twice, or the ledger's
 * columns not adding up to the headline balance.
 */

const BASE: ModelParameters = {
    initialPrincipal: 10_000,
    monthlyContribution: 500,
    expectedYield: 7,
    inflationRate: 2.5,
    taxBracket: 20,
    years: 10,
}

describe("project", () => {
    it("returns one point per year plus year zero", () => {
        expect(project(BASE)).toHaveLength(11)
    })

    it("starts at the initial principal with no growth", () => {
        const [start] = project(BASE)
        expect(start.year).toBe(0)
        expect(start.balance).toBe(10_000)
        expect(start.growth).toBe(0)
        expect(start.realBalance).toBe(10_000)
    })

    it("keeps the ledger's columns consistent with the balance", () => {
        for (const point of project(BASE)) {
            expect(point.contributed + point.growth).toBeCloseTo(point.balance, 6)
        }
    })

    it("discounts the real balance by exactly one deflator per year", () => {
        const series = project(BASE)
        const last = series[series.length - 1]
        expect(last.realBalance).toBeCloseTo(last.balance / Math.pow(1.025, 10), 6)
    })

    it("leaves the real balance equal to the nominal one when inflation is zero", () => {
        const series = project({ ...BASE, inflationRate: 0 })
        for (const point of series) {
            expect(point.realBalance).toBeCloseTo(point.balance, 6)
        }
    })

    it("taxes only the gain, not the principal", () => {
        const series = project({ ...BASE, taxBracket: 20 })
        const last = series[series.length - 1]
        expect(last.taxIfRealised).toBeCloseTo(last.growth * 0.2, 6)
        expect(last.taxIfRealised).toBeLessThan(last.balance)
    })

    it("charges no tax when there is no gain", () => {
        const series = project({
            ...BASE,
            expectedYield: 0,
            initialPrincipal: 0,
            taxBracket: 40,
        })
        for (const point of series) {
            expect(point.taxIfRealised).toBe(0)
        }
    })
})

describe("savingsRate", () => {
    it("is the share of income not spent", () => {
        expect(savingsRate(5000, 4000)).toBeCloseTo(20, 6)
    })

    it("goes negative when spending exceeds income", () => {
        expect(savingsRate(4000, 5000)).toBeCloseTo(-25, 6)
    })

    it("is unknown rather than zero when there is no income", () => {
        expect(savingsRate(0, 1200)).toBeNull()
    })
})

describe("burn, velocity and net", () => {
    it("never reports a negative burn", () => {
        expect(monthlyBurn(-50)).toBe(0)
    })

    it("spreads monthly spend over an average month", () => {
        expect(spendingVelocity(3044)).toBeCloseTo(100, 6)
    })

    it("reports a shortfall as a negative net, not a zero", () => {
        expect(netBalance(3000, 4200)).toBe(-1200)
    })
})

describe("runwayMonths", () => {
    it("divides the balance by the burn", () => {
        expect(runwayMonths(60_000, 5000)).toBeCloseTo(12, 6)
    })

    it("is unknown rather than infinite when nothing is being spent", () => {
        expect(runwayMonths(60_000, 0)).toBeNull()
    })
})

describe("realAnnualReturn", () => {
    it("is the effective rate — just above the stated one — with no inflation", () => {
        const rate = realAnnualReturn({ ...BASE, inflationRate: 0 })
        expect(rate).toBeGreaterThan(7)
        expect(rate).toBeLessThan(7.3)
    })

    it("falls below the stated yield once inflation is applied", () => {
        expect(realAnnualReturn(BASE)).toBeLessThan(7)
        expect(realAnnualReturn(BASE)).toBeCloseTo(4.61, 1)
    })

    it("does not move with the contributions, only the rates", () => {
        // The bug this guards against: dividing the final balance by the
        // starting one reports a rate that climbs with every deposit.
        expect(realAnnualReturn({ ...BASE, monthlyContribution: 50_000 })).toBeCloseTo(
            realAnnualReturn({ ...BASE, monthlyContribution: 0 }),
            10
        )
    })

    it("goes negative when inflation outruns the yield", () => {
        expect(realAnnualReturn({ ...BASE, expectedYield: 2, inflationRate: 6 })).toBeLessThan(0)
    })
})

describe("inflationCost", () => {
    it("is the gap between the nominal balance and its value today", () => {
        const series = project(BASE)
        const last = series[series.length - 1]
        expect(inflationCost(last)).toBeCloseTo(last.balance - last.realBalance, 6)
        expect(inflationCost(last)).toBeGreaterThan(0)
    })
})
