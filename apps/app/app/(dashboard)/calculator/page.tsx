import type { Metadata } from "next"
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
        <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
            <header className="flex flex-col gap-2 pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Modelling workspace
                </h1>
                <p className="max-w-2xl text-body">
                    Set the assumptions, and watch what they compound into — with inflation and tax
                    applied, and every year&rsquo;s arithmetic shown rather than summarised.
                </p>
            </header>

            <CalculatorWorkspace />
        </main>
    )
}
