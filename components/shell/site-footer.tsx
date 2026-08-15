import Link from "next/link"
import { Wordmark } from "@/components/shell/wordmark"

const LINKS = [
    { href: "/plans", label: "Plans" },
    { href: "/about", label: "About" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
]

export function SiteFooter() {
    return (
        <footer className="border-t border-border bg-sunken">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <Wordmark className="text-lg" />
                    <p className="text-xs text-muted-foreground">
                        Your All In One Personal Finance Platform
                    </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
            <div className="mx-auto max-w-5xl px-5 pb-8">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    FinnaCalc is a tool, not an advisor. Calculators and estimates are for planning and
                    education, not financial, tax, or legal advice. Market data is supplied by third parties and
                    may be delayed. Check anything that matters at the source before you act on it.
                </p>
            </div>
        </footer>
    )
}
