import { Fragment, type ReactNode } from "react"
import type { LessonBlock } from "@finnacalc/shared/lessons"

/**
 * Renders a lesson's blocks the way the app does: headings, paragraphs,
 * lists, the "Key takeaways" box, and the closing tinted note. Inline
 * `**bold**` and `*italic*` are parsed to elements — never to HTML — so the
 * text can carry nothing the app didn't.
 */

function inline(text: string): ReactNode {
    const parts: ReactNode[] = []
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
    let last = 0
    let match: RegExpExecArray | null
    let key = 0
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index))
        const token = match[0]
        parts.push(
            token.startsWith("**") ? (
                <strong key={key++} className="font-semibold text-ink">
                    {token.slice(2, -2)}
                </strong>
            ) : (
                <em key={key++}>{token.slice(1, -1)}</em>
            )
        )
        last = match.index + token.length
    }
    if (last < text.length) parts.push(text.slice(last))
    return <Fragment>{parts}</Fragment>
}

function List({ items, ordered }: { items: string[]; ordered: boolean }) {
    const Tag = ordered ? "ol" : "ul"
    return (
        <Tag className={`flex flex-col gap-2 pl-6 text-[17px] leading-relaxed text-ink-soft ${ordered ? "list-decimal" : "list-disc"}`}>
            {items.map((item, index) => (
                <li key={index}>{inline(item)}</li>
            ))}
        </Tag>
    )
}

export function LessonArticle({ blocks }: { blocks: LessonBlock[] }) {
    return (
        <div className="flex flex-col gap-5">
            {blocks.map((block, index) => {
                switch (block.type) {
                    case "heading":
                        return (
                            <h2 key={index} className="headline-sans pt-4 text-2xl text-ink">
                                {inline(block.text)}
                            </h2>
                        )
                    case "paragraph":
                        return (
                            <p key={index} className="text-[17px] leading-relaxed text-ink-soft">
                                {inline(block.text)}
                            </p>
                        )
                    case "bullets":
                        return <List key={index} items={block.items} ordered={false} />
                    case "numbered":
                        return <List key={index} items={block.items} ordered />
                    case "takeaways":
                        return (
                            <section
                                key={index}
                                className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-chip px-6 py-5"
                            >
                                <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
                                    Key takeaways
                                </h2>
                                <List items={block.items} ordered={false} />
                            </section>
                        )
                    case "callout":
                        return (
                            <p
                                key={index}
                                className="rounded-lg border border-line bg-chip px-5 py-4 text-[15px] leading-relaxed text-ink-soft"
                            >
                                {inline(block.text)}
                            </p>
                        )
                }
            })}
        </div>
    )
}
