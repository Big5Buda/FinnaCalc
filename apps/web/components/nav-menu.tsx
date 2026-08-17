"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { MENUS } from "@/lib/nav"
import { cn } from "@/lib/utils"

/**
 * The header's dropdown menus.
 *
 * Behaviour, matched to the reference: hovering a label opens its panel and
 * moving sideways to another label swaps panels without closing; the panel
 * hangs below the nav pill, left-aligned to its label; the open label takes a
 * soft pill highlight.
 *
 * Keyboard and pointer are handled separately on purpose. Hover alone would
 * leave the menu unusable without a mouse, so each label is also a real link
 * with a `menu`-flavoured button beside it: Enter opens, Escape closes and
 * returns focus, Tab walks the items, and focus leaving the group closes it.
 * The label itself always navigates to the section index, so nothing here is
 * reachable only by hovering.
 */
export function NavMenus() {
    const [open, setOpen] = useState<string | null>(null)
    const closeTimer = useRef<number | null>(null)
    const groupRef = useRef<HTMLDivElement>(null)

    // A small grace period on leave, so crossing the gap between the label and
    // its panel doesn't snap the menu shut mid-reach.
    function scheduleClose() {
        if (closeTimer.current) window.clearTimeout(closeTimer.current)
        closeTimer.current = window.setTimeout(() => setOpen(null), 140)
    }
    function cancelClose() {
        if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(null)
        }
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("keydown", onKey)
            if (closeTimer.current) window.clearTimeout(closeTimer.current)
        }
    }, [])

    return (
        <div
            ref={groupRef}
            className="hidden items-center gap-0.5 lg:flex"
            onMouseLeave={scheduleClose}
            onMouseEnter={cancelClose}
            onBlur={(event) => {
                // Only close when focus leaves the whole menu group, not when it
                // moves between a label and its own panel.
                if (!groupRef.current?.contains(event.relatedTarget as Node)) setOpen(null)
            }}
        >
            {MENUS.map((menu) => {
                const isOpen = open === menu.label
                return (
                    <div
                        key={menu.label}
                        className="relative"
                        onMouseEnter={() => {
                            cancelClose()
                            setOpen(menu.label)
                        }}
                    >
                        <span className="flex items-center">
                            <Link
                                href={menu.href}
                                className={cn(
                                    "rounded-pill py-2 pl-3 pr-1 text-sm font-medium text-ink",
                                    "transition-colors duration-[350ms] ease-ws hover:bg-ink/5",
                                    isOpen && "bg-ink/5"
                                )}
                            >
                                {menu.label}
                            </Link>
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                aria-haspopup="true"
                                aria-label={`${menu.label} menu`}
                                onClick={() => setOpen(isOpen ? null : menu.label)}
                                onFocus={() => setOpen(menu.label)}
                                className={cn(
                                    "rounded-pill py-2 pl-0.5 pr-2.5 text-ink",
                                    "transition-colors duration-[350ms] ease-ws hover:bg-ink/5",
                                    isOpen && "bg-ink/5"
                                )}
                            >
                                <ChevronDown
                                    className={cn(
                                        "h-3.5 w-3.5 transition-transform duration-[350ms] ease-ws",
                                        isOpen && "rotate-180"
                                    )}
                                    aria-hidden="true"
                                />
                            </button>
                        </span>

                        {isOpen && (
                            <div
                                className={cn(
                                    "absolute left-0 top-[calc(100%+14px)] z-50 w-[320px] rounded-md border border-line bg-chip p-2",
                                    "shadow-[0_18px_44px_rgb(28_27_27/0.13)]"
                                )}
                            >
                                {menu.items.map((item) => (
                                    <Link
                                        key={item.href + item.label}
                                        href={item.href}
                                        onClick={() => setOpen(null)}
                                        className="flex flex-col gap-0.5 rounded-sm px-3 py-2.5 transition-colors duration-[350ms] ease-ws hover:bg-ink/5"
                                    >
                                        <span className="text-sm font-medium text-ink">{item.label}</span>
                                        <span className="text-xs leading-snug text-ink-muted">
                                            {item.blurb}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/**
 * The same menu on small screens: every section and every item, flat, because
 * a phone has room to scroll but not to hover.
 */
export function MobileMenu({ onNavigate }: { onNavigate: () => void }) {
    return (
        <div className="flex flex-col gap-6">
            {MENUS.map((menu) => (
                <div key={menu.label} className="flex flex-col gap-1">
                    <Link
                        href={menu.href}
                        onClick={onNavigate}
                        className="px-2 py-1 text-base font-semibold text-ink"
                    >
                        {menu.label}
                    </Link>
                    <div className="flex flex-col">
                        {menu.items.map((item) => (
                            <Link
                                key={item.href + item.label}
                                href={item.href}
                                onClick={onNavigate}
                                className="rounded-sm px-2 py-2 text-[15px] text-ink-soft"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
