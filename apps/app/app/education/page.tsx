"use client"
import Link from "next/link"
import { useMemo, useState } from "react"
import * as Icons from "lucide-react"
import { ArrowUpRight, BookOpen, Search, X } from "lucide-react"
import { EDU_TOPIC_META, readingResources, topicName } from "@/lib/education-content"
import { finnaLessons, lessonHref } from "@/lib/finna-lessons"
import { FinnaLessonCard } from "@/components/education/finna-lesson-card"
import { SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/** Web library: responsive grids of the owner's lessons, without the app-only weekly card. */
export default function EducationPage() {
    const [query, setQuery] = useState("")
    const trimmed = query.trim().toLowerCase()
    const articleResults = useMemo(() => Object.entries(readingResources).flatMap(([topic, items]) => items.map(item => ({...item, topic}))).filter(item => `${item.title} ${topicName(item.topic)}`.toLowerCase().includes(trimmed)), [trimmed])
    const results = useMemo(() => finnaLessons.filter(l => `${l.title} ${l.summary} ${topicName(l.topic)}`.toLowerCase().includes(trimmed)), [trimmed])
    const picks = ["investing-01", "credit-01", "budgeting-01", "retirement-01"].flatMap(id => finnaLessons.find(l => l.id === id) ?? [])
    const quickReads = EDU_TOPIC_META.slice(0, 4).flatMap(meta => (readingResources[meta.id] ?? []).slice(0, 1).map(item => ({ ...item, topic: meta.title })))
    return <>
        <PageBar title="Education" />
        <PageBody className="flex flex-col gap-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-2xl font-semibold text-foreground">Learn about your money</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">FinnaCalc lessons on budgeting, investing, credit, retirement, taxes and business. Watch a short video or read at your own pace.</p></div>
                <div className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-3 sm:max-w-sm">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input aria-label="Search lessons" placeholder="Search lessons" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X className="h-4 w-4" /></button>}
                </div>
            </header>
            {trimmed ? <section className="flex flex-col gap-4"><SectionLabel>{results.length + articleResults.length} results found</SectionLabel>
                {results.length + articleResults.length ? <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{results.map(lesson => <FinnaLessonCard key={lesson.id} lesson={lesson} />)}{articleResults.map(item => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-3 rounded-card border border-border bg-card p-5 hover:border-border-strong"><BookOpen className="h-5 w-5 text-primary" /><span className="text-base font-semibold">{item.title}</span><span className="text-sm text-muted-foreground">{topicName(item.topic)} · External article</span></a>)}</div> : <p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">No lessons match your search. Try another topic or clear the search to browse.</p>}
            </section> : <>
                <section className="flex flex-col gap-4"><SectionLabel>Start learning</SectionLabel><div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{picks.map(lesson => <FinnaLessonCard key={lesson.id} lesson={lesson} />)}</div></section>
                <section className="flex flex-col gap-4"><SectionLabel>Browse topics</SectionLabel><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {EDU_TOPIC_META.map(meta => { const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? BookOpen; const count = finnaLessons.filter(l => l.topic === meta.id).length; return <Link key={meta.id} href={`/education/${meta.id}`} className="flex items-start gap-4 rounded-card border border-border bg-card p-5 transition hover:border-border-strong"><span className="rounded-full bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></span><span><span className="block text-base font-semibold">{meta.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{meta.blurb}</span><span className="mt-3 block text-xs text-muted-foreground">{count} lessons</span></span></Link> })}
                </div></section>
                <section className="flex flex-col gap-4"><SectionLabel>Further reading</SectionLabel><div className="grid gap-4 sm:grid-cols-2">{quickReads.map(item => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-card border border-border bg-card p-5 hover:border-border-strong"><BookOpen className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.topic} · External article</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" /></a>)}</div></section>
            </>}
        </PageBody>
    </>
}
