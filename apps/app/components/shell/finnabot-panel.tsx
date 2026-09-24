"use client"

import Image from "next/image"
import { useEffect, useRef, type FormEvent, type ReactNode } from "react"
import { SendHorizonal, X } from "lucide-react"
import { useChat, type ChatMessage, WELCOME_ID } from "@/components/providers/chat-provider"
import { Wordmark } from "@/components/shell/wordmark"

/**
 * The FinnaBot panel: a popup that sits on the launcher button in the bottom
 * corner. The conversation lives in ChatProvider at the shell, so closing the
 * panel or moving between pages never loses the thread.
 *
 * It spent a while as a full-height drawer with a dimmed page behind it,
 * which is the wrong shape for this. FinnaBot answers a question about what
 * you are already looking at, so the page has to stay readable and
 * unobstructed while he answers. The original widget was a 24rem by 32rem
 * card pinned to the corner and this is that card again, capped by the
 * viewport so a short window or a phone gets a popup that still fits.
 *
 * `svh` rather than `vh`: mobile browsers count their collapsing address bar
 * in `vh`, so a `vh` cap puts the composer under the chrome on first paint.
 *
 * Assistant replies are blue on the leading edge, the user's are neutral grey
 * on the trailing edge, so the two sides read as clearly different voices.
 */
export function FinnaBotPanel() {
    const { messages, input, setInput, isLoading, error, open, closeChat, send } = useChat()
    const endRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const panelRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, [messages, isLoading, open])

    useEffect(() => {
        if (open) inputRef.current?.focus()
    }, [open])

    useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeChat()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, closeChat])

    // A click anywhere else closes it. The full-height version got this from
    // its scrim; without a scrim the popup has to listen for itself, or the
    // only way out is the X.
    useEffect(() => {
        if (!open) return
        const onDown = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) closeChat()
        }
        document.addEventListener("mousedown", onDown)
        return () => document.removeEventListener("mousedown", onDown)
    }, [open, closeChat])

    if (!open) return null

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        send()
    }

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-label="FinnaBot"
            className="fixed bottom-4 right-4 z-50 flex h-[min(32rem,calc(100svh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        >
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
                <Image
                    src="/finnabot-logo.png"
                    alt=""
                    width={22}
                    height={30}
                    className="h-7 w-5 object-contain"
                />
                <span className="flex-1 text-base font-bold">
                    <Wordmark className="text-base" />
                    <span className="sr-only">FinnaBot</span>
                </span>
                <button
                    type="button"
                    onClick={closeChat}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-secondary"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-3">
                    {messages.map((message) => (
                        <Bubble key={message.id} message={message} />
                    ))}
                    {isLoading && <TypingDots />}
                    {error && (
                        <p className="rounded-sm bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
                    )}
                    <div ref={endRef} />
                </div>
            </div>

            <form onSubmit={onSubmit} className="flex shrink-0 items-end gap-2 border-t border-border p-3">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            send()
                        }
                    }}
                    rows={1}
                    placeholder="Ask FinnaBot a question…"
                    aria-label="Message FinnaBot"
                    disabled={isLoading}
                    className="max-h-28 flex-1 resize-none rounded-2xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
                <button
                    type="submit"
                    disabled={isLoading || input.trim() === ""}
                    aria-label="Send"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-primary-foreground transition disabled:opacity-50"
                >
                    <SendHorizonal className="h-4 w-4" />
                </button>
            </form>
        </div>
    )
}

function Bubble({ message }: { message: ChatMessage }) {
    if (message.role === "user") {
        return (
            <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-3 py-2 text-sm text-foreground">
                    {message.content}
                </p>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-1">
            <div className="max-w-[92%] rounded-2xl bg-brand px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
                {renderMarkdown(message.content)}
            </div>
            {/* Under every answer, not only the ones a cue list guessed were about
                money. The welcome is the one exception: nothing has been asked
                yet, so there is nothing to disclaim. */}
            {message.content !== "" && message.id !== WELCOME_ID && (
                <p className="pl-1 text-[10.5px] text-muted-foreground">
                    FinnaBot is AI — this isn’t financial advice.
                </p>
            )}
        </div>
    )
}

function TypingDots() {
    return (
        <div className="flex w-fit gap-1 rounded-2xl bg-muted px-3 py-2.5">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </div>
    )
}

/**
 * Renders the assistant's markdown the way Claude-style replies read: inline
 * **bold** and `code` styled, line breaks preserved, list markers normalized to
 * bullets, heading markers folded into bold lines.
 */
function renderMarkdown(raw: string): ReactNode {
    const lines = raw.split("\n")
    return lines.map((line, index) => {
        const heading = line.match(/^#{1,6}\s*(.+)$/)
        const bullet = line.match(/^(\s*)[-*]\s+(.+)$/)
        let content: ReactNode
        if (heading) {
            content = <strong>{inline(heading[1])}</strong>
        } else if (bullet) {
            content = <>• {inline(bullet[2])}</>
        } else {
            content = inline(line)
        }
        return (
            <p key={index} className={line.trim() === "" ? "h-2" : undefined}>
                {content}
            </p>
        )
    })
}

function inline(text: string): ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
            return (
                <code key={index} className="rounded bg-white/20 px-1 font-mono text-[0.85em]">
                    {part.slice(1, -1)}
                </code>
            )
        }
        return <span key={index}>{part}</span>
    })
}
