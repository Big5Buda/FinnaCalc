"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, X } from "lucide-react"

type Message = { id: string; role: "user" | "assistant"; content: string }

const WELCOME_CONTENT =
    "Hi! I'm FinnaBot. Ask me about budgeting, investing, taxes, or any of the calculators on this site. I'm not a licensed advisor, so verify anything important with a professional."

// Persist the conversation for the current browser session, so closing and
// reopening FinnaBot (or navigating around the site) keeps the chat. Cleared
// when the tab/session ends.
const STORAGE_KEY = "finnabot.chat"

function uid() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
}

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = window.sessionStorage.getItem(STORAGE_KEY)
                if (saved) {
                    const parsed = JSON.parse(saved)
                    if (Array.isArray(parsed) && parsed.length) return parsed
                }
            } catch {
                /* ignore */
            }
        }
        return [{ id: "welcome", role: "assistant", content: WELCOME_CONTENT }]
    })
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, [messages, isLoading])

    // Save the conversation for the session whenever it changes.
    useEffect(() => {
        try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
        } catch {
            /* ignore */
        }
    }, [messages])

    useEffect(() => {
        if (isOpen) inputRef.current?.focus()
    }, [isOpen])

    const send = async () => {
        const trimmed = input.trim()
        if (!trimmed || isLoading) return

        setError(null)
        const userMessage: Message = { id: uid(), role: "user", content: trimmed }
        const history = [...messages, userMessage]
        setMessages(history)
        setInput("")
        setIsLoading(true)

        const assistantId = uid()
        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // Drop the welcome message so the model conversation starts with a user turn
                    messages: history
                        .filter((m) => m.id !== "welcome")
                        .map(({ role, content }) => ({ role, content })),
                }),
            })

            if (!res.ok || !res.body) {
                const detail = await res.text().catch(() => "")
                throw new Error(detail || `Request failed (${res.status}). Please try again.`)
            }

            // Add an empty assistant bubble, then stream tokens into it
            setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let accumulated = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                accumulated += decoder.decode(value, { stream: true })
                setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
                )
            }

            if (!accumulated.trim()) {
                setMessages((prev) => prev.filter((m) => m.id !== assistantId))
                throw new Error("No response received. Please try again.")
            }
        } catch (e: any) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            setError(e?.message ?? "Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            send()
        }
    }

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg p-0"
                aria-label="Open FinnaBot"
            >
                <MessageCircle className="h-7 w-7 text-white" />
            </Button>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <Card className="w-96 h-[32rem] flex flex-col shadow-xl border-border">
                <CardHeader className="p-4 pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Image src="/finnabot-logo.png" alt="FinnaBot" width={24} height={24} />
                            <CardTitle className="text-base">
                                Finna<span className="text-blue-600 dark:text-blue-400">Bot</span>
                            </CardTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="p-2 -mr-2"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Personal finance &amp; business AI assistant
                    </p>
                </CardHeader>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                    m.role === "user"
                                        ? "bg-blue-600 text-white rounded-br-sm"
                                        : "bg-muted text-foreground rounded-bl-sm"
                                }`}
                            >
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                                <TypingDots />
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1.5">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-border">
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask FinnaBot anything..."
                            disabled={isLoading}
                            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                        />
                        <Button
                            onClick={send}
                            disabled={isLoading || !input.trim()}
                            size="sm"
                            className="rounded-full h-9 w-9 p-0 bg-blue-600 hover:bg-blue-700"
                            aria-label="Send"
                        >
                            <Send className="h-4 w-4 text-white" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

function TypingDots() {
    return (
        <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" />
        </span>
    )
}
