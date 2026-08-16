"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Check, Upload } from "lucide-react"
import {
    decodeHandoff,
    hasLocalData,
    writeLocalData,
    type HandoffPayload,
    type StorageKey,
} from "@finnacalc/shared/storage"
import { Button, Notice } from "@/components/ui/primitives"
import { PageHeader } from "@/components/shell/page-header"

/**
 * Receives data stranded on the old origin by the domain split.
 *
 * The marketing site at www still holds whatever was saved back when the app
 * lived there; it reads those keys and sends them here in the URL fragment,
 * which never reaches a server. This page writes them into this origin's
 * storage.
 *
 * Two rules it does not break: it never overwrites data already here without
 * asking, and it only tells the old origin to clear its copy after a write has
 * actually succeeded — the return trip carries ?migrated=1, and that is what
 * triggers the delete over there. If anything fails, the original is still
 * sitting on the old domain.
 */

const LABELS: Partial<Record<StorageKey, string>> = {
    "finnacalc-budget-items": "Budget lines",
    "finnacalc-savings-goals": "Savings goals",
    "finnacalc-budget-history": "History snapshots",
    "finnacalc-category-caps": "Category caps",
    "finnacalc-budget-last-slot": "Open budget",
    "finnacalc-budget-type": "Personal / business",
    "finnacalc.watchlist": "Watchlist",
    "finnacalc.investing.goals": "Investing goals",
    "finnacalc.appearance": "Appearance",
}

const WEB_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://www.finnacalc.com"

export default function MigratePage() {
    const [payload, setPayload] = useState<HandoffPayload | null>(null)
    const [written, setWritten] = useState<StorageKey[] | null>(null)
    const [conflict, setConflict] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInput = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        const fragment = window.location.hash.replace(/^#/, "")
        const encoded = new URLSearchParams(fragment).get("d")
        if (!encoded) return

        const decoded = decodeHandoff(encoded)
        // Drop it from the address bar either way: it's the visitor's financial
        // data, and it has no business sitting in history or a shared link.
        window.history.replaceState(null, "", window.location.pathname)

        if (!decoded) {
            setError("That transfer link couldn't be read. Nothing has been changed here.")
            return
        }
        setPayload(decoded)
        if (hasLocalData(window.localStorage)) setConflict(true)
        else applyImport(decoded)
    }, [])

    function applyImport(incoming: HandoffPayload) {
        try {
            const keys = writeLocalData(window.localStorage, incoming)
            setWritten(keys)
            setConflict(false)
        } catch {
            setError("Your browser wouldn't let us save that here. Nothing was changed.")
        }
    }

    function onFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return
        setError(null)
        file.text()
            .then((text) => {
                const parsed = JSON.parse(text) as HandoffPayload
                if (typeof parsed?.v !== "number" || typeof parsed?.data !== "object") {
                    throw new Error("shape")
                }
                setPayload(parsed)
                if (hasLocalData(window.localStorage)) setConflict(true)
                else applyImport(parsed)
            })
            .catch(() => setError("That file isn't a FinnaCalc export. Nothing has been changed."))
    }

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
            <PageHeader
                eyebrow="Move your data"
                title="Bring your budget across."
                lead="The app moved to its own address. Browsers keep saved data per site, so anything you saved on the old one needs moving here once."
            />

            {error && <Notice tone="error">{error}</Notice>}

            {written && (
                <>
                    <Notice tone="info">
                        <span className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                            <span>
                                Imported {written.length} item{written.length === 1 ? "" : "s"}. Everything
                                below is now on this device.
                            </span>
                        </span>
                    </Notice>

                    <ul className="overflow-hidden rounded-xl border border-border bg-card">
                        {written.map((key, index) => (
                            <li
                                key={key}
                                className={`flex items-center gap-2 px-4 py-3 text-sm text-foreground ${
                                    index > 0 ? "border-t border-border" : ""
                                }`}
                            >
                                <Check className="h-3.5 w-3.5 text-positive" />
                                {LABELS[key] ?? key}
                            </li>
                        ))}
                    </ul>

                    <div className="flex flex-wrap gap-3">
                        <Link href="/budgeting">
                            <Button>Open your budget</Button>
                        </Link>
                        {/* The old copy is cleared over there, only now that this
                            one is written. */}
                        <a href={`${WEB_ORIGIN}/?migrated=1`}>
                            <Button variant="outline">Clear the old copy</Button>
                        </a>
                    </div>
                </>
            )}

            {conflict && payload && (
                <div className="flex flex-col gap-4 rounded-card border-[1.5px] border-caution bg-card p-5">
                    <div className="flex flex-col gap-1.5">
                        <p className="text-base font-bold text-foreground">
                            There&rsquo;s already data here
                        </p>
                        <p className="text-sm text-muted-foreground">
                            This device already has a budget on app.finnacalc.com. Importing replaces it with
                            the copy from the old site — the two can&rsquo;t be merged, because both may
                            describe the same months differently. This can&rsquo;t be undone.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="destructive" onClick={() => applyImport(payload)}>
                            Replace with the imported copy
                        </Button>
                        <Link href="/budgeting">
                            <Button variant="ghost">Keep what&rsquo;s here</Button>
                        </Link>
                    </div>
                </div>
            )}

            {!written && !conflict && (
                <div className="flex flex-col gap-4 rounded-card border-[1.5px] border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">
                        Nothing to import from the link. If you downloaded a data file from the old site,
                        upload it here.
                    </p>
                    <div>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={onFile}
                        />
                        <Button variant="outline" onClick={() => fileInput.current?.click()}>
                            <Upload className="h-4 w-4" />
                            Upload a data file
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        The file never leaves your browser — it&rsquo;s read here and written straight to this
                        device&rsquo;s storage.
                    </p>
                </div>
            )}
        </div>
    )
}
