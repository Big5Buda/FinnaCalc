"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { ApiError, postTextStream } from "@/lib/api-client"

/**
 * FinnaBot's conversation, ported from the iOS ChatViewModel
 * (Features/Chat/FinnaBotView.swift). It lives at the app shell so the thread
 * survives closing the panel and navigating between pages.
 */

const WELCOME =
    "Hi! I'm FinnaBot. Ask me about budgeting, investing, taxes, or any of the calculators in the app."

const WELCOME_ID = "welcome"

/**
 * Phrases that make a question a request for a recommendation rather than an
 * explanation. Deliberately broad — over-disclaiming is harmless, a missed one
 * isn't.
 */
const ADVICE_CUES = [
    "should i", "should we", "should my", "advice", "advise", "recommend",
    "what should", "which should", "worth it", "is it worth", "better to",
    "which is better", "is it smart", "good idea", "do you think i",
    "invest in", "buy", "sell", "pick", "portfolio", "allocate", "allocation",
    "how much should", "can i afford", "pay off", "payoff", "refinance",
    "roth", "401k", "ira", "retire", "best stock", "what stock", "which stock",
]

export function seeksAdvice(text: string): boolean {
    const lower = text.toLowerCase()
    return ADVICE_CUES.some((cue) => lower.includes(cue))
}

export type ChatMessage = {
    id: string
    role: "user" | "assistant"
    content: string
    /** Reply to a "what should I do with my money" question — carries fine print. */
    needsAdviceDisclaimer?: boolean
}

type ChatContextValue = {
    messages: ChatMessage[]
    input: string
    setInput: (value: string) => void
    isLoading: boolean
    error: string | null
    open: boolean
    openChat: (question?: string) => void
    closeChat: () => void
    send: (text?: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: WELCOME_ID, role: "assistant", content: WELCOME },
    ])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(false)
    const loadingRef = useRef(false)

    const send = useCallback(
        (override?: string) => {
            const trimmed = (override ?? input).trim()
            if (!trimmed || loadingRef.current) return

            loadingRef.current = true
            setError(null)
            setInput("")
            setIsLoading(true)

            const userMessage: ChatMessage = {
                id: `u-${Date.now()}`,
                role: "user",
                content: trimmed,
            }

            // Drop the welcome line so the model conversation starts on a user turn.
            const payload = [...messages, userMessage]
                .filter((m) => m.id !== WELCOME_ID)
                .map(({ role, content }) => ({ role, content }))

            setMessages((prev) => [...prev, userMessage])

            const assistantId = `a-${Date.now()}`
            const disclaim = seeksAdvice(trimmed)
            let appended = false

            postTextStream("/api/chat", { messages: payload }, (text) => {
                if (!appended) {
                    appended = true
                    setMessages((prev) => [
                        ...prev,
                        { id: assistantId, role: "assistant", content: text, needsAdviceDisclaimer: disclaim },
                    ])
                    return
                }
                setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m)))
            })
                .then(() => {
                    setMessages((prev) => {
                        const streamed = prev.find((m) => m.id === assistantId)
                        if (streamed && streamed.content.trim() === "") {
                            setError("No response received. Please try again.")
                            return prev.filter((m) => m.id !== assistantId)
                        }
                        return prev
                    })
                    if (!appended) setError("No response received. Please try again.")
                })
                .catch((err: unknown) => {
                    setMessages((prev) => prev.filter((m) => m.id !== assistantId))
                    setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
                })
                .finally(() => {
                    loadingRef.current = false
                    setIsLoading(false)
                })
        },
        [input, messages]
    )

    const openChat = useCallback((question?: string) => {
        setOpen(true)
        if (question) setInput(question)
    }, [])

    const value = useMemo<ChatContextValue>(
        () => ({
            messages,
            input,
            setInput,
            isLoading,
            error,
            open,
            openChat,
            closeChat: () => setOpen(false),
            send,
        }),
        [messages, input, isLoading, error, open, openChat, send]
    )

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatContextValue {
    const ctx = useContext(ChatContext)
    if (!ctx) throw new Error("useChat must be used inside <ChatProvider>")
    return ctx
}
