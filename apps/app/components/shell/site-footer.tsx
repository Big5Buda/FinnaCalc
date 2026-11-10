import Link from "next/link"

/** Shared footer columns use the same shell and alignment on every page. */
export function SiteFooter() {
    return (
        <footer className="border-t border-border bg-secondary text-foreground">
            <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
                <div className="grid items-start gap-9 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
                    <div className="max-w-sm">
                        <Link href="/" aria-label="FinnaCalc home" className="inline-flex min-h-8 items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/finnacalc-mark.png" alt="" className="h-6 w-auto shrink-0" />
                            <span className="text-lg font-bold">FinnaCalc</span>
                        </Link>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            Budgeting, investing, taxes, lessons and calculators, with the math shown.
                        </p>
                    </div>
                    <nav aria-label="Footer" className="grid grid-cols-2 items-start gap-x-8 gap-y-6 sm:gap-x-16 md:min-w-[320px]">
                        <FooterColumn title="Company" links={[
                            { href: "/about", label: "About Us" },
                            { href: "/plans", label: "Plans" },
                        ]} />
                        <FooterColumn title="Legal" links={[
                            { href: "/privacy", label: "Privacy Policy" },
                            { href: "/terms", label: "Terms of Service" },
                        ]} />
                    </nav>
                </div>
                <p className="mt-9 border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
                    &copy; {new Date().getFullYear()} FinnaCalc, LLC. All rights reserved.
                </p>
            </div>
        </footer>
    )
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
    return (
        <div className="min-w-0">
            <h2 className="flex min-h-8 items-center text-sm font-semibold">{title}</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {links.map(link => <li key={link.href}><Link href={link.href} className="inline-flex min-h-9 items-center py-1 leading-6 transition hover:text-foreground focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{link.label}</Link></li>)}
            </ul>
        </div>
    )
}
