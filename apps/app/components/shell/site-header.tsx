"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Menu, Moon, Sun, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { useAppearance } from "@/components/providers/appearance-provider"

/**
 * The top header, back.
 *
 * The site had this shape from the start: the wordmark on the left, the five
 * sections across the middle, and the account on the right. It was replaced
 * by an icon rail when the app went behind sign-in, and the owner asked for
 * it back: a person who prefers the website to the phone should find the
 * same site they always had, with the account, the plans, the appearance
 * switch and the company pages one menu away, the way the app's Account
 * sheet keeps them.
 *
 * The account menu is a plain disclosure rather than a dropdown library: the
 * app has none installed, and one button that opens a list is not worth a
 * dependency.
 */
const NAV = [
    { href: "/", label: "Home", exact: true },
    { href: "/budgeting", label: "Budgeting" },
    { href: "/investing", label: "Investing" },
    { href: "/taxes", label: "Taxes" },
    { href: "/education", label: "Education" },
]

function isActive(pathname: string, href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)

    // Both menus close on navigation, so a tap that leaves the page does not
    // leave a menu hanging over the next one.
    useEffect(() => { setMenuOpen(false) }, [pathname])

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="FinnaCalc home">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/finnacalc-mark.png" alt="" className="h-8 w-auto" />
                    <span className="text-xl font-bold text-foreground">
                        Finna<span className="text-primary">Calc</span>
                    </span>
                </Link>

                <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
                    {NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "text-[15px] font-bold transition",
                                isActive(pathname, item.href, item.exact)
                                    ? "text-primary"
                                    : "text-foreground/80 hover:text-primary"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <AccountMenu />
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground md:hidden"
                    >
                        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* The five sections, stacked, on a phone. The old header put them
                in a row that did not fit; this is what it should have done. */}
            {menuOpen && (
                <nav aria-label="Main" className="border-t border-border bg-background px-4 py-3 md:hidden">
                    {NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "block rounded-md px-3 py-2.5 text-[15px] font-bold",
                                isActive(pathname, item.href, item.exact)
                                    ? "bg-secondary text-primary"
                                    : "text-foreground/80"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            )}
        </header>
    )
}

/**
 * Sign in and Sign up for a visitor; for a member, their name, opening the
 * same list the app's Account sheet holds: Account, Plans, the appearance
 * switch, the three company pages, and Sign out.
 */
function AccountMenu() {
    const { user, signOut, loading } = useAuth()
    const { appearance, setAppearance } = useAppearance()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const close = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", close)
        return () => document.removeEventListener("mousedown", close)
    }, [open])

    if (loading) return <div className="h-9 w-20" aria-hidden="true" />

    if (!user) {
        return (
            <div className="flex items-center gap-1.5">
                <Link
                    href="/sign-in"
                    className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
                >
                    Sign in
                </Link>
                <Link
                    href="/sign-up"
                    className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90"
                >
                    Sign up
                </Link>
            </div>
        )
    }

    const dark = appearance === "dark"
    const rows = [
        { href: "/account", label: "Account" },
        { href: "/plans", label: "Plans" },
        { href: "/account#feedback", label: "Feedback" },
        { href: "/about", label: "About Us" },
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms of Service" },
    ]

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex h-9 max-w-[180px] items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                    {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{user.displayName}</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                >
                    <div className="border-b border-border px-4 py-3">
                        <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    {rows.map((row) => (
                        <Link
                            key={row.href}
                            href={row.href}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="block px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                        >
                            {row.label}
                        </Link>
                    ))}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => setAppearance(dark ? "light" : "dark")}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                    >
                        {dark ? "Light mode" : "Dark mode"}
                        {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            setOpen(false)
                            void signOut().then(() => router.push("/"))
                        }}
                        className="block w-full border-t border-border px-4 py-2.5 text-left text-sm font-medium text-destructive transition hover:bg-secondary"
                    >
                        Sign out
                    </button>
                </div>
            )}
        </div>
    )
}
