"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * The Lesson of the week card, which used to sit on the app-style Home. That
 * dashboard is gone from the web — the landing took its place — so the card
 * moved here rather than being lost: it is the only thing that surfaces a
 * single lesson rather than a whole topic.
 */

const BIG_CARD =
    "paper-card flex min-h-[153px] w-full flex-col gap-2.5 rounded-card px-[18px] pb-4 pt-[18px] text-left"

function BigCardHeader({ children }: { children: string }) {
    return (
        <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{children}</p>
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
