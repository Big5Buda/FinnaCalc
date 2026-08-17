"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Lock, Menu, ServerCog, ShieldCheck, Smartphone, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { loginUrl, signUpUrl, appUrl } from "@/lib/app-url"
import { useSessionHint } from "@/lib/auth-handoff"
import { Button } from "@/components/ui/button"
import { Rise, Stagger } from "@/components/motion"

/** The wordmark. Display face, and the weight contrast the system runs on. */
export function Wordmark({ className }: { className?: string }) {
    return (
        <span className={cn("font-display tracking-tight text-ink", className)}>
            <span className="font-black">Finna</span>
            <span className="font-extralight text-mint">Calc</span>
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
                scrolled ? "glass-panel border-b border-line" : "bg-transparent"
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
                            className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {/* Sign-in lives on the app subdomain; this site never holds a session. */}
                    {checked && signedIn ? (
                        <Button asChild size="sm">
                            <a href={appUrl("/")}>Open app</a>
                        </Button>
                    ) : (
                        <>
                            <a
                                href={loginUrl()}
                                className="hidden h-9 items-center px-3 text-sm font-medium text-ink transition-colors hover:text-mint sm:inline-flex"
                            >
                                Sign in
                            </a>
                            <Button asChild size="sm" className="rounded-full font-bold">
                                <a href={signUpUrl()}>Start free</a>
                            </Button>
                        </>
                    )}

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setOpen((current) => !current)}
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        className="rounded-full md:hidden"
                    >
                        {open ? <X /> : <Menu />}
                    </Button>
                </div>
            </nav>

            {open && (
                <div className="border-t border-line bg-canvas px-6 py-4 md:hidden">
                    <div className="flex flex-col">
                        {NAV.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="rounded-md px-2 py-3 text-lg font-medium text-ink-muted"
                            >
                                {item.label}
                            </a>
                        ))}
                        <a href={loginUrl()} className="rounded-md px-2 py-3 text-lg font-medium text-ink-muted">
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
 * Deliberately not a compliance badge grid: FinnaCalc holds no SOC 2 report and
 * no PCI attestation, and a badge claiming otherwise would be a lie told to
 * someone deciding whether to connect a bank account. Each line is something
 * the codebase does and a reader could verify.
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
        <section id="security" className="border-y border-line bg-mesh-surface">
            <Stagger className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
                <Rise className="flex max-w-2xl flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">Security</p>
                    <h2 className="font-display text-[clamp(2rem,4.4vw,3rem)] font-black leading-[1.04] tracking-[-0.02em] text-ink">
                        What we can actually promise.
                    </h2>
                    <p className="text-lg font-extralight leading-relaxed text-ink-muted">
                        No badges we haven&rsquo;t earned. Here is precisely how your money data is handled,
                        and where it isn&rsquo;t handled by us at all.
                    </p>
                </Rise>

                <div className="grid gap-4 sm:grid-cols-2">
                    {SECURITY_FACTS.map((fact) => (
                        <Rise key={fact.title}>
                            <div className="flex h-full gap-4 rounded-2xl border border-line bg-surface-elevated p-6">
                                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint/12 text-mint">
                                    <fact.icon className="h-5 w-5" />
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-base font-bold text-ink">{fact.title}</p>
                                    <p className="text-sm font-extralight leading-relaxed text-ink-muted">
                                        {fact.body}
                                    </p>
                                </div>
                            </div>
                        </Rise>
                    ))}
                </div>

                <Rise as="p" className="max-w-3xl text-sm font-extralight leading-relaxed text-ink-muted">
                    FinnaCalc is not SOC 2 certified and holds no PCI attestation of its own; card data is
                    handled entirely by Stripe, which does. We&rsquo;d rather say that than show a badge we
                    haven&rsquo;t earned.
                </Rise>
            </Stagger>
        </section>
    )
}

export function SiteFooter() {
    return (
        <footer className="border-t border-line bg-canvas">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
                <div className="flex flex-col gap-2">
                    <Wordmark className="text-2xl" />
                    <p className="text-sm font-extralight text-ink-muted">
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
                        { href: appUrl("/calculators"), label: "All calculators" },
                        { href: appUrl("/budgeting"), label: "Budgeting" },
                        { href: appUrl("/investing"), label: "Investing" },
                        { href: appUrl("/education"), label: "Education" },
                    ]}
                />
                <FooterColumn
                    title="Legal"
                    links={[
                        { href: appUrl("/privacy"), label: "Privacy policy" },
                        { href: appUrl("/terms"), label: "Terms of service" },
                        { href: "mailto:helpfinnacalc@gmail.com", label: "Contact" },
                    ]}
                />
            </div>

            <div className="mx-auto max-w-6xl border-t border-line px-6 py-8">
                <p className="max-w-4xl text-xs font-extralight leading-relaxed text-ink-muted">
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

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">{title}</p>
            <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                    <li key={link.href}>
                        <a
                            href={link.href}
                            className="text-sm font-light text-ink/80 transition-colors hover:text-mint"
                        >
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}
