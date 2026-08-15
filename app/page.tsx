"use client"

import { useAuth } from "@/components/providers/auth-provider"
import {
    CalculatorsSection,
    InvestingCard,
    LessonOfWeekCard,
    PromptCard,
} from "@/components/home/cards"
import { AppStoreStrip } from "@/components/home/app-strip"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * Home — the web counterpart of the app's Home tab (HomeSignedOutView /
 * HomeDashboardView, which are deliberately the same page so nothing
 * rearranges itself the moment someone signs in). Header → FinnaBot prompt →
 * Investing → Lesson of the week → every calculator.
 *
 * The app's Expenses and Goals cards are budgeting-driven; they land on the
 * web with the budgeting pass rather than sitting here permanently empty.
 */
export default function HomePage() {
    const { user } = useAuth()

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6">
            <header className="flex flex-col gap-0.5">
                {user ? (
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {greeting()}, {firstName(user.displayName)}
                    </h1>
                ) : (
                    <Wordmark className="text-3xl" />
                )}
                <p className="text-sm text-muted-foreground">Your All In One Personal Finance Platform</p>
            </header>

            <PromptCard />
            <InvestingCard />
            <LessonOfWeekCard />
            <CalculatorsSection />
            <AppStoreStrip />
        </div>
    )
}

function greeting(): string {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return "Good morning"
    if (hour >= 12 && hour < 17) return "Good afternoon"
    return "Good evening"
}

/**
 * Prefer the first token of the display name; if it's an email, use the part
 * before the "@" so we still greet with something human.
 */
function firstName(displayName: string): string {
    const base =
        displayName.includes("@") && !displayName.includes(" ")
            ? displayName.slice(0, displayName.indexOf("@"))
            : displayName
    return base.split(" ")[0] || base
}
