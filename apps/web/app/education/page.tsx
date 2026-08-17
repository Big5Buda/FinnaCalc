import type { Metadata } from "next"
import Link from "next/link"
import * as Icons from "lucide-react"
import {
    EDU_TOPIC_META,
    TOTAL_ARTICLE_COUNT,
    TOTAL_VIDEO_COUNT,
    readingResources,
    videoLessons,
} from "@finnacalc/shared/education-content"

export const metadata: Metadata = {
    title: "Education",
    description:
        "Short lessons on credit, investing, budgeting, retirement, taxes and business — curated videos and articles in plain language.",
}

/**
 * The education index: six topics, counted from the same catalog the app
 * ships. The counts are computed, so the page can't advertise lessons that
 * aren't there.
 */
export default function EducationIndex() {
    return (
        <main className="bg-paper pt-[92px]">
            <div className="mx-auto flex max-w-site flex-col gap-12 px-6 pb-24 pt-16">
                <header className="flex max-w-2xl flex-col gap-4">
                    <h1 className="headline-serif text-[clamp(2.5rem,5vw,4rem)] text-ink">Learn</h1>
                    <p className="text-xl leading-relaxed text-ink-soft">
                        {TOTAL_VIDEO_COUNT} video lessons and {TOTAL_ARTICLE_COUNT} articles across
                        six topics, written and picked the way you&rsquo;d explain them to a friend.
                        All free, none need an account.
                    </p>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {EDU_TOPIC_META.map((topic) => {
                        const Icon =
                            (Icons as unknown as Record<string, Icons.LucideIcon>)[topic.icon] ??
                            Icons.BookOpen
                        const videos = videoLessons[topic.id]?.length ?? 0
                        const articles = readingResources[topic.id]?.length ?? 0
                        return (
                            <Link
                                key={topic.id}
                                href={`/education/${topic.id}`}
                                className="flex flex-col gap-3 rounded-lg border border-line bg-chip p-6 transition-colors duration-[350ms] ease-ws hover:border-line-strong"
                            >
                                <Icon className="h-6 w-6 text-ink" strokeWidth={1.75} aria-hidden="true" />
                                <span className="headline-sans text-lg text-ink">{topic.title}</span>
                                <span className="text-sm leading-relaxed text-ink-soft">
                                    {topic.blurb}
                                </span>
                                <span className="figure mt-auto pt-1 text-xs text-ink-muted">
                                    {videos > 0 && `${videos} videos`}
                                    {videos > 0 && articles > 0 && " · "}
                                    {articles > 0 && `${articles} articles`}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </main>
    )
}
