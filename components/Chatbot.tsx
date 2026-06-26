"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, X } from "lucide-react"
import { useChat } from "@ai-sdk/react"

const WELCOME_CONTENT =
    "Hi! I'm FinnaBot. Ask me about budgeting, investing, taxes, or any of the calculators on this site. I'm not a licensed advisor, so verify anything important with a professional."

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const { messages, input, setInput, isLoading, append, error } = useChat({
        api: "/api/chat",
        initialMessages: [{ id: "welcome", role: "assistant", content: WELCOME_CONTENT }],
    })

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, [messages, isLoading])

    useEffect(() => {
        if (isOpen) inputRef.current?.focus()
    }, [isOpen])

    const send = async () => {
        const trimmed = input.trim()
        if (!trimmed || isLoading) return
        setInput("")
        await append({ role: "user", content: trimmed })
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
                    <p className="text-xs text-muted-foreground mt-1">Personal finance & business AI assistant · Powered by Gemini</p>
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
                            {error.message}
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
