"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Monitor, Moon, Send, Sparkles, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiError, apiGet, apiPost } from "@/lib/api-client"
import { useAuth } from "@/components/providers/auth-provider"
import { useAppearance, type Appearance } from "@/components/providers/appearance-provider"
import { Badge, Button, IconChip, Notice, SectionLabel } from "@/components/ui/primitives"
import { planFor, type BillingInterval, type PlanTier } from "@/lib/plans"

/**
 * Account — the web port of Features/Auth/AccountView.swift: sign-in hero or
 * the signed-in card, then PLAN, APPEARANCE, FEEDBACK, ABOUT, and account
 * deletion (which the app must offer in-app, not by email).
 */
export default function AccountPage() {
    const { user, loading, signOut, deleteAccount } = useAuth()
    const { appearance, setAppearance } = useAppearance()
    const [entitlement, setEntitlement] = useState<{
        tier: PlanTier | null
        interval: BillingInterval | null
        active: boolean
    } | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    useEffect(() => {
        if (!user) {
            setEntitlement(null)
            return
        }
        apiGet<{ tier: PlanTier | null; interval: BillingInterval | null; active: boolean }>(
            "/api/billing/entitlement"
        )
            .then(setEntitlement)
            .catch((err: unknown) => {
                // Billing not configured (503) or signed out (401) simply reads
                // as the free state.
                if (!(err instanceof ApiError)) setEntitlement(null)
            })
    }, [user])

    const planName = entitlement?.active ? planFor(entitlement.tier)?.name : undefined

    async function onDelete() {
        const confirmed = window.confirm(
            "Delete your account? This permanently deletes your FinnaCalc account and cannot be undone."
        )
        if (!confirmed) return
        setDeleting(true)
        setDeleteError(null)
        try {
            await deleteAccount()
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
        }
        setDeleting(false)
    }

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6">
            <h1 className="text-[15.5px] font-bold text-foreground">Account</h1>

            {loading ? (
                <div className="rounded-2xl border border-border bg-card p-[18px] text-sm text-muted-foreground">
                    Loading…
                </div>
            ) : user ? (
                <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-[18px]">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-[17px] font-bold text-white">
                        {user.displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-bold text-foreground">{user.displayName}</span>
                        <span className="truncate text-[12.5px] text-muted-foreground">{user.email}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="text-[13px] font-semibold text-destructive"
                    >
                        Sign out
                    </button>
                </section>
            ) : (
                <section className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-[18px] text-center">
                    <span className="inline-flex h-13 w-13 items-center justify-center rounded-full bg-primary/12 p-3.5 text-primary">
                        <Sparkles className="h-5 w-5" />
                    </span>
                    <p className="text-[15.5px] font-bold text-foreground">Save your progress</p>
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                        Budgets, goals &amp; brokerage sync across devices with a free account.
                    </p>
                    <Link
                        href="/sign-in?next=/account"
                        className="mt-1 w-full rounded-full bg-primary py-3 text-sm font-bold text-white"
                    >
                        Sign in or create account
                    </Link>
                </section>
            )}

            <section className="flex flex-col gap-2.5">
                <SectionLabel>Plan</SectionLabel>
                <Link
                    href="/plans"
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-border-strong"
                >
                    <IconChip>
                        <Sparkles className="h-4 w-4" />
                    </IconChip>
                    <span className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-foreground">
                            {planName ?? "Upgrade to FinnaCalc Pro"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {planName
                                ? `${entitlement?.interval === "annual" ? "Annual" : "Monthly"} · manage your plan`
                                : "Budgeting, investing & everything else"}
                        </span>
                    </span>
                    {planName && (
                        <Badge variant="positive" dot>
                            Active
                        </Badge>
                    )}
                    <span className="text-border-strong">›</span>
                </Link>
            </section>

            <section className="flex flex-col gap-2.5">
                <SectionLabel>Appearance</SectionLabel>
                <div className="flex rounded-full bg-secondary p-[3px]">
                    {(
                        [
                            { value: "system", label: "System", Icon: Monitor },
                            { value: "light", label: "Light", Icon: Sun },
                            { value: "dark", label: "Dark", Icon: Moon },
                        ] as { value: Appearance; label: string; Icon: typeof Monitor }[]
                    ).map(({ value, label, Icon }) => {
                        const selected = appearance === value
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setAppearance(value)}
                                className={cn(
                                    "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] transition",
                                    selected
                                        ? "bg-card font-bold text-foreground shadow-sm"
                                        : "font-semibold text-muted-foreground"
                                )}
                            >
                                <Icon className={cn("h-3.5 w-3.5", selected && "text-primary")} />
                                {label}
                            </button>
                        )
                    })}
                </div>
            </section>

            <FeedbackSection email={user?.email} userId={user?.id} />

            <section className="flex flex-col gap-2.5">
                <SectionLabel>About</SectionLabel>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    {[
                        { href: "/about", label: "About FinnaCalc" },
                        { href: "/privacy", label: "Privacy policy" },
                        { href: "/terms", label: "Terms of service" },
                    ].map((row, index) => (
                        <Link
                            key={row.href}
                            href={row.href}
                            className={cn(
                                "flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-foreground transition hover:bg-secondary/60",
                                index > 0 && "border-t border-border"
                            )}
                        >
                            {row.label}
                            <span className="text-border-strong">›</span>
                        </Link>
                    ))}
                </div>
            </section>

            {user && (
                <div className="flex flex-col gap-2">
                    {deleteError && <Notice tone="error">{deleteError}</Notice>}
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="py-1 text-center text-[13px] font-semibold text-destructive disabled:opacity-50"
                    >
                        {deleting ? "Deleting…" : "Delete account"}
                    </button>
                </div>
            )}
        </div>
    )
}

/** Send feedback — the same /api/feedback endpoint the app posts to. */
function FeedbackSection({ email, userId }: { email?: string; userId?: string }) {
    const [open, setOpen] = useState(false)
    const [message, setMessage] = useState("")
    const [replyTo, setReplyTo] = useState("")
    const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (email) setReplyTo(email)
    }, [email])

    async function onSubmit(event: FormEvent) {
        event.preventDefault()
        setStatus("sending")
        setError(null)
        try {
            await apiPost("/api/feedback", {
                message,
                email: replyTo || undefined,
                userId,
                source: "web",
            })
            setStatus("sent")
            setMessage("")
        } catch (err) {
            setStatus("idle")
            setError(err instanceof Error ? err.message : "Couldn't send that. Please try again.")
        }
    }

    return (
        <section className="flex flex-col gap-2.5">
            <SectionLabel>Feedback</SectionLabel>
            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition hover:border-border-strong"
                >
                    Send feedback
                    <Send className="h-3.5 w-3.5 text-primary" />
                </button>
            ) : (
                <form onSubmit={onSubmit} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
                    {status === "sent" ? (
                        <Notice tone="info">Thanks — that landed in our inbox.</Notice>
                    ) : (
                        <>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                required
                                placeholder="What's working, what isn't, what you wish existed…"
                                className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                            />
                            <input
                                type="email"
                                value={replyTo}
                                onChange={(e) => setReplyTo(e.target.value)}
                                placeholder="Your email (optional, so we can reply)"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                            />
                            {error && <Notice tone="error">{error}</Notice>}
                            <div className="flex gap-2">
                                <Button type="submit" disabled={status === "sending" || message.trim() === ""}>
                                    {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Send
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </>
                    )}
                </form>
            )}
        </section>
    )
}
