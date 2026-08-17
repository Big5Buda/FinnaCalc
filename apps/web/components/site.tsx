"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { ArrowRight, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { loginUrl, signUpUrl, appUrl } from "@/lib/app-url"
import { MobileMenu, NavMenus } from "@/components/nav-menu"
import { useSessionHint } from "@/lib/auth-handoff"

/*
 * The chrome and the shared pieces of the Wealthsimple-derived system.
 *
 * Measured facts this file implements (Aug 2026 capture):
 *   - The nav is a floating white pill: #FCFCFC, radius 12px, inset from the
 *     viewport edges, 92px tall zone, hairline border. It does not go
 *     transparent over the hero — it floats above everything, always white.
 *   - Buttons are fully pill. Primary: warm black on warm white. Secondary:
 *     hairline outline, transparent fill.
 *   - Their section CTA is a 56px outlined circle with a plain arrow, not a
 *     labelled button — the headline does the talking.
 *   - The footer runs link columns, then the wordmark at container width in
 *     the serif, then a hairline, then the legal line.
 */

/** The wordmark: the serif, one weight, no colour play. The brand voice. */
export function Wordmark({ className }: { className?: string }) {
    return <span className={cn("font-serif font-semibold tracking-tight", className)}>FinnaCalc</span>
}

/** Pill button, both voices. WS: 14px/500, 12×16 padding, radius 100rem. */
export function Pill({
    href,
    children,
    tone = "primary",
    className,
}: {
    href: string
    children: ReactNode
    tone?: "primary" | "outline" | "outline-on-color"
    className?: string
}) {
    return (
        <a
            href={href}
            className={cn(
                "inline-flex items-center justify-center rounded-pill px-5 py-3 text-sm font-medium",
                "transition-colors duration-[350ms] ease-ws",
                tone === "primary" && "bg-ink text-chip hover:bg-ink-soft",
                tone === "outline" && "border border-ink text-ink hover:bg-ink/5",
                tone === "outline-on-color" && "border border-chip/80 text-chip hover:bg-chip/10",
                className
            )}
        >
            {children}
        </a>
    )
}

/**
 * The section CTA: an outlined circle with an arrow. The headline beside it
 * carries the meaning; this just says "go". aria-label carries the words the
 * visual omits.
 */
export function CircleArrow({
    href,
    label,
    onColor = false,
}: {
    href: string
    label: string
    onColor?: boolean
}) {
    return (
        <a
            href={href}
            aria-label={label}
            className={cn(
                "inline-flex h-14 w-14 items-center justify-center rounded-pill border transition-colors duration-[350ms] ease-ws",
                onColor
                    ? "border-chip/80 text-chip hover:bg-chip/10"
                    : "border-ink text-ink hover:bg-ink/5"
            )}
        >
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </a>
    )
}

/** The "Wealthsimple Portfolios"-style lockup above a section headline. */
export function SectionLockup({ suffix, onColor = false }: { suffix: string; onColor?: boolean }) {
    return (
        <p className={cn("flex items-baseline gap-2 text-lg", onColor ? "text-chip" : "text-ink")}>
            <Wordmark />
            <span className="font-sans font-normal">{suffix}</span>
        </p>
    )
}

export function SiteNav() {
    const [open, setOpen] = useState(false)
    const { signedIn, checked } = useSessionHint()

    return (
        <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-5">
            <nav className="mx-auto flex h-[52px] max-w-[1400px] items-center justify-between rounded-md border border-line bg-chip pl-5 pr-2 shadow-[0_1px_2px_rgb(28_27_27/0.04)]">
                <div className="flex items-center gap-7">
                    <Link href="/" aria-label="FinnaCalc home" className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/finnacalc-logo.png" alt="" className="h-8 w-auto" />
                        <Wordmark className="text-[22px]" />
                    </Link>

                    {/* Dropdown menus; every item is a real page on this site. */}
                    <NavMenus />
                </div>

                <div className="flex items-center gap-2">
                    {/* Sign-in lives on the app subdomain; this site never holds a session. */}
                    {checked && signedIn ? (
                        <Pill href={appUrl("/")} className="px-4 py-2">
                            Open app
                        </Pill>
                    ) : (
                        <>
                            <a
                                href={loginUrl()}
                                className="hidden items-center rounded-pill border border-ink px-4 py-2 text-sm font-medium text-ink transition-colors duration-[350ms] ease-ws hover:bg-ink/5 sm:inline-flex"
                            >
                                Log in
                            </a>
                            <Pill href={signUpUrl()} className="px-4 py-2">
                                Get started
                            </Pill>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setOpen((current) => !current)}
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-ink lg:hidden"
                    >
                        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </nav>

            {open && (
                <div className="mx-auto mt-2 max-h-[75vh] max-w-[1400px] overflow-y-auto rounded-md border border-line bg-chip px-5 py-5 lg:hidden">
                    <MobileMenu onNavigate={() => setOpen(false)} />
                    <a
                        href={loginUrl()}
                        className="mt-4 block rounded-md px-2 py-3 text-base font-medium text-ink-muted"
                    >
                        Log in
                    </a>
                </div>
            )}
        </header>
    )
}

/*
 * Footer columns. Product links scroll to this page's sections — the app
 * itself is behind sign-in, so the only app URLs left in the chrome are the
 * ones that must be readable without an account: the legal pages (a person
 * has to read terms BEFORE accepting them), About, and /migrate (a visitor
 * arrives there with data but no account yet). No Social column because
 * FinnaCalc has no social accounts to link.
 */
const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
    {
        title: "Products",
        links: [
            { href: "/calculators", label: "Calculators" },
            { href: "/budgeting", label: "Budgeting" },
            { href: "/investing", label: "Investing" },
            { href: "/taxes", label: "Taxes" },
            { href: "/education", label: "Education" },
        ],
    },
    {
        title: "Company",
        links: [
            { href: appUrl("/about"), label: "About" },
            { href: appUrl("/privacy"), label: "Privacy policy" },
            { href: appUrl("/terms"), label: "Terms of use" },
        ],
    },
    {
        title: "Support",
        links: [
            { href: "mailto:helpfinnacalc@gmail.com", label: "Contact us" },
            { href: appUrl("/migrate"), label: "Move your data" },
        ],
    },
]

export function SiteFooter() {
    return (
        <footer className="bg-paper">
            <div className="mx-auto max-w-site px-6 pb-10 pt-24">
                <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
                    {FOOTER_COLUMNS.map((column) => (
                        <div key={column.title} className="flex flex-col gap-4">
                            <p className="text-sm font-medium text-ink-muted">{column.title}</p>
                            <ul className="flex flex-col gap-3">
                                {column.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-[15px] text-ink transition-colors duration-[350ms] ease-ws hover:text-ink-muted"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* The wordmark at container width — the serif gets the last word. */}
                <p
                    aria-hidden="true"
                    className="mt-24 select-none text-center font-serif font-semibold leading-none tracking-tight text-ink"
                    style={{ fontSize: "clamp(4rem, 15.5vw, 13.75rem)" }}
                >
                    FinnaCalc
                </p>

                <hr className="mt-16 border-line" />

                <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl text-sm leading-relaxed text-ink-soft">
                        <p>© 2024–2026 FinnaCalc. All rights reserved.</p>
                        <p>
                            By using this website, you accept our{" "}
                            <a href={appUrl("/terms")} className="underline underline-offset-2">
                                Terms of Use
                            </a>{" "}
                            and{" "}
                            <a href={appUrl("/privacy")} className="underline underline-offset-2">
                                Privacy Policy
                            </a>
                            . FinnaCalc is a calculation and research tool, not an investment adviser
                            or a brokerage; orders execute at your own brokerage, and estimates are
                            not tax advice.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    )
}
