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
import { finnaLessons } from "@/lib/finna-lessons"
import { FinnaLessonCard } from "@/components/education/finna-lesson-card"
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

    const lessons = finnaLessons.filter(lesson => lesson.topic === topic)
    const articleCount = readingResources[topic]?.length ?? 0
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? Icons.BookOpen

    return (
        <>
            <PageBar
                back={{ href: "/education", label: "Learn" }}
                title={meta.title}
            />
            <PageBody className="flex w-full flex-col gap-6">
            <header className="flex flex-col gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/14 p-3.5 text-primary">
                    <Icon className="h-6 w-6" strokeWidth={2.2} />
                </span>
                <p className="text-sm text-muted-foreground">{meta.blurb}</p>
            </header>

            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {lessons.map(lesson => <FinnaLessonCard key={lesson.id} lesson={lesson} />)}
            </section>
            {lessons.length === 0 && <p className="text-sm text-muted-foreground">Lessons for this topic are on the way.</p>}
            </PageBody>
        </>
    )
}
