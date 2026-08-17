import type { Metadata } from "next"
import Link from "next/link"
import { TRACKER_CATEGORIES, peopleIn, type TrackedPerson } from "@/lib/investing/tracker"
import { SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

export const metadata: Metadata = {
    title: "Trade Tracker",
    description:
        "Investors, company insiders and politicians whose trades are public record — read straight from their SEC filings.",
}

/**
 * Trade Tracker — a directory of people whose filings are public record,
 * ported from TradeTrackerView.swift. The catalog carries identity only; every
 * figure comes from the filings themselves when a person's page is opened.
 */
export default function TrackerPage() {
    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/investing" className="text-muted-foreground hover:text-foreground">
                            Investing
                        </Link>
                        <span className="text-border-strong">/</span>
                        Trade Tracker
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-5xl flex-col gap-5">
            <header className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                    People whose trades are public record. Everything shown comes from their own SEC filings —
                    Form 4 for insiders, 13F for funds, House disclosures for politicians.
                </p>
            </header>

            {TRACKER_CATEGORIES.map((category) => (
                <section key={category.id} className="flex flex-col gap-2.5">
                    <SectionLabel>{category.title}</SectionLabel>
                    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {peopleIn(category.id).map((person) => (
                            <li key={person.id}>
                                <PersonCard person={person} />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            <p className="text-[11px] text-muted-foreground">
                Filings are disclosures, not recommendations, and they arrive well after the trade: a 13F
                describes a quarter that has already ended, and a House disclosure can be filed up to 45 days
                after the transaction.
            </p>
            </PageBody>
        </>
    )
}

function PersonCard({ person }: { person: TrackedPerson }) {
    const initials = person.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")

    return (
        <Link
            href={`/investing/tracker/${person.id}`}
            className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-border-strong"
        >
            <span
                aria-hidden="true"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground"
            >
                {person.emojiBadge || initials}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold text-foreground">{person.name}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">{person.org}</span>
                <span className="text-xs text-muted-foreground">{person.blurb}</span>
            </span>
        </Link>
    )
}
