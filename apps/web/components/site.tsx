"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Lock, Menu, ServerCog, ShieldCheck, Smartphone, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { loginUrl, signUpUrl, appUrl } from "@/lib/app-url"
import { useSessionHint } from "@/lib/auth-handoff"
import { Button } from "@/components/ui"

/** The wordmark: "Finna" in ink, "Calc" in the brand blue. */
export function Wordmark({ className }: { className?: string }) {
    return (
        <span className={cn("font-bold tracking-tight text-foreground", className)}>
            Finna<span className="text-primary">Calc</span>
        </span>
    )
}

const NAV = [
    { href: "#calculator", label: "Calculator" },
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#security", label: "Security" },
]

export function SiteNav() {
    const [open, setOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const { signedIn, checked } = useSessionHint()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    return (
        <header
            className={cn(
                "sticky top-0 z-40 transition-colors duration-300",
                scrolled ? "border-b border-border bg-background/90 backdrop-blur" : "bg-transparent"
            )}
        >
            <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-6">
                <Link href="/" aria-label="FinnaCalc home">
                    <Wordmark className="text-2xl" />
                </Link>

                <div className="hidden items-center gap-1 md:flex">
                    {NAV.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {/* Sign-in lives on the app subdomain; this site never holds a session. */}
                    {checked && signedIn ? (
                        <a href={appUrl("/")}>
                            <Button variant="inverse" size="sm">
                                Open app
                            </Button>
                        </a>
                    ) : (
                        <>
                            <a
                                href={loginUrl()}
                                className="hidden h-10 items-center px-3 text-sm font-semibold text-foreground transition hover:text-primary sm:inline-flex"
                            >
                                Sign in
                            </a>
                            <a href={signUpUrl()}>
                                <Button size="sm">Start free</Button>
                            </a>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setOpen((current) => !current)}
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground md:hidden"
                    >
                        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </nav>

            {open && (
                <div className="border-t border-border bg-background px-6 py-4 md:hidden">
                    <div className="flex flex-col">
                        {NAV.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="rounded-md px-2 py-3 text-lg font-semibold text-muted-foreground"
                            >
                                {item.label}
                            </a>
                        ))}
                        <a href={loginUrl()} className="rounded-md px-2 py-3 text-lg font-semibold text-muted-foreground">
                            Sign in
                        </a>
                    </div>
                </div>
            )}
        </header>
    )
}

/**
 * What's actually true about how FinnaCalc handles money and data.
 *
 * Deliberately not a compliance badge grid: FinnaCalc holds no SOC 2 report
 * and no PCI attestation, and a badge claiming otherwise would be a lie told
 * to someone deciding whether to connect a bank account. Each line below is
 * something the codebase does and a reader could verify.
 */
const SECURITY_FACTS = [
    {
        icon: Lock,
        title: "Encrypted in transit",
        body: "Every request runs over TLS. Nothing is served or posted in the clear.",
    },
    {
        icon: ShieldCheck,
        title: "Bank credentials never reach us",
        body: "Bank connections run through Plaid and brokerage links through SnapTrade. Your login goes to them directly; FinnaCalc never sees or stores it.",
    },
    {
        icon: ServerCog,
        title: "Card details handled by Stripe",
        body: "Subscriptions are processed by Stripe. We learn which plan is active and nothing about your card.",
    },
    {
        icon: Smartphone,
        title: "Your budget stays on your device",
        body: "Budgets, goals and history are stored in your own browser, not on our servers. Clearing your browser data removes them.",
    },
]

export function SecurityGrid() {
    return (
        <section id="security" className="border-y border-border bg-sunken">
            <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20">
                <div className="flex max-w-2xl flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Security
                    </p>
                    <h2 className="text-[clamp(1.85rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-foreground">
                        What we can actually promise.
                    </h2>
                    <p className="text-lg leading-relaxed text-muted-foreground">
                        No badges we haven&rsquo;t earned. Here is precisely how your money data is handled,
                        and where it isn&rsquo;t handled by us at all.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {SECURITY_FACTS.map((fact) => (
                        <div
                            key={fact.title}
                            className="flex gap-4 rounded-2xl border border-border bg-card p-6"
                        >
                            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                                <fact.icon className="h-5 w-5" />
                            </span>
                            <div className="flex flex-col gap-1.5">
                                <p className="text-base font-bold text-foreground">{fact.title}</p>
                                <p className="text-sm leading-relaxed text-muted-foreground">{fact.body}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    FinnaCalc is not SOC 2 certified and holds no PCI attestation of its own; card data is
                    handled entirely by Stripe, which does. We&rsquo;d rather say that than show a badge we
                    haven&rsquo;t earned.
                </p>
            </div>
        </section>
    )
}

export function SiteFooter() {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
                <div className="flex flex-col gap-2">
                    <Wordmark className="text-2xl" />
                    <p className="text-sm text-muted-foreground">
                        Your All In One Personal Finance Platform
                    </p>
                </div>

                <FooterColumn
                    title="Product"
                    links={[
                        { href: "#calculator", label: "Calculator" },
                        { href: "#features", label: "Features" },
                        { href: "#pricing", label: "Pricing" },
                        { href: "#security", label: "Security" },
                    ]}
                />
                <FooterColumn
                    title="App"
                    links={[
                        { href: appUrl("/calculators"), label: "All calculators", external: true },
                        { href: appUrl("/budgeting"), label: "Budgeting", external: true },
                        { href: appUrl("/investing"), label: "Investing", external: true },
                        { href: appUrl("/education"), label: "Education", external: true },
                    ]}
                />
                <FooterColumn
                    title="Legal"
                    links={[
                        { href: appUrl("/privacy"), label: "Privacy policy", external: true },
                        { href: appUrl("/terms"), label: "Terms of service", external: true },
                        { href: "mailto:helpfinnacalc@gmail.com", label: "Contact", external: true },
                    ]}
                />
            </div>

            <div className="mx-auto max-w-6xl border-t border-border px-6 py-8">
                <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
                    Calculations are for informational estimates only and do not constitute formal tax,
                    legal, or financial advice. FinnaCalc is not a broker-dealer, investment adviser, or tax
                    preparer. Market data is supplied by third parties and may be delayed. Orders you place
                    are executed by your own brokerage under its terms; FinnaCalc never holds your money or
                    securities. Investing involves risk, including the possible loss of the money you
                    invest. Check anything that matters at the source before acting on it.
                </p>
            </div>
        </footer>
    )
}

function FooterColumn({
    title,
    links,
}: {
    title: string
    links: { href: string; label: string; external?: boolean }[]
}) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
            <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                    <li key={link.href}>
                        <a
                            href={link.href}
                            className="text-sm font-medium text-foreground/80 transition hover:text-foreground"
                        >
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}
