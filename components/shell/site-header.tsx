"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowUp, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { useChat } from "@/components/providers/chat-provider"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * The site shell's header, in the marketing layout language: a tall
 * transparent bar that gains its border and background once the page moves,
 * the sections in the middle, and a CTA pair on the right.
 *
 * The FinnaBot ask row lives here now. It was the top card of the app-style
 * Home, and when that page came off the web this was the only place it could
 * go and stay reachable from everywhere.
 */
const NAV = [
    { href: "/budgeting", label: "Budgeting" },
    { href: "/investing", label: "Investing" },
    { href: "/calculators", label: "Calculators" },
    { href: "/taxes", label: "Taxes" },
    { href: "/education", label: "Education" },
]

export function SiteHeader() {
    const pathname = usePathname()
    const { user } = useAuth()
    const { openChat } = useChat()
    const [menuOpen, setMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    const isActive = (href: string) => pathname.startsWith(href)

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

                <div className="hidden items-center gap-1 lg:flex">
                    {NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "rounded-full px-3.5 py-2 text-sm font-semibold transition",
                                isActive(item.href)
                                    ? "bg-secondary text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {/* The Home prompt card, as a header control. */}
                    <button
                        type="button"
                        onClick={() => openChat()}
                        className="hidden h-10 items-center gap-2 rounded-full border border-border bg-card pl-3 pr-1.5 text-sm text-muted-foreground transition hover:border-border-strong sm:inline-flex"
                    >
                        <Image
                            src="/finnabot-logo.png"
                            alt=""
                            width={16}
                            height={20}
                            className="h-5 w-4 object-contain"
                        />
                        <span className="hidden md:inline">Ask FinnaBot…</span>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
                            <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                    </button>

                    {/* Signed out, the pair Wealthsimple leads with: a plain
                        log-in link and a solid Get started pill. Signed in,
                        both are gone — there is nothing left to start — and the
                        account avatar takes the slot. */}
                    {user ? (
                        <Link
                            href="/account"
                            aria-label="Your account"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
                        >
                            <span className="text-sm font-bold">
                                {user.displayName.charAt(0).toUpperCase()}
                            </span>
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/sign-in"
                                className="hidden h-10 items-center px-3 text-sm font-semibold text-foreground transition hover:text-primary sm:inline-flex"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/sign-up"
                                className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
                            >
                                Get started
                            </Link>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground lg:hidden"
                    >
                        {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </nav>

            {menuOpen && (
                <div className="border-t border-border bg-background px-6 py-4 lg:hidden">
                    <div className="flex flex-col">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                    "rounded-md px-2 py-3 text-lg font-semibold",
                                    isActive(item.href) ? "text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setMenuOpen(false)
                                openChat()
                            }}
                            className="rounded-md px-2 py-3 text-left text-lg font-semibold text-muted-foreground"
                        >
                            Ask FinnaBot
                        </button>
                        {!user && (
                            <Link
                                href="/sign-in"
                                onClick={() => setMenuOpen(false)}
                                className="rounded-md px-2 py-3 text-lg font-semibold text-muted-foreground"
                            >
                                Log in
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </header>
    )
}
