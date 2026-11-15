import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import TaxesPage from "@/app/taxes/page"
import { QuickTaxTool } from "@/components/tax-engine/quick-tools"
import { computeRegularTax } from "@/components/tax-engine/engine/pipeline/regularTax"
import { computeSelfEmploymentTax } from "@/components/tax-engine/engine/pipeline/scheduleSE"

it("opens Taxes with choices rather than a prefilled calculation", () => {
    const html = renderToStaticMarkup(createElement(TaxesPage))
    for (const route of ["estimator", "brackets", "self-employment"]) expect(html).toContain(`href="/taxes/${route}"`)
    expect(html).toContain("Choose a tax tool")
    expect(html).toContain("2026")
    expect(html).not.toContain("Your situation")
    expect(html).not.toContain("Estimated refund")
    expect(html).not.toContain("$1,324")
})
it.each(["brackets", "self-employment"] as const)("starts the %s tool with blank inputs and no invented result", kind => {
    const html = renderToStaticMarkup(createElement(QuickTaxTool, { kind }))
    expect(html).toContain("Your result will appear here")
    expect(html).toContain('href="/taxes"')
    expect(html).toContain('value=""')
    expect(html).toContain("Reset")
})
it("reuses the 2026 engine's ordinary-tax and Schedule SE methods", () => {
    expect(computeRegularTax(58900, "single", 2026)).toMatchObject({ tax: 7676, marginalRate: .22 })
    const se = computeSelfEmploymentTax({ taxpayer: 80000, spouse: 0 }, { taxpayer: 0, spouse: 0 }, 2026)
    expect(se.seTax).toBeCloseTo(11303.64, 2)
    expect(se.deduction).toBeCloseTo(5651.82, 2)
    expect(computeSelfEmploymentTax({ taxpayer: 80000, spouse: 0 }, { taxpayer: 184500, spouse: 0 }, 2026).seTax).toBeCloseTo(2142.52, 2)
})
