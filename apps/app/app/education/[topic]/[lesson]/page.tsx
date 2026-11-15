import { Fragment } from "react"
import { fullFinnaLessons as finnaLessons } from "@/lib/finna-lesson-content"
import { lessonVideo, lessonPoster, type FinnaLesson } from "@/lib/finna-lessons"
import { LessonVideo } from "@/components/education/lesson-video"
import type { Metadata } from "next"
import { PageBar, PageBody } from "@/components/shell/surface"
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
    return [...finnaLessons.map(l => ({ topic: l.topic, lesson: l.id })), ...EDU_TOPICS.flatMap((topic) =>
        (videoLessons[topic.id] ?? []).map((_, index) => ({ topic: topic.id, lesson: String(index) }))
    )]
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ topic: string; lesson: string }>
}): Promise<Metadata> {
    const { topic, lesson } = await params
    const owned = finnaLessons.find(l => l.topic === topic && l.id === lesson)
    if (owned) return { title: owned.title, description: owned.summary }
    const video = /^\d+$/.test(lesson) ? videoLessons[topic]?.[Number(lesson)] : undefined
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
    const owned = finnaLessons.find(l => l.topic === topic && l.id === lesson)
    if (owned) return <OwnedLesson lesson={owned} />
    const video = /^\d+$/.test(lesson) ? videoLessons[topic]?.[Number(lesson)] : undefined
    if (!video) notFound()

    const articles = readingResources[topic] ?? []
    const thumbnail = youtubeThumbnail(video.url)

    return (
        <>
            <PageBar
                back={{ href: `/education/${topic}`, label: topicName(topic) }}
                title={video.title}
            />
            <PageBody className="flex max-w-4xl flex-col gap-6">
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
                        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/40 p-4 text-white">
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
            </PageBody>
        </>
    )
}

function inline(text: string) {
    return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong> : part.startsWith("*") ? <em key={i}>{part.slice(1,-1)}</em> : <Fragment key={i}>{part}</Fragment>)
}
function OwnedLesson({ lesson }: { lesson: FinnaLesson }) {
    return <>
        <PageBar title={lesson.title} back={{ href: `/education/${lesson.topic}`, label: topicName(lesson.topic) }} />
        <PageBody className="flex flex-col gap-7">
            <header className="max-w-3xl"><h2 className="text-2xl font-semibold sm:text-3xl">{lesson.title}</h2><p className="mt-3 text-base leading-relaxed text-muted-foreground">{lesson.summary}</p><p className="mt-3 text-xs text-muted-foreground">FinnaCalc · {lesson.readMinutes} min read</p></header>
            {lesson.videoFile && <div className="w-full max-w-5xl"><LessonVideo key={lesson.id} src={lessonVideo(lesson)} poster={lessonPoster(lesson)} title={lesson.title} /></div>}
            <article aria-label="Read the lesson" className="flex max-w-3xl flex-col gap-5 text-base leading-relaxed text-foreground">
                {lesson.body.map((block, i) => {
                    if (block.type === "heading") return <h3 key={i} className="pt-3 text-xl font-semibold">{block.text}</h3>
                    if (block.type === "paragraph") return <p key={i}>{inline(block.text)}</p>
                    if (block.type === "callout") return <aside key={i} className="rounded-xl border border-border bg-secondary p-5">{inline(block.text)}</aside>
                    if (block.type === "numbered") return <ol key={i} className="list-decimal space-y-2 pl-6">{block.items.map((item,j) => <li key={j}>{inline(item)}</li>)}</ol>
                    if (block.type === "bullets") return <ul key={i} className="list-disc space-y-2 pl-6">{block.items.map((item,j) => <li key={j}>{inline(item)}</li>)}</ul>
                    if (block.type === "takeaways") return <section key={i} className="rounded-card border border-border bg-card p-6"><h3 className="mb-3 text-lg font-semibold">Key takeaways</h3><ul className="list-disc space-y-2 pl-5">{block.items.map((item,j) => <li key={j}>{inline(item)}</li>)}</ul></section>
                    return null
                })}
            </article>
        </PageBody>
    </>
}
