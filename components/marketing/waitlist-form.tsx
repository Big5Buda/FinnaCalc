"use client"

import { useState, type FormEvent } from "react"
import { Check, Loader2 } from "lucide-react"

type Status = "idle" | "loading" | "done" | "error"

export function WaitlistForm({
    referralSource,
    buttonLabel = "Join the waitlist",
}: {
    referralSource?: string
    buttonLabel?: string
}) {
    const [email, setEmail] = useState("")
    const [status, setStatus] = useState<Status>("idle")
    const [message, setMessage] = useState("")

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setStatus("loading")
        try {
            const res = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, referralSource }),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) {
                setStatus("error")
                setMessage(data.error ?? "Something went wrong. Try again.")
                return
            }
            setStatus("done")
            setMessage(
                data.alreadyJoined
                    ? "You're already on the list. See you at launch."
                    : "You're in. We'll email you the moment FinnaCalc launches."
            )
        } catch {
            setStatus("error")
            setMessage("Network error. Please try again.")
        }
    }

    if (status === "done") {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                {message}
            </div>
        )
    }

    return (
        <form onSubmit={onSubmit} className="w-full max-w-md">
            <div className="flex flex-col gap-3 sm:flex-row">
                <input
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    aria-label="Email address"
                    className="h-12 flex-1 rounded-xl border border-input bg-white px-4 text-base text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-70"
                >
                    {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {status === "loading" ? "Joining…" : buttonLabel}
                </button>
            </div>
            {status === "error" && <p className="mt-2 text-sm text-destructive">{message}</p>}
        </form>
    )
}
