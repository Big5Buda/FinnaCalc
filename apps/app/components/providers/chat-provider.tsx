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

/** Exported so the panel can leave the not-advice line off the welcome. */
export const WELCOME_ID = "welcome"

// There used to be a cue list here — "should i", "buy", "sell", "roth" and
// thirty others — and a reply carried the not-advice line only when the
// USER's question had tripped it. Wrong trigger: a neutrally worded question
// can still draw an answer about what to own, and read as evidence rather
// than as a control the list was the app's own definition of "a request for
// a recommendation", followed by the app answering it. The line now renders
// under every answer (finnabot-panel.tsx). Whether the answer itself stays
// inside the fence is the server's job (lib/advice-guard.ts), not something
// a substring match on the question could decide. Same change as the iOS
// app, FinnaCalcIOS#338.

export type ChatMessage = {
    id: string
    role: "user" | "assistant"
    content: string
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
            let appended = false

            postTextStream("/api/chat", { messages: payload }, (text) => {
                if (!appended) {
                    appended = true
                    setMessages((prev) => [
                        ...prev,
                        { id: assistantId, role: "assistant", content: text },
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
