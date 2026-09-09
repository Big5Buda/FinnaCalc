/**
 * FinnaCalc's own lessons — the same text the app ships, published free and
 * un-gated on the web. See lessons-types.ts for the shape and lessons.generated.ts
 * for where the text comes from.
 */

import { LESSONS, LESSONS_GENERATED_FROM } from "./lessons.generated"
import type { Lesson, LessonBlock } from "./lessons-types"

export { LESSONS, LESSONS_GENERATED_FROM, LESSON_DISCLOSURE } from "./lessons.generated"
export type { Lesson, LessonBlock }

/** Every lesson in one topic, in teaching order. */
export function lessonsIn(topic: string): Lesson[] {
    return LESSONS.filter((lesson) => lesson.topic === topic)
}

export function lessonById(id: string): Lesson | undefined {
    return LESSONS.find((lesson) => lesson.id === id)
}

/** The poster the app shows before play: the video's stem with a .jpg. */
export function posterURL(lesson: Lesson): string | null {
    return lesson.videoURL ? lesson.videoURL.replace(/\.mp4$/, ".jpg") : null
}
