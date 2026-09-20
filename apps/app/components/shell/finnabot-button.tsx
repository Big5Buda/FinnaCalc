"use client"

import { MessageCircle } from "lucide-react"
import { useChat } from "@/components/providers/chat-provider"

/**
 * FinnaBot's corner button, on every page.
 *
 * The old site kept the chat in the bottom-right corner wherever you were;
 * the rail moved it into a sidebar icon, and with the rail gone it needs a
 * home again. It hides while the panel is open, since the panel has its own
 * way to close.
 */
export function FinnaBotButton() {
    const { open, openChat } = useChat()
    if (open) return null
    return (
        <button
            type="button"
            onClick={() => openChat()}
            aria-label="Ask FinnaBot"
            className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary-hover"
        >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
        </button>
    )
}
