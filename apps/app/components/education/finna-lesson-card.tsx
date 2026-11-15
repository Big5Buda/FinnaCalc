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
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white"><Play className="h-3 w-3" aria-hidden="true" />{lessonDuration(lesson.videoSeconds)}</span>
        </span>
        <span className="flex flex-1 flex-col gap-1.5 p-3">
            <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">{lesson.title}</span>
            <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{lesson.summary}</span>
            <span className="mt-auto pt-1 text-[11px] leading-4 font-medium text-primary">Watch or read · {lesson.readMinutes} min read</span>
        </span>
    </Link>
}
