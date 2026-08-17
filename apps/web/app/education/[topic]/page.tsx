import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, BookOpen, Play } from "lucide-react"
import {
    EDU_TOPIC_META,
    readingResources,
    videoLessons,
} from "@finnacalc/shared/education-content"

export function generateStaticParams() {
    return EDU_TOPIC_META.map((topic) => ({ topic: topic.id }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ topic: string }>
}): Promise<Metadata> {
    const { topic } = await params
    const meta = EDU_TOPIC_META.find((candidate) => candidate.id === topic)
    if (!meta) return {}
    return { title: `${meta.title} — Learn`, description: meta.blurb }
}

/**
 * One topic's lessons — the same curated videos and articles the app lists,
 * linked to their sources. Un-gated: a lesson you can't read before signing up
 * isn't education, it's bait.
 */
export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
    const { topic } = await params
    const meta = EDU_TOPIC_META.find((candidate) => candidate.id === topic)
    if (!meta) notFound()

    const videos = videoLessons[meta.id] ?? []
    const articles = readingResources[meta.id] ?? []

    return (
        <main className="bg-paper pt-[92px]">
            <div className="mx-auto flex max-w-site flex-col gap-12 px-6 pb-24 pt-16">
                <header className="flex max-w-2xl flex-col gap-3">
                    <p className="text-sm font-medium text-ink-muted">
                        <Link href="/education" className="hover:underline">
                            Learn
                        </Link>
                    </p>
                    <h1 className="headline-sans text-[clamp(2.25rem,4.2vw,3.5rem)] text-ink">
                        {meta.title}
                    </h1>
                    <p className="text-xl leading-relaxed text-ink-soft">{meta.blurb}.</p>
                </header>

                <div className="grid gap-12 lg:grid-cols-2">
                    {videos.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
                                <Play className="h-4 w-4" aria-hidden="true" /> Video lessons
                            </h2>
                            <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-chip">
                                {videos.map((lesson, index) => (
                                    <li key={lesson.url} className={index > 0 ? "border-t border-line" : ""}>
                                        <a
                                            href={lesson.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-[350ms] ease-ws hover:bg-ink/[0.03]"
                                        >
                                            <span className="text-[15px] font-medium text-ink">
                                                {lesson.title}
                                            </span>
                                            <ArrowUpRight
                                                className="h-4 w-4 shrink-0 text-ink-muted"
                                                aria-hidden="true"
                                            />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {articles.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
                                <BookOpen className="h-4 w-4" aria-hidden="true" /> Reading
                            </h2>
                            <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-chip">
                                {articles.map((article, index) => (
                                    <li key={article.url} className={index > 0 ? "border-t border-line" : ""}>
                                        <a
                                            href={article.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-[350ms] ease-ws hover:bg-ink/[0.03]"
                                        >
                                            <span className="text-[15px] font-medium text-ink">
                                                {article.title}
                                            </span>
                                            <ArrowUpRight
                                                className="h-4 w-4 shrink-0 text-ink-muted"
                                                aria-hidden="true"
                                            />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <p className="max-w-2xl border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
                    Lessons link to their original sources — we curate them, we didn&rsquo;t make
                    them, and we say so. Questions a lesson raises are what FinnaBot answers in the
                    app.
                </p>
            </div>
        </main>
    )
}
