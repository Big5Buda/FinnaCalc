"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Check, Download, X } from "lucide-react"
import {
    MAX_FRAGMENT_LENGTH,
    clearLocalData,
    encodeHandoff,
    hasLocalData,
    readLocalData,
} from "@finnacalc/shared/storage"
import { appUrl } from "@/lib/app-url"
import { Button } from "@/components/ui/button"

/**
 * Moves data stranded by the domain split.
 *
 * Budgets, goals, history and the watchlist were saved in localStorage on
 * www.finnacalc.com back when the app lived there. localStorage is scoped to an
 * origin, so app.finnacalc.com starts empty and nothing the app does can reach
 * across. This origin still holds the data, though — so this banner reads it
 * and hands it over.
 *
 * The payload rides in the URL *fragment*, which browsers never send to a
 * server: a budget shouldn't pass through an access log to change domains. A
 * payload too large for a URL is offered as a file instead, because a silently
 * truncated budget is worse than an extra click.
 *
 * Once the app confirms the import it sends the visitor back with
 * ?migrated=1, and only then is the old copy cleared. Deleting before
 * confirmation would risk losing the only copy if the handoff failed.
 */

const DISMISSED_KEY = "finnacalc.handoff.dismissed"

export function DataHandoffBanner() {
    const [state, setState] = useState<"hidden" | "offer" | "too-big" | "done">("hidden")

    useEffect(() => {
        // Coming back from a confirmed import: clear the stranded copy now.
        const params = new URLSearchParams(window.location.search)
        if (params.get("migrated") === "1") {
            try {
                clearLocalData(window.localStorage)
                window.localStorage.removeItem(DISMISSED_KEY)
            } catch {
                /* nothing we can do, and nothing was lost */
            }
            setState("done")
            const url = new URL(window.location.href)
            url.searchParams.delete("migrated")
            window.history.replaceState(null, "", url.toString())
            return
        }

        try {
            if (window.localStorage.getItem(DISMISSED_KEY) === "1") return
            if (!hasLocalData(window.localStorage)) return
            const payload = readLocalData(window.localStorage)
            if (!payload) return
            setState(encodeHandoff(payload).length > MAX_FRAGMENT_LENGTH ? "too-big" : "offer")
        } catch {
            /* storage unavailable: nothing to offer */
        }
    }, [])

    if (state === "hidden") return null

    function dismiss() {
        try {
            window.localStorage.setItem(DISMISSED_KEY, "1")
        } catch {
            /* it'll ask again next visit, which is the safe direction */
        }
        setState("hidden")
    }

    function moveIt() {
        const payload = readLocalData(window.localStorage)
        if (!payload) return
        window.location.href = `${appUrl("/migrate")}#d=${encodeHandoff(payload)}`
    }

    function downloadIt() {
        const payload = readLocalData(window.localStorage)
        if (!payload) return
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `finnacalc-data-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
    }

    if (state === "done") {
        return (
            <Banner tone="done" onDismiss={() => setState("hidden")}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                <p className="text-sm">
                    Your data is in the app now, and the copy left on this site has been cleared.
                </p>
            </Banner>
        )
    }

    return (
        <Banner onDismiss={dismiss}>
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-relaxed">
                    <span className="font-semibold">Your saved budget is on this device.</span> The app moved
                    to app.finnacalc.com, and browsers keep saved data per site — so it needs moving across
                    once.
                </p>
                {state === "offer" ? (
                    <Button size="sm" onClick={moveIt} className="shrink-0">
                        Move it to the app
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                ) : (
                    <Button size="sm" variant="outline" onClick={downloadIt} className="shrink-0">
                        <Download className="h-3.5 w-3.5" />
                        Download it as a file
                    </Button>
                )}
            </div>
            {state === "too-big" && (
                <p className="w-full text-xs text-ink-muted">
                    It&rsquo;s too large to carry in a link, so download the file and upload it at{" "}
                    <a href={appUrl("/migrate")} className="font-semibold underline underline-offset-2">
                        app.finnacalc.com/migrate
                    </a>
                    .
                </p>
            )}
        </Banner>
    )
}

function Banner({
    children,
    onDismiss,
    tone = "offer",
}: {
    children: React.ReactNode
    onDismiss: () => void
    tone?: "offer" | "done"
}) {
    return (
        <div
            className={
                tone === "done"
                    ? "border-b border-line bg-mint/10"
                    : "border-b border-line bg-mint/10"
            }
        >
            <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3 px-6 py-3.5">
                {children}
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="ml-auto shrink-0 text-ink-muted transition hover:text-ink"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
