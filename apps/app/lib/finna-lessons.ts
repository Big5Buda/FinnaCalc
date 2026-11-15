import catalog from "./finna-lesson-index.json"

/** Existing FinnaCalc app lessons, exported without rewriting their text. */
export type LessonBlock = { type: "heading" | "paragraph" | "callout"; text: string }
    | { type: "bullets" | "numbered" | "takeaways"; items: string[] }
export type FinnaLesson = {
    id: string; topic: string; title: string; summary: string; videoFile: string
    videoSeconds: number; readMinutes: number; body: LessonBlock[]
}
export type FinnaLessonSummary = Omit<FinnaLesson,"body">
export const finnaLessons: FinnaLessonSummary[] = catalog
export const LESSON_VIDEO_BASE = "https://pub-257565bd7835442abeca2beb3b572c1d.r2.dev/New%20folder/"
export function lessonVideo(lesson: FinnaLessonSummary) { return LESSON_VIDEO_BASE + encodeURIComponent(lesson.videoFile) }
export function lessonPoster(lesson: FinnaLessonSummary) { return LESSON_VIDEO_BASE + encodeURIComponent(lesson.videoFile.replace(/\.mp4$/, ".jpg")) }
export function lessonHref(lesson: FinnaLessonSummary) { return `/education/${lesson.topic}/${lesson.id}` }
export function lessonDuration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
