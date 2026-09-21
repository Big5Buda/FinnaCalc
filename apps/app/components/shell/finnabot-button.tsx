"use client"

import { useChat } from "@/components/providers/chat-provider"

/**
 * FinnaBot's corner button, on every page: the blue circle with his face
 * that the site had from the start.
 *
 * It read as a white disc for a while, because the button borrowed the
 * page's `primary` token and that token was ink in light mode and white in
 * dark. The token is the app's blue again, and this draws the logo the old
 * launcher drew rather than a generic chat glyph. It hides while the panel
 * is open, since the panel has its own way to close.
 */
export function FinnaBotButton() {
    const { open, openChat } = useChat()
    if (open) return null
    return (
        <button
            type="button"
            onClick={() => openChat()}
            aria-label="Ask FinnaBot"
            className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition hover:bg-primary-hover"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/finnabot-logo.png" alt="" className="h-8 w-8 object-contain" />
        </button>
    )
}
