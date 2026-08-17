import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import * as Icons from "lucide-react"
import { ChevronRight, Play } from "lucide-react"
import {
    EDU_TOPIC_META,
    EDU_TOPICS,
    readingResources,
    topicName,
    videoLessons,
} from "@/lib/education-content"
import { PageBar, PageBody } from "@/components/shell/surface"

export function generateStaticParams() {
    return EDU_TOPICS.map((topic) => ({ topic: topic.id }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ topic: string }>
}): Promise<Metadata> {
    const { topic } = await params
    const meta = EDU_TOPIC_META.find((entry) => entry.id === topic)
    if (!meta) return {}
    return { title: meta.title, description: meta.blurb }
}

/**
 * A topic's page: hero, then a "Lessons" list — one row per video. A lesson
 * opens the lesson page, which bundles that video with every reading resource
 * for the topic (the catalog defines no per-item video↔article pairing).
 */
export default async function EducationTopicPage({ params }: { params: Promise<{ topic: string }> }) {
    const { topic } = await params
    const meta = EDU_TOPIC_META.find((entry) => entry.id === topic)
    if (!meta) notFound()

    const videos = videoLessons[topic] ?? []
    const articleCount = readingResources[topic]?.length ?? 0
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? Icons.BookOpen

    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/education" className="text-muted-foreground hover:text-foreground">
                            Learn
                        </Link>
                        <span className="text-border-strong">/</span>
                        Learn
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-5xl flex-col gap-5">
            <header className="flex flex-col gap-3">
                <span className="inline-flex h-13 w-13 items-center justify-center rounded-full bg-primary/14 p-3.5 text-primary">
                    <Icon className="h-6 w-6" strokeWidth={2.2} />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{meta.title}</h1>
                <p className="text-sm text-muted-foreground">{meta.blurb}</p>
            </header>

            {videos.length === 0 ? (
                /* A topic can exist before its lessons do. Say so, rather than
                   leaving the page as a bare heading that reads broken. */
                <p className="py-7 text-center text-[13.5px] text-muted-foreground">
                    Lessons for this topic are on the way.
                </p>
            ) : (
                <section className="flex flex-col gap-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Lessons
                    </p>
                    <div className="flex flex-col gap-2.5">
                        {videos.map((video, index) => (
                            <Link
                                key={video.url}
                                href={`/education/${topic}/${index}`}
                                className="paper-card-flat flex items-center gap-3.5 rounded-xl p-4 transition hover:border-border-strong"
                            >
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-negative/12 text-negative">
                                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-foreground">{video.title}</span>
                                    <span className="text-[11.5px] text-muted-foreground">
                                        {articleCount > 0
                                            ? `Video · ${articleCount} related read${articleCount === 1 ? "" : "s"}`
                                            : "Video lesson"}
                                    </span>
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                            </Link>
                        ))}
                    </div>
                </section>
            )}
            </PageBody>
        </>
    )
}
