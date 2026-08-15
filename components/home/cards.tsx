"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, ArrowUp, ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react"
import * as Icons from "lucide-react"
import { cn } from "@/lib/utils"
import { fixed } from "@/lib/format"
import { apiGet } from "@/lib/api-client"
import { CALCULATORS } from "@/lib/calculators/catalog"
import { useChat } from "@/components/providers/chat-provider"
import { SectionLabel } from "@/components/ui/primitives"

/**
 * The Home cards, ported from Features/Home/PaperHome.swift. Geometry follows
 * the design's big-card spec: 22px radius, 18/18/16/18 insets, a 153px floor,
 * a weighted border and the static ambient halo.
 *
 * Expenses and Goals are budgeting-driven and ship with the budgeting pass —
 * a permanently empty card with a dead link would be worse than no card.
 */

const BIG_CARD =
    "paper-card flex min-h-[153px] w-full flex-col gap-2.5 rounded-card px-[18px] pb-4 pt-[18px] text-left"

function BigCardHeader({ children }: { children: string }) {
    return (
        <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{children}</p>
    )
}

/** The FinnaBot ask row, with the drifting ambient glow that marks AI entry points. */
export function PromptCard() {
    const { openChat } = useChat()
    return (
        <button
            type="button"
            onClick={() => openChat()}
            className="ambient-glow flex w-full items-center gap-3 rounded-card p-3.5 text-left"
        >
            <Image
                src="/finnabot-logo.png"
                alt=""
                width={24}
                height={30}
                className="h-[30px] w-6 object-contain"
            />
            <span className="flex-1 text-[14.5px] text-muted-foreground">Ask FinnaBot a question…</span>
            <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand text-white">
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
        </button>
    )
}

type MarketStat = { symbol: string; name?: string; price: number; changePct: number }

/**
 * Investing as a full-width card. Signed out there is no portfolio to show, so
 * it leads with the S&P 500 — tracked through SPY and labelled "S&P 500 ETF",
 * because the index itself isn't quotable on our data plan. The figure stays
 * "—" until a real quote lands; nothing is ever placeheld.
 */
export function InvestingCard() {
    const symbol = "SPY"
    const [stat, setStat] = useState<MarketStat | null>(null)
    const [closes, setCloses] = useState<number[]>([])

    useEffect(() => {
        let active = true
        apiGet<{ stats: MarketStat[] }>("/api/market-stats", { symbols: symbol })
            .then((data) => {
                if (!active) return
                setStat(data.stats.find((s) => s.symbol.toUpperCase() === symbol) ?? null)
            })
            .catch(() => {})
        apiGet<{ sparklines: Record<string, number[]> }>("/api/sparklines", { symbols: symbol })
            .then((data) => {
                if (!active) return
                setCloses(data.sparklines?.[symbol] ?? [])
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    const isUp = (stat?.changePct ?? 0) >= 0

    return (
        <section className={BIG_CARD}>
            <BigCardHeader>INVESTING</BigCardHeader>
            <div className="flex items-center gap-3.5">
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">S&amp;P 500 ETF</p>
                    <p
                        className={cn(
                            "figure flex items-center gap-1 text-[19px] font-bold",
                            stat === null ? "text-foreground" : isUp ? "text-positive" : "text-negative"
                        )}
                    >
                        {stat !== null &&
                            (isUp ? (
                                <ArrowUpRight className="h-4 w-4" strokeWidth={3} />
                            ) : (
                                <ArrowDownRight className="h-4 w-4" strokeWidth={3} />
                            ))}
                        {stat ? `${isUp ? "+" : "−"}${fixed(Math.abs(stat.changePct), 2)}%` : "—"}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">{stat ? "today" : ""}</p>
                </div>
                {closes.length >= 2 && (
                    <div className="min-w-0 flex-1">
                        <Sparkline closes={closes} isUp={isUp} />
                    </div>
                )}
            </div>
        </section>
    )
}

function Sparkline({ closes, isUp }: { closes: number[]; isUp: boolean }) {
    const width = 160
    const height = 62
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const span = max - min || 1
    const points = closes
        .map((close, index) => {
            const x = (index / (closes.length - 1)) * width
            const y = height - ((close - min) / span) * height
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(" ")

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="h-[62px] w-full"
            aria-hidden="true"
        >
            <polyline
                points={points}
                fill="none"
                stroke={isUp ? "rgb(var(--positive))" : "rgb(var(--negative))"}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}

/**
 * "Lesson of the week" — one featured Education lesson, rotated by calendar
 * week so it changes on its own without any backend. Deterministic (the same
 * lesson all week for everyone), and every entry points at a real topic page.
 */
const LESSONS = [
    { topicId: "retirement", topic: "RETIREMENT", title: "The Effect of Time on Your Retirement Savings" },
    { topicId: "investing", topic: "INVESTING", title: "How to Invest with Confidence" },
    { topicId: "budgeting", topic: "BUDGETING", title: "Building a Budget That Actually Sticks" },
    { topicId: "credit", topic: "CREDIT & DEBT", title: "Paying Down Debt Without Losing Momentum" },
    { topicId: "taxes", topic: "TAX PLANNING", title: "Understanding the Taxes You Pay" },
]

function weekOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1)
    const days = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
    return Math.ceil((days + start.getDay() + 1) / 7)
}

export function LessonOfWeekCard() {
    // Computed on the client so a cached page can't serve last week's lesson.
    const [lesson, setLesson] = useState(LESSONS[0])
    useEffect(() => {
        setLesson(LESSONS[Math.abs(weekOfYear(new Date())) % LESSONS.length])
    }, [])

    return (
        <Link href={`/education/${lesson.topicId}`} className={cn(BIG_CARD, "transition hover:brightness-[0.99]")}>
            <BigCardHeader>LESSON OF THE WEEK</BigCardHeader>
            <div className="flex flex-col items-start gap-1.5">
                <span className="rounded-full bg-primary/14 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-primary">
                    {lesson.topic}
                </span>
                <p className="text-[19px] font-bold leading-tight tracking-tight text-foreground">
                    {lesson.title}
                </p>
            </div>
        </Link>
    )
}

/** Every calculator, as the app's Home lists them — not a curated three. */
export function CalculatorsSection() {
    return (
        <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
                <SectionLabel>Calculators</SectionLabel>
                <Link
                    href="/calculators"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                    All {CALCULATORS.length}
                    <ArrowRight className="h-3 w-3" strokeWidth={3} />
                </Link>
            </div>
            <div className="paper-card overflow-hidden rounded-card">
                {CALCULATORS.map((entry, index) => {
                    const Icon =
                        (Icons as unknown as Record<string, Icons.LucideIcon>)[entry.icon] ?? Icons.Calculator
                    return (
                        <Link
                            key={entry.slug}
                            href={`/calculators/${entry.slug}`}
                            className={cn(
                                "flex items-center gap-3 px-3.5 py-3 transition hover:bg-secondary/60",
                                index > 0 && "border-t border-border"
                            )}
                        >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/14 text-primary">
                                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                            </span>
                            <span className="flex-1 text-sm font-semibold text-foreground">
                                {entry.shortTitle}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-border-strong" strokeWidth={3} />
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
