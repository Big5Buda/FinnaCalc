import type { Metadata } from "next"
import { PageBar, PageBody } from "@/components/shell/surface"
import { CalculatorWorkspace } from "./components/workspace"

export const metadata: Metadata = {
    title: "Modelling workspace",
    description:
        "Model a long-horizon contribution with inflation and tax applied, and read the year-by-year arithmetic behind the answer.",
}

/**
 * The modelling workspace.
 *
 * Deeper than the single-purpose calculators at /calculators: those answer one
 * question each, this one holds a whole model open — parameters on the left,
 * what they produce in the middle, and the year-by-year working on the right,
 * all live as you drag.
 *
 * The page itself stays a server component so the metadata above ships with the
 * route; the interactive shell is one client boundary below.
 */
export default function CalculatorPage() {
    return (
        <>
            <PageBar back={{ href: "/calculators", label: "Calculators" }} title="Modelling workspace" />
            <PageBody className="max-w-[1600px]">
                <p className="max-w-2xl pb-6 text-sm text-muted-foreground">
                    Set the assumptions, and watch what they compound into, with inflation and tax
                    applied and every year&rsquo;s arithmetic shown rather than summarised.
                </p>

                <CalculatorWorkspace />
            </PageBody>
        </>
    )
}
