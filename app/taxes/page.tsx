import type { Metadata } from "next"
import Link from "next/link"
import { FileText } from "lucide-react"
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives"

export const metadata: Metadata = {
    title: "Taxes",
    description:
        "The guided federal tax estimator — real 1040 math with a live refund estimate — is coming to the web.",
}

/**
 * Taxes on the web — the placeholder card the app uses for a section whose
 * real content lands in a later pass. The estimator itself (the 1040 engine in
 * components/tax-engine) already powers the iOS app; the web interview is the
 * next piece of work rather than something we can half-show here.
 */
export default function TaxesPage() {
    return (
        <div className="mx-auto w-full max-w-2xl px-5 py-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <FileText className="h-7 w-7 text-primary" />
                        <CardTitle>Taxes</CardTitle>
                    </div>
                    <CardDescription>
                        A guided federal return with a live refund estimate, plus the tax planning
                        calculators. It runs on the same 1040 engine that powers the app — the web version of
                        the interview is being built now.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-start gap-4">
                        <Badge variant="secondary">Coming to the web</Badge>
                        <p className="text-sm text-muted-foreground">
                            It&rsquo;s an estimate for planning, not a filed return: e-filing isn&rsquo;t
                            enabled, so nothing is ever transmitted to the IRS.
                        </p>
                        <Link href="/calculators" className="text-sm font-semibold text-primary">
                            Meanwhile, run the numbers with the calculators →
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
