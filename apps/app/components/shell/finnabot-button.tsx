"use client"

import { FinnaBotMark } from "@/components/shell/finnabot-mark"
import { useChat } from "@/components/providers/chat-provider"

/** Theme-matched app artwork on a neutral surface, framed in company blue. */
export function FinnaBotButton() {
    const { open, openChat } = useChat()
    if (open) return null
    return (
        <button
            type="button"
            onClick={() => openChat()}
            aria-label="Ask FinnaBot"
            className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/50 bg-card shadow-lg transition hover:border-primary hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
            <FinnaBotMark className="h-11 w-7" />
        </button>
    )
}
