/**
 * The shape of a FinnaCalc lesson as published on the web.
 *
 * Mirrors ArticleBlock and EduLesson in the iOS app
 * (Features/Education/EducationLesson.swift). The app is the source of truth
 * for the text; lessons.generated.ts is produced from it by
 * FinnaCalcIOS/Scripts/export-lessons.sh and is never edited by hand.
 */

export type LessonBlock =
    /** A section heading. */
    | { type: "heading"; text: string }
    /** A paragraph. `**bold**` and `*italic*` are honoured by the renderer. */
    | { type: "paragraph"; text: string }
    /** A bulleted list. Each entry may lead with `**A bold lead-in.**`. */
    | { type: "bullets"; items: string[] }
    /** A numbered list, same formatting rules. */
    | { type: "numbered"; items: string[] }
    /** The "Key takeaways" box that closes every lesson. */
    | { type: "takeaways"; items: string[] }
    /** The closing note toward a FinnaCalc tool. Rendered as a tinted note. */
    | { type: "callout"; text: string }

export type Lesson = {
    /** Stable; used in URLs. The app never renumbers a published lesson. */
    id: string
    /** Matches an id in EDU_TOPICS. */
    topic: string
    title: string
    /** The deck line under the title, one sentence. */
    summary: string
    /** Minutes to read at 220 words per minute, floored at one — computed by the app. */
    readMinutes: number
    /** The narrated video, or null for a reading-only lesson. */
    videoURL: string | null
    videoSeconds: number
    body: LessonBlock[]
}

/**
 * The line every lesson carries, above the article — the same words the app
 * shows (Features/Education/LessonDisclosure.swift). A claim about the
 * CONTENT on purpose: the text is identical for every reader and nothing a
 * reader has entered anywhere reaches it.
 */
export const LESSON_DISCLOSURE =
    "Nothing you have entered or connected in FinnaCalc changes a word of this lesson. It is the same text for every reader, written as general education and not as advice about your situation."
