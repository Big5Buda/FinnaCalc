import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { calculateQuickTax, emptyQuickTaxForm } from "../quick-tax-estimate"
import { QuickTaxEstimator } from "@/components/tax-engine/quick-estimator"

describe("blank, explicitly submitted federal estimate", () => {
    it("starts without sample figures or a selected filing status", () => {
        const form = emptyQuickTaxForm()
        expect(form.filingStatus).toBe("")
        expect(form.wages).toBe("")
        expect(form.withheld).toBe("")
        const html = renderToStaticMarkup(createElement(QuickTaxEstimator))
        expect(html).toContain("Your estimate will appear here")
        expect(html).toContain('value="" disabled="" selected=""')
        expect(html).not.toContain("Estimated refund")
        expect(html).not.toContain('value="75000"')
        expect(html).not.toContain('value="9000"')
        expect(html).not.toContain("$1,324")
        expect(html).toContain("Calculate estimate")
        expect(html).toContain("Reset")
    })
    it("requires filing status rather than silently assuming Single", () => expect(() => calculateQuickTax(emptyQuickTaxForm())).toThrow("Choose your filing status"))
    it("preserves the previously verified 2026 calculation when the user actually enters it", () => {
        const result = calculateQuickTax({ ...emptyQuickTaxForm(), filingStatus: "single", wages: "75000", withheld: "9000" })
        expect(result).toMatchObject({ taxYear: 2026, totalIncome: 75000, taxableIncome: 58900, totalTax: 7676, refundOrOwed: 1324 })
    })
    it("accepts formatted dollars and cents without silently changing their amount", () => {
        const result = calculateQuickTax({ ...emptyQuickTaxForm(), filingStatus: "single", wages: "$75,000.00", withheld: "9,000", interest: ".50" })
        expect(result.totalIncome).toBe(75001) // Existing IRS whole-dollar line rounding.
    })
    it("still maps qualifying children to the existing credit rules", () => {
        const r = calculateQuickTax({ ...emptyQuickTaxForm(), filingStatus: "single", wages: "75000", dependents: "2" })
        expect(r.nonrefundableCredits.childTaxCredit).toBe(4400)
    })
    it.each(["-100", "1.2.3", "NaN", "Infinity", "1000000001", "75,,000", "75,00", "1.001"])("rejects invalid amounts instead of producing an estimate: %s", wages => expect(() => calculateQuickTax({ ...emptyQuickTaxForm(), filingStatus: "single", wages })).toThrow())
    it.each([{ dependents: "1.5" }, { dependents: "100" }, { age: "65.5" }, { age: "121" }])("rejects invalid age/dependent counts %j", input => expect(() => calculateQuickTax({ ...emptyQuickTaxForm(), filingStatus: "single", ...input })).toThrow())
    it("allows an intentionally submitted zero-income return without preset income", () => {
        expect(calculateQuickTax({ ...emptyQuickTaxForm(), filingStatus: "single" })).toMatchObject({ totalIncome: 0, totalTax: 0, refundOrOwed: 0 })
    })
})
