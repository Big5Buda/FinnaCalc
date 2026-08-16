import Link from "next/link"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * The footer, in the marketing layout language: link columns by section, the
 * wordmark and motto, then the disclosure. The disclosure stays verbatim —
 * it's the one block on the page that must not be shortened for rhythm.
 */
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
    {
        title: "Money",
        links: [
            { href: "/budgeting", label: "Budgeting" },
            { href: "/budgeting/goals", label: "Goals" },
            { href: "/budgeting/analysis", label: "Budget analysis" },
            { href: "/budgeting/subscriptions", label: "Subscriptions" },
        ],
    },
    {
        title: "Investing",
        links: [
            { href: "/investing", label: "Markets" },
            { href: "/investing/portfolio", label: "Portfolio" },
            { href: "/investing/watchlist", label: "Watchlist" },
            { href: "/investing/screener", label: "Screener" },
            { href: "/investing/tracker", label: "Trade Tracker" },
        ],
    },
    {
        title: "Tools",
        links: [
            { href: "/calculators", label: "All calculators" },
            { href: "/calculators/loan", label: "Loan calculator" },
            { href: "/calculators/retirement", label: "Retirement" },
            { href: "/taxes", label: "Taxes" },
        ],
    },
    {
        title: "Company",
        links: [
            { href: "/education", label: "Education" },
            { href: "/plans", label: "Plans" },
            { href: "/about", label: "About" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
        ],
    },
]

export function SiteFooter() {
    return (
        <footer className="border-t border-border bg-sunken">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
                <div className="flex flex-col gap-2">
                    <Wordmark className="text-2xl" />
                    <p className="text-sm text-muted-foreground">
                        Your All In One Personal Finance Platform
                    </p>
                </div>

                {COLUMNS.map((column) => (
                    <div key={column.title} className="flex flex-col gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            {column.title}
                        </p>
                        <ul className="flex flex-col gap-2.5">
                            {column.links.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm font-medium text-foreground/80 transition hover:text-foreground"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="mx-auto max-w-6xl border-t border-border px-6 py-8">
                <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
                    FinnaCalc is a tool, not an advisor. Calculators and estimates are for planning and
                    education, not financial, tax, or legal advice. Market data is supplied by third parties
                    and may be delayed. Orders you place are executed by your own brokerage under its terms;
                    FinnaCalc never holds your money or securities. Check anything that matters at the source
                    before you act on it.
                </p>
            </div>
        </footer>
    )
}
