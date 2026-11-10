"use client"
import { useState } from "react"
import Link from "next/link"
import { Play } from "lucide-react"
import { lessonDuration, lessonHref, lessonPoster, type FinnaLessonSummary } from "@/lib/finna-lessons"
export function FinnaLessonCard({ lesson }: { lesson: FinnaLessonSummary }) {
    const [posterFailed, setPosterFailed] = useState(false)
    return <Link href={lessonHref(lesson)} className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="relative aspect-video overflow-hidden bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {!posterFailed ? <img src={lessonPoster(lesson)} alt="" loading="lazy" onError={() => setPosterFailed(true)} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-primary"><Play className="h-10 w-10" aria-hidden="true" /></span>}
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white"><Play className="h-3 w-3" aria-hidden="true" />{lessonDuration(lesson.videoSeconds)}</span>
        </span>
        <span className="flex flex-1 flex-col gap-2 p-4">
            <span className="text-base font-semibold text-foreground">{lesson.title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{lesson.summary}</span>
            <span className="mt-auto pt-1 text-xs font-medium text-primary">Watch or read · {lesson.readMinutes} min read</span>
        </span>
    </Link>
}
