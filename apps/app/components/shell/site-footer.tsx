import Link from "next/link"
import { CALCULATORS } from "@/lib/calculators/catalog"

/**
 * The footer the site had from the start: what FinnaCalc is, the calculators
 * by group, and the company pages. Calculator links come from the catalog so
 * the list here can never name one the site does not ship.
 */
export function SiteFooter() {
    const personal = CALCULATORS.filter((entry) => entry.category !== "Business")
    const business = CALCULATORS.filter((entry) => entry.category === "Business")

    return (
        <footer className="border-t border-border bg-foreground text-background">
            <div className="mx-auto max-w-7xl px-6 py-12">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <div className="mb-4 flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/finnacalc-mark.png" alt="" className="h-6 w-auto" />
                            <span className="text-lg font-bold">FinnaCalc</span>
                        </div>
                        <p className="text-sm text-background/70">
                            Budgeting, investing, taxes, lessons and calculators, with the math shown.
                        </p>
                    </div>
                    <FooterColumn title="Calculators" links={personal.map((entry) => ({ href: `/calculators/${entry.slug}`, label: entry.shortTitle }))} />
                    <FooterColumn title="Business Tools" links={business.map((entry) => ({ href: `/calculators/${entry.slug}`, label: entry.shortTitle }))} />
                    <FooterColumn
                        title="Company"
                        links={[
                            { href: "/about", label: "About Us" },
                            { href: "/plans", label: "Plans" },
                            { href: "/privacy", label: "Privacy Policy" },
                            { href: "/terms", label: "Terms of Service" },
                        ]}
                    />
                </div>
                <div className="mt-8 border-t border-background/15 pt-8 text-center text-sm text-background/70">
                    &copy; {new Date().getFullYear()} FinnaCalc, LLC. All rights reserved.
                </div>
            </div>
        </footer>
    )
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
    return (
        <div>
            <h3 className="mb-4 font-semibold">{title}</h3>
            <ul className="space-y-2 text-sm text-background/70">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link href={link.href} className="transition hover:text-background">
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    )
}
