import Link from "next/link"

/**
 * The footer: what FinnaCalc is, and the company pages. The old one also
 * listed every calculator down here; the owner called that pointless, since
 * the home page is the calculators, so it is the four pages and nothing
 * else.
 *
 * It is painted in `secondary`, which is a pale band in light mode and a
 * dark one in dark mode. It used to be `bg-foreground text-background`, an
 * inverted band, and inverting means it turned WHITE in dark mode: every
 * page on the site ended in a white slab under a black page. Nothing in
 * here may use a token that flips with the scheme.
 */
export function SiteFooter() {
    return (
        <footer className="border-t border-border bg-secondary text-foreground">
            <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
                <div className="grid gap-8 sm:grid-cols-2">
                    <div>
                        <div className="mb-4 flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/finnacalc-mark.png" alt="" className="h-6 w-auto" />
                            <span className="text-lg font-bold">FinnaCalc</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Budgeting, investing, taxes, lessons and calculators, with the math shown.
                        </p>
                    </div>
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
                <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
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
            <ul className="space-y-2 text-sm text-muted-foreground">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link href={link.href} className="transition hover:text-foreground">
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    )
}
