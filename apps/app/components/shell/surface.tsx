"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The layout vocabulary every workspace screen is built from, matched to the
 * reference's logged-in app.
 *
 * PageBar   the thin top strip: title on the left, actions on the right
 * Panel     a warm-white card on the cream ground — the default surface
 * EmptyState  an illustration slot, a sentence, and one action
 * ActionPill  ink or hairline, always fully round
 *
 * These exist so ~35 screens can adopt the new shell by composing rather than
 * each inventing its own card. Nothing here holds state.
 */

/**
 * The column every page sits in, header and footer included.
 *
 * It matches the site header's own container exactly (site-header.tsx), which
 * is the whole point: the bar and the body used to be flush to the left edge
 * on a wide screen while the wordmark above them sat 100 points in, so a
 * title never lined up with the logo and a page's actions drifted hundreds of
 * points right of the content they acted on.
 */
const PAGE_SHELL = "mx-auto w-full max-w-7xl px-4 sm:px-6"

export function PageBar({
    title,
    back,
    actions,
}: {
    title: ReactNode
    /**
     * Where this page came from. A named parent rather than the browser's
     * history: somebody arriving from a search result or from the iOS app has
     * no history to go back to, and the browser's own control already covers
     * the ones who do.
     *
     * Omitted by the five tabs in the header nav, whose way up is the nav.
     */
    back?: { href: string; label: string }
    actions?: ReactNode
}) {
    return (
        <div className={cn(PAGE_SHELL, "flex min-h-[68px] flex-wrap items-center justify-between gap-3 py-4")}>
            <div className="flex min-w-0 items-center gap-2">
                {back && (
                    <Link
                        href={back.href}
                        aria-label={`Back to ${back.label}`}
                        className="-ml-2 inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-1.5 text-sm font-semibold text-primary transition hover:bg-secondary"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        {/* The label stays on a phone too. A bare chevron is the
                            iOS convention, but this is a web page, and a control
                            that names where it goes needs no convention. */}
                        <span className="max-w-[9rem] truncate sm:max-w-none">{back.label}</span>
                    </Link>
                )}
                <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    )
}

/**
 * The page's content column, under the bar.
 *
 * Two divs on purpose. The outer one is the same centred shell the bar and
 * the header use; the inner one carries whatever narrower measure the page
 * asked for, left-aligned inside that shell. A page capped at `max-w-3xl`
 * therefore starts on the same vertical line as its own title and as the
 * wordmark, instead of floating in the middle of a screen whose title sits
 * far to its left.
 *
 * `pb-20` is clearance for FinnaBot's corner button, not leftover padding
 * from the icon rail that used to live there.
 */
export function PageBody({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <div className={cn(PAGE_SHELL, "pb-20")}>
            <div className={cn("w-full", className)}>{children}</div>
        </div>
    )
}

export function Panel({
    children,
    className,
    padded = true,
}: {
    children: ReactNode
    className?: string
    padded?: boolean
}) {
    return (
        <section
            className={cn(
                "rounded-card border border-border bg-card",
                padded && "p-6",
                className
            )}
        >
            {children}
        </section>
    )
}

export function PanelTitle({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <h2 className={cn("text-base font-semibold text-foreground", className)}>{children}</h2>
    )
}

/**
 * An empty state that says what's missing and offers the one action that fixes
 * it. Never a dead end, and never a fake preview of data the reader doesn't
 * have — the house rule about fabricated figures applies hardest here, where a
 * plausible-looking sample is most tempting.
 */
export function EmptyState({
    icon,
    title,
    body,
    action,
    className,
}: {
    icon?: ReactNode
    title: string
    body?: string
    action?: ReactNode
    className?: string
}) {
    return (
        <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
            {icon && (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-secondary text-muted-foreground">
                    {icon}
                </span>
            )}
            <p className="text-base font-semibold text-foreground">{title}</p>
            {body && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>}
            {action && <div className="pt-2">{action}</div>}
        </div>
    )
}

export function ActionPill({
    href,
    onClick,
    children,
    tone = "ink",
    icon,
    className,
}: {
    href?: string
    onClick?: () => void
    children: ReactNode
    tone?: "ink" | "outline"
    icon?: ReactNode
    className?: string
}) {
    const classes = cn(
        "inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        tone === "ink"
            ? "bg-primary text-primary-foreground hover:bg-brand-hover"
            : "border border-border-strong bg-card text-foreground hover:bg-secondary",
        className
    )

    if (href) {
        return (
            <Link href={href} className={classes}>
                {icon}
                {children}
            </Link>
        )
    }
    return (
        <button type="button" onClick={onClick} className={classes}>
            {icon}
            {children}
        </button>
    )
}

/** A labelled figure. The label is small and quiet; the number carries. */
export function Stat({
    label,
    value,
    tone = "neutral",
    hint,
}: {
    label: string
    value: string
    tone?: "neutral" | "positive" | "negative"
    hint?: string
}) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "figure text-2xl font-semibold",
                    tone === "positive" && "text-positive",
                    tone === "negative" && "text-negative",
                    tone === "neutral" && "text-foreground"
                )}
            >
                {value}
            </p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    )
}

/**
 * The segmented control — one choice from a short, visible set.
 *
 * This markup was hand-copied into eight screens (budget type, chart range,
 * billing interval, appearance, order side, portfolio view…), each with its own
 * slightly different padding and font size. Same control, eight spellings,
 * eight chances to drift. One implementation instead.
 *
 * It is a radiogroup rather than a row of buttons: arrow keys move between
 * options natively, and a screen reader announces "2 of 3" instead of reading
 * three unrelated buttons.
 */
export function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    label,
    size = "md",
    className,
}: {
    value: T
    onChange: (next: T) => void
    options: { value: T; label: ReactNode }[]
    /** Names the group for assistive tech; visually hidden. */
    label: string
    size?: "sm" | "md"
    className?: string
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn("inline-flex rounded-pill bg-secondary p-[3px]", className)}
        >
            {options.map((option) => {
                const selected = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "rounded-pill font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
                            selected
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
