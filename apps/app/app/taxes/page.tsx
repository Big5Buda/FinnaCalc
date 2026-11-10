import Link from "next/link"
import { Calculator, Receipt, BriefcaseBusiness, ArrowRight } from "lucide-react"
import { SUPPORTED_TAX_YEAR } from "@/components/tax-engine/engine/constants/taxRules"
import { PageBar, PageBody } from "@/components/shell/surface"

export default function TaxesPage() {
    const tools = [
        { href: "/taxes/estimator", title: "Federal tax estimator", text: "Estimate federal tax and a refund or balance due using your income, withholding and eligible deductions.", Icon: Receipt },
        { href: "/taxes/brackets", title: "Tax bracket calculator", text: "Find the ordinary income tax and marginal rate for a taxable income amount.", Icon: Calculator },
        { href: "/taxes/self-employment", title: "Self-employment tax calculator", text: "Estimate Schedule SE tax and its deductible portion from your net profit and W-2 Social Security wages.", Icon: BriefcaseBusiness },
    ]
    return <><PageBar title={`Taxes · ${SUPPORTED_TAX_YEAR}`} /><PageBody className="flex flex-col gap-8">
        <header className="max-w-3xl"><h2 className="text-2xl font-semibold sm:text-3xl">Choose a tax tool</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explore estimators and calculators for tax year {SUPPORTED_TAX_YEAR}. Start with your own figures; all tools cover federal taxes.</p></header>
        <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{tools.map(({ href, title, text, Icon }) => <Link key={href} href={href} className="group flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 transition hover:border-primary/60 hover:shadow-md"><span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-6 w-6" /></span><div className="flex-1"><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p></div><span className="flex items-center gap-2 text-sm font-semibold text-primary">Open tool<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>)}</div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">These tools provide estimates for planning. They do not prepare or file a return, and each tool explains what its calculation includes.</p>
    </PageBody></>
}
