"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { toast } from "sonner"
import type { BankTransaction } from "@/app/api/plaid/transactions/route"

interface BankConnectProps {
    /** Bump this number to start the Plaid connect flow. */
    trigger: number
    onImport: (transactions: BankTransaction[]) => void
}

/**
 * Headless Plaid-Link controller. Rendered at the page root (NOT inside the
 * Bank Actions dialog) so that when the dialog closes, this stays mounted and
 * Plaid's modal is fully interactive — a Radix Dialog left open would trap
 * focus / make the Plaid iframe inert.
 */
export default function BankConnect({ trigger, onImport }: BankConnectProps) {
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [shouldOpen, setShouldOpen] = useState(false)
    const lastTrigger = useRef(0)
    const toastId = useRef<string | number | undefined>(undefined)

    const initLink = useCallback(async () => {
        toastId.current = toast.loading("Connecting to your bank…")
        try {
            const res = await fetch("/api/plaid/create-link-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product: "transactions" }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not start the bank connection.")
            setLinkToken(json.link_token)
            setShouldOpen(true)
        } catch (e: any) {
            toast.error(e?.message ?? "Could not start the bank connection.", { id: toastId.current })
        }
    }, [])

    // Start the flow whenever the parent bumps `trigger`.
    useEffect(() => {
        if (trigger > 0 && trigger !== lastTrigger.current) {
            lastTrigger.current = trigger
            setLinkToken(null)
            setShouldOpen(false)
            initLink()
        }
    }, [trigger, initLink])

    const onSuccess = useCallback(
        async (publicToken: string) => {
            toast.loading("Importing transactions…", { id: toastId.current })
            try {
                const res = await fetch("/api/plaid/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ public_token: publicToken }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Could not import your transactions.")
                if (!json.transactions?.length) throw new Error("No transactions were found on this account.")
                toast.dismiss(toastId.current)
                onImport(json.transactions)
            } catch (e: any) {
                toast.error(e?.message ?? "Could not import your transactions.", { id: toastId.current })
            }
        },
        [onImport]
    )

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: (public_token) => onSuccess(public_token),
        onExit: () => toast.dismiss(toastId.current),
    })

    useEffect(() => {
        if (linkToken && ready && shouldOpen) {
            setShouldOpen(false)
            toast.dismiss(toastId.current) // Plaid's own modal takes over from here
            open()
        }
    }, [linkToken, ready, shouldOpen, open])

    return null
}
