"use client"

import dynamic from "next/dynamic"

// useChat generates internal IDs that differ between server and client renders.
// Loading the chatbot client-only prevents the hydration mismatch.
const ChatBot = dynamic(() => import("./Chatbot"), { ssr: false })

export default function ChatBotWrapper() {
    return <ChatBot />
}
