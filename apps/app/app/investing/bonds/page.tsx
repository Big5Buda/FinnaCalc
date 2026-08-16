import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/primitives"

export const metadata: Metadata = {
    title: "Bonds",
    description: "Bond investing on FinnaCalc.",
}

/**
 * Bonds, as the app has it: a short informational page. The bond ETFs on the
 * ETFs page (AGG, BND) are the part that actually trades today, so this links
 * there rather than pretending to more than it has.
 */
export default function BondsPage() {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-6">
            <Link href="/investing" className="text-sm font-semibold text-primary">
                ← Investing
            </Link>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">Bonds</h1>

            <Card>
                <CardContent className="pt-6">
                    <p className="text-base text-foreground">Content about bond investing will go here.</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Until then, the broad bond funds are on the{" "}
                        <Link href="/investing/etfs" className="font-semibold text-primary">
                            ETFs &amp; index funds
                        </Link>{" "}
                        page — AGG and BND both trade like any other ticker here, with a live chart and the
                        same filings view.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
