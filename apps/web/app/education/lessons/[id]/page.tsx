import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { EDU_TOPIC_META } from "@finnacalc/shared/education-content"
import { LESSONS, LESSON_DISCLOSURE, lessonById, posterURL } from "@finnacalc/shared/lessons"
import { LessonArticle } from "@/components/lesson-article"

export function generateStaticParams() {
    return LESSONS.map((lesson) => ({ id: lesson.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const lesson = lessonById(id)
    if (!lesson) return {}
    return { title: `${lesson.title} — Learn`, description: lesson.summary }
}

/**
 * One of FinnaCalc's own lessons, in full: the same text the app shows, free
 * and un-gated, with the same standing line above the body. The video, when
 * there is one, is the app's narration of the same lesson, not a third-party
 * clip. A lesson you can't read before signing up isn't education, it's bait —
 * and a lesson that reads differently on the web than in the app isn't one
 * publication, so the text here is generated from the app's and never edited
 * by hand.
 */
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const lesson = lessonById(id)
    if (!lesson) notFound()

    const topic = EDU_TOPIC_META.find((candidate) => candidate.id === lesson.topic)
    const poster = posterURL(lesson)

    return (
        <main className="bg-paper pt-[92px]">
            <article className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pb-24 pt-16">
                <header className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-ink-muted">
                        <Link href="/education" className="hover:underline">
                            Learn
                        </Link>
                        {topic && (
                            <>
                                {" / "}
                                <Link href={`/education/${topic.id}`} className="hover:underline">
                                    {topic.title}
                                </Link>
                            </>
                        )}
                    </p>
                    <h1 className="headline-sans text-[clamp(2rem,3.6vw,3rem)] text-ink">{lesson.title}</h1>
                    <p className="text-xl leading-relaxed text-ink-soft">{lesson.summary}</p>
                    <p className="text-sm text-ink-muted">
                        {lesson.readMinutes} min read
                        {lesson.videoURL ? ` · ${Math.max(1, Math.round(lesson.videoSeconds / 60))} min video` : ""}
                    </p>
                </header>

                {lesson.videoURL && (
                    <video
                        controls
                        preload="metadata"
                        poster={poster ?? undefined}
                        src={lesson.videoURL}
                        className="w-full rounded-lg border border-line bg-black"
                    >
                        Your browser can&rsquo;t play this video. The lesson is written out in full below.
                    </video>
                )}

                <p className="border-y border-line py-4 text-sm leading-relaxed text-ink-muted">
                    {LESSON_DISCLOSURE}
                </p>

                <LessonArticle blocks={lesson.body} />
            </article>
        </main>
    )
}
