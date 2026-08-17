import { Hero } from "@/app/(marketing)/components/hero"
import {
    BudgetingSection,
    CalculatorsSection,
    CloserSection,
    EducationSection,
    InvestingSection,
    ManifestoSection,
    TaxesSection,
} from "@/app/(marketing)/components/sections"

/**
 * The landing page, on the reference's rhythm: one product per full-width
 * section, each with its own ground, cream returning between runs of colour.
 * The reference itself pairs saturated sections back-to-back (its purple
 * chequing flows straight into the brown card section), so investing (green)
 * into taxes (brown) here is the same move, not a deviation.
 *
 * hero (warm gradient) → calculators (cream, live widget) → budgeting (purple)
 * → manifesto (cream, the serif moment) → investing (green) → taxes (brown) →
 * education (yellow panel inset on cream) → close (cream).
 *
 * No pricing section: the reference's homepage doesn't sell tiers, and ours
 * doesn't either — Plans lives in the footer and the app.
 */
export default function LandingPage() {
    return (
        <>
            <Hero />
            <CalculatorsSection />
            <BudgetingSection />
            <ManifestoSection />
            <InvestingSection />
            <TaxesSection />
            <EducationSection />
            <CloserSection />
        </>
    )
}
