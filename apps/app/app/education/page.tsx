"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import * as Icons from "lucide-react"
import { ArrowUpRight, BookOpen, ChevronRight, Play, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    EDU_TOPIC_META,
    readingResources,
    searchEducation,
    topicName,
    videoLessons,
    youtubeThumbnail,
    type EduItem,
} from "@/lib/education-content"
import { LessonOfWeekCard } from "@/components/education/lesson-of-week"
import { SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * Education — the "video rail library" layout from the app's Education tab:
 * "Learn money" header + search → Popular videos rail → Topics grid → Quick
 * reads. A query swaps the body for the results list; the browse/search logic
 * is the shared catalog in lib/education-content.ts.
 */

/** Four curated picks, one per distinct topic, looked up against the catalog. */
const POPULAR_PICKS: { topicId: string; title: string }[] = [
    { topicId: "investing", title: "Index Funds vs. Mutual Funds vs. ETFs" },
    { topicId: "credit", title: "What Is a Credit Score?" },
    { topicId: "budgeting", title: "How to Manage Your Money (The 50/30/20 Rule)" },
    { topicId: "retirement", title: "What Is a 401(k)?" },
]

/** Four real catalog articles, one from each of four topics — a sampler. */
const QUICK_READS: { topicId: string; title: string }[] = [
    { topicId: "budgeting", title: "What Is a Budget?" },
    { topicId: "credit", title: "How to Raise Your Credit Score" },
    { topicId: "investing", title: "How and Where to Start Investing" },
    { topicId: "retirement", title: "How to Invest for Retirement" },
]

function lookup(source: Record<string, EduItem[]>, picks: { topicId: string; title: string }[]) {
    return picks
        .map((pick) => {
            const item = source[pick.topicId]?.find((entry) => entry.title === pick.title)
            return item ? { topicId: pick.topicId, item } : null
        })
        .filter((entry): entry is { topicId: string; item: EduItem } => entry !== null)
}

export default function EducationPage() {
    const [query, setQuery] = useState("")
    const trimmed = query.trim()
    const results = useMemo(() => searchEducation(query), [query])

    const popularVideos = lookup(videoLessons, POPULAR_PICKS)
    const quickReads = lookup(readingResources, QUICK_READS)

    return (
        <>
            <PageBar title="Learn" />
            <PageBody className="flex w-full max-w-5xl flex-col gap-6">
                <div className="contents">

            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search lessons"
                    aria-label="Search lessons"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {query !== "" && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}
            </div>

            {trimmed === "" ? (
                <>
                    {/* Moved here when the app-style Home came off the web: it's
                        the one place that features a single lesson. */}
                    <LessonOfWeekCard />

                    <section className="flex flex-col gap-2.5">
                        <SectionLabel>Popular videos</SectionLabel>
                        <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
                            {popularVideos.map(({ topicId, item }) => (
                                <VideoRailCard key={item.url} topicId={topicId} item={item} />
                            ))}
                        </div>
                    </section>

                    <section className="flex flex-col gap-2.5">
                        <SectionLabel>Topics</SectionLabel>
                        <div className="grid grid-cols-2 gap-2.5">
                            {EDU_TOPIC_META.map((meta) => {
                                const Icon =
                                    (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ??
                                    Icons.BookOpen
                                const videos = videoLessons[meta.id]?.length ?? 0
                                const articles = readingResources[meta.id]?.length ?? 0
                                return (
                                    <Link
                                        key={meta.id}
                                        href={`/education/${meta.id}`}
                                        className="paper-card-flat flex flex-col gap-2 rounded-xl p-3.5 transition hover:border-border-strong"
                                    >
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/14 text-primary">
                                            <Icon className="h-4 w-4" strokeWidth={2.2} />
                                        </span>
                                        <span className="text-sm font-bold text-foreground">{meta.title}</span>
                                        <span className="figure text-[11px] font-normal text-muted-foreground">
                                            {videos} video{videos === 1 ? "" : "s"} · {articles} article
                                            {articles === 1 ? "" : "s"}
                                        </span>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>

                    <section className="flex flex-col gap-2.5">
                        <SectionLabel>Quick reads</SectionLabel>
                        <div className="paper-card-flat overflow-hidden rounded-xl">
                            {quickReads.map(({ topicId, item }, index) => (
                                <a
                                    key={item.url}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/60",
                                        index > 0 && "border-t border-border"
                                    )}
                                >
                                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
                                        <BookOpen className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-[13.5px] font-semibold text-foreground">
                                            {item.title}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            Article · {topicName(topicId)}
                                        </span>
                                    </span>
                                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                                </a>
                            ))}
                        </div>
                    </section>
                </>
            ) : results.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Search className="h-8 w-8 text-muted-foreground" />
                    <p className="text-[17px] font-semibold text-foreground">
                        We couldn’t find anything for “{trimmed}”
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                        Try different words, or browse the topics below. We may not have a lesson on that yet.
                    </p>
                    <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="mt-2 rounded-full border-2 border-primary px-4 py-2 text-[13px] font-bold text-primary"
                    >
                        Browse all topics
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <p className="text-[13px] text-muted-foreground">
                        {results.length} result{results.length === 1 ? "" : "s"} for “{trimmed}”
                    </p>
                    <div className="flex flex-col gap-2.5">
                        {results.map((doc) => (
                            <a
                                key={doc.id}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="paper-card-flat flex items-start gap-3 rounded-xl p-3.5 transition hover:border-border-strong"
                            >
                                <span
                                    className={cn(
                                        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                                        doc.type === "video"
                                            ? "bg-negative/12 text-negative"
                                            : "bg-secondary text-muted-foreground"
                                    )}
                                >
                                    {doc.type === "video" ? (
                                        <Play className="h-4 w-4" fill="currentColor" />
                                    ) : (
                                        <BookOpen className="h-4 w-4" />
                                    )}
                                </span>
                                <span className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-foreground">{doc.title}</span>
                                    <span className="text-[11.5px] text-muted-foreground">
                                        {doc.type === "video" ? "Video lesson" : "Article"} · {doc.topicName}
                                    </span>
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            )}
                </div>
            </PageBody>
        </>
    )
}

function VideoRailCard({ topicId, item }: { topicId: string; item: EduItem }) {
    const thumbnail = youtubeThumbnail(item.url)
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="paper-card-flat flex w-[200px] shrink-0 flex-col overflow-hidden rounded-xl transition hover:border-border-strong"
        >
            <span className="relative flex h-[86px] w-full items-center justify-center bg-gradient-to-br from-[#23335C] to-[#16130E]">
                {thumbnail && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 bg-black/20" />
                <span className="relative inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/40 text-white">
                    <Play className="h-3 w-3" fill="currentColor" />
                </span>
            </span>
            <span className="flex flex-col gap-0.5 px-3 py-2.5">
                <span className="line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-tight text-foreground">
                    {item.title}
                </span>
                <span className="text-[10.5px] text-muted-foreground">{topicName(topicId)}</span>
            </span>
        </a>
    )
}
