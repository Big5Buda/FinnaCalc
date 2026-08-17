"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
    BookOpen,
    Calculator,
    FileText,
    Home,
    LineChart,
    Menu,
    Search,
    Sparkles,
    User,
    Wallet,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useChat } from "@/components/providers/chat-provider"

/**
 * The application's navigation: a narrow icon rail pinned to the left edge,
 * replacing the old top header.
 *
 * Why a rail. Every screen here is a workspace — a budget, a portfolio, a
 * return being estimated — and a top bar spends vertical space that those
 * screens want. A rail costs 88px of width once and gives the content the full
 * height of the window, which is the trade the reference makes too.
 *
 * Each destination is icon-only with a tooltip on hover and a real accessible
 * name, so the rail stays legible without labels. On phones it collapses into
 * a bottom sheet opened from a floating button, because a vertical rail on a
 * 390px screen is just a wasted column.
 */

const PRIMARY = [
    { href: "/", label: "Home", icon: Home, exact: true },
    { href: "/budgeting", label: "Budgeting", icon: Wallet },
    { href: "/investing", label: "Investing", icon: LineChart },
    { href: "/taxes", label: "Taxes", icon: FileText },
    { href: "/calculators", label: "Calculators", icon: Calculator },
    { href: "/education", label: "Education", icon: BookOpen },
]

function isActive(pathname: string, href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function AppRail() {
    const pathname = usePathname()
    const { openChat } = useChat()
    const [sheetOpen, setSheetOpen] = useState(false)

    return (
        <>
            {/* ── Desktop rail ──────────────────────────────────────────── */}
            <nav
                aria-label="Main"
                className="fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col items-center border-r border-border bg-background py-5 lg:flex"
            >
                <Link
                    href="/"
                    aria-label="FinnaCalc home"
                    className="mb-6 inline-flex h-10 w-10 items-center justify-center"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/finnacalc-mark.png" alt="" className="h-7 w-auto" />
                </Link>

                <RailButton label="Search" onClick={() => openChat()} icon={Search} />

                <div className="mt-2 flex flex-col items-center gap-1.5">
                    {PRIMARY.map((item) => (
                        <RailLink
                            key={item.href}
                            {...item}
                            active={isActive(pathname, item.href, item.exact)}
                        />
                    ))}
                </div>

                <div className="mt-auto flex flex-col items-center gap-1.5">
                    <RailButton label="Ask FinnaBot" onClick={() => openChat()} icon={Sparkles} />
                    <RailLink
                        href="/account"
                        label="Account"
                        icon={User}
                        active={isActive(pathname, "/account")}
                    />
                </div>
            </nav>

            {/* ── Mobile: a floating opener and a sheet ─────────────────── */}
            <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="Open menu"
                className="fixed bottom-5 left-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-pill bg-primary text-primary-foreground shadow-lg lg:hidden"
            >
                <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            {sheetOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close menu"
                        onClick={() => setSheetOpen(false)}
                        className="absolute inset-0 bg-foreground/25"
                    />
                    <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-5 pb-8">
                        <div className="flex items-center justify-between pb-4">
                            <span className="font-serif text-xl font-semibold text-foreground">
                                FinnaCalc
                            </span>
                            <button
                                type="button"
                                onClick={() => setSheetOpen(false)}
                                aria-label="Close menu"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-muted-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {PRIMARY.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSheetOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-4 py-3 text-[15px] font-medium",
                                        isActive(pathname, item.href, item.exact)
                                            ? "bg-secondary text-foreground"
                                            : "text-body"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" aria-hidden="true" />
                                    {item.label}
                                </Link>
                            ))}
                            <Link
                                href="/account"
                                onClick={() => setSheetOpen(false)}
                                className="flex items-center gap-3 rounded-md px-4 py-3 text-[15px] font-medium text-body"
                            >
                                <User className="h-4 w-4" aria-hidden="true" />
                                Account
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    setSheetOpen(false)
                                    openChat()
                                }}
                                className="flex items-center gap-3 rounded-md px-4 py-3 text-left text-[15px] font-medium text-body"
                            >
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                Ask FinnaBot
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

/** The rail's shared shape: a 44px target, active state, hover tooltip. */
const RAIL_ITEM =
    "group relative inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors"

function RailLink({
    href,
    label,
    icon: Icon,
    active,
}: {
    href: string
    label: string
    icon: typeof Home
    active: boolean
}) {
    return (
        <Link
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
                RAIL_ITEM,
                active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
        >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            <Tooltip>{label}</Tooltip>
        </Link>
    )
}

function RailButton({
    label,
    icon: Icon,
    onClick,
}: {
    label: string
    icon: typeof Home
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(RAIL_ITEM, "text-muted-foreground hover:bg-secondary hover:text-foreground")}
        >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            <Tooltip>{label}</Tooltip>
        </button>
    )
}

/** Hover-only, and hidden from screen readers — the aria-label already says it. */
function Tooltip({ children }: { children: string }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[calc(100%+10px)] z-50 whitespace-nowrap rounded-sm bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100"
        >
            {children}
        </span>
    )
}
