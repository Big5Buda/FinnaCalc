import type { Metadata } from "next"
import Link from "next/link"
import { EDU_TOPIC_META } from "@finnacalc/shared/education-content"
import { LESSONS_GENERATED_FROM, lessonsIn } from "@finnacalc/shared/lessons"

export const metadata: Metadata = {
    title: "All lessons — Learn",
    description: "Every FinnaCalc lesson, in full, free to read. The same text the app shows.",
}

/** The whole library on one page, by topic — the index of the publication. */
export default function LessonsIndex() {
    return (
        <main className="bg-paper pt-[92px]">
            <div className="mx-auto flex max-w-site flex-col gap-12 px-6 pb-24 pt-16">
                <header className="flex max-w-2xl flex-col gap-3">
                    <p className="text-sm font-medium text-ink-muted">
                        <Link href="/education" className="hover:underline">
                            Learn
                        </Link>
                    </p>
                    <h1 className="headline-sans text-[clamp(2.25rem,4.2vw,3.5rem)] text-ink">All lessons</h1>
                    <p className="text-xl leading-relaxed text-ink-soft">
                        Every lesson FinnaCalc has written, in full. Free, no account, the same text the app shows.
                    </p>
                </header>
                <div className="grid gap-12 lg:grid-cols-2">
                    {EDU_TOPIC_META.map((topic) => {
                        const lessons = lessonsIn(topic.id)
                        if (lessons.length === 0) return null
                        return (
                            <section key={topic.id} className="flex flex-col gap-4">
                                <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
                                    <Link href={`/education/${topic.id}`} className="hover:underline">
                                        {topic.title}
                                    </Link>
                                </h2>
                                <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-chip">
                                    {lessons.map((lesson, index) => (
                                        <li key={lesson.id} className={index > 0 ? "border-t border-line" : ""}>
                                            <Link
                                                href={`/education/lessons/${lesson.id}`}
                                                className="flex flex-col gap-1 px-5 py-4 transition-colors duration-[350ms] ease-ws hover:bg-ink/[0.03]"
                                            >
                                                <span className="text-[15px] font-medium text-ink">{lesson.title}</span>
                                                <span className="text-sm text-ink-muted">
                                                    {lesson.summary} · {lesson.readMinutes} min
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )
                    })}
                </div>
                <p className="max-w-2xl border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
                    Published from the app&rsquo;s own text at build {LESSONS_GENERATED_FROM}.
                </p>
            </div>
        </main>
    )
}
