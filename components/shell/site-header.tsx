"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { useChat } from "@/components/providers/chat-provider"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * The site shell's header. The iOS app's five sections are tabs; on the web
 * they're this nav. Only what works today is listed — Budgeting and Investing
 * arrive with their own pass, and an empty tab reads as broken.
 */
const NAV = [
    { href: "/", label: "Home" },
    { href: "/budgeting", label: "Budgeting" },
    { href: "/calculators", label: "Calculators" },
    { href: "/taxes", label: "Taxes" },
    { href: "/education", label: "Education" },
]

export function SiteHeader() {
    const pathname = usePathname()
    const { user } = useAuth()
    const { openChat } = useChat()
    const [menuOpen, setMenuOpen] = useState(false)

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
            <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
                <Link href="/" className="flex items-center gap-2">
                    <Wordmark className="text-xl" />
                </Link>

                <div className="hidden items-center gap-1 sm:flex">
                    {NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "rounded-md px-3 py-2 text-sm font-semibold transition",
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
                    <button
                        type="button"
                        onClick={() => openChat()}
                        aria-label="Ask FinnaBot"
                        className="hidden h-9 items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold text-foreground transition hover:bg-secondary sm:inline-flex"
                    >
                        <Image src="/finnabot-logo.png" alt="" width={16} height={20} className="h-5 w-4 object-contain" />
                        FinnaBot
                    </button>

                    <Link
                        href="/account"
                        aria-label={user ? "Your account" : "Sign in"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-secondary"
                    >
                        {user ? (
                            <span className="text-sm font-bold">{user.displayName.charAt(0).toUpperCase()}</span>
                        ) : (
                            <User className="h-4 w-4" />
                        )}
                    </Link>

                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground sm:hidden"
                    >
                        {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </nav>

            {menuOpen && (
                <div className="border-t border-border bg-background px-5 py-3 sm:hidden">
                    <div className="flex flex-col">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                    "rounded-md px-2 py-2.5 text-sm font-semibold",
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
                            className="rounded-md px-2 py-2.5 text-left text-sm font-semibold text-muted-foreground"
                        >
                            Ask FinnaBot
                        </button>
                    </div>
                </div>
            )}
        </header>
    )
}
