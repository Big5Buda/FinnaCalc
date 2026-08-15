"use client"

import { StoreBadge } from "@/components/marketing/store-badge"
import { WaitlistForm } from "@/components/marketing/waitlist-form"

/**
 * The App Store strip. Budgeting, investing and the portfolio ship in the iOS
 * app first, so the web says so plainly rather than linking to pages that
 * don't exist yet. The waitlist form is kept here — it's the only place that
 * still collects launch signups now that the standalone marketing page is gone.
 */
export function AppStoreStrip() {
    return (
        <section
            id="waitlist"
            className="flex flex-col gap-4 rounded-card border border-border bg-sunken px-[18px] py-5 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex flex-col gap-1.5">
                <p className="text-sm font-bold text-foreground">FinnaCalc for iPhone</p>
                <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                    Budgeting with your bank connected, your live portfolio, and trading through your own
                    brokerage — all in the app. Join the waitlist and we&rsquo;ll email you at launch.
                </p>
                <div className="pt-1">
                    <WaitlistForm referralSource="home-strip" buttonLabel="Join" />
                </div>
            </div>
            <StoreBadge topText="Coming soon to the" bottomText="App Store" href="#waitlist" />
        </section>
    )
}
