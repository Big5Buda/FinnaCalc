import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, BookOpen, Play } from "lucide-react"
import {
    EDU_TOPICS,
    readingResources,
    topicName,
    videoLessons,
    youtubeThumbnail,
} from "@/lib/education-content"

export function generateStaticParams() {
    return EDU_TOPICS.flatMap((topic) =>
        (videoLessons[topic.id] ?? []).map((_, index) => ({ topic: topic.id, lesson: String(index) }))
    )
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ topic: string; lesson: string }>
}): Promise<Metadata> {
    const { topic, lesson } = await params
    const video = videoLessons[topic]?.[Number(lesson)]
    if (!video) return {}
    return { title: video.title, description: `A ${topicName(topic)} lesson from FinnaCalc.` }
}

/**
 * A lesson: the video hero (opens YouTube), then every reading resource for
 * the topic as "Related reading" — since the catalog defines no per-item
 * video↔article correspondence, this bundles the video with ALL of its topic's
 * articles rather than fabricating a specific pairing.
 */
export default async function EducationLessonPage({
    params,
}: {
    params: Promise<{ topic: string; lesson: string }>
}) {
    const { topic, lesson } = await params
    const video = videoLessons[topic]?.[Number(lesson)]
    if (!video) notFound()

    const articles = readingResources[topic] ?? []
    const thumbnail = youtubeThumbnail(video.url)

    return (
        <div className="flex w-full max-w-4xl flex-col gap-6 px-6 py-6 lg:px-10">
            <Link href={`/education/${topic}`} className="text-sm font-semibold text-primary">
                ← {topicName(topic)}
            </Link>

            <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-card-flat overflow-hidden rounded-2xl transition hover:border-border-strong"
            >
                <span className="relative flex h-[170px] w-full items-center justify-center bg-secondary">
                    {thumbnail && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 bg-black/20" />
                    <span className="relative inline-flex h-13 w-13 items-center justify-center rounded-full bg-black/40 p-4 text-white">
                        <Play className="h-5 w-5" fill="currentColor" />
                    </span>
                </span>
                <span className="flex items-center gap-2.5 p-4">
                    <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-base font-bold text-foreground">{video.title}</span>
                        <span className="text-[12.5px] text-muted-foreground">Watch on YouTube</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-border-strong" />
                </span>
            </a>

            {articles.length > 0 && (
                <section className="flex flex-col gap-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Related reading
                    </p>
                    <div className="flex flex-col gap-2.5">
                        {articles.map((article) => (
                            <a
                                key={article.url}
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="paper-card-flat flex items-center gap-3.5 rounded-xl p-4 transition hover:border-border-strong"
                            >
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-foreground">{article.title}</span>
                                    <span className="text-[11.5px] text-muted-foreground">Read the article</span>
                                </span>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                            </a>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
