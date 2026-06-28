"use client"

import { useCallback, useEffect, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { Plug, RefreshCw } from "lucide-react"
import type { BankTransaction } from "@/app/api/plaid/transactions/route"

interface BankConnectProps {
    onImport: (transactions: BankTransaction[]) => void
    onError?: (message: string) => void
}

export default function BankConnect({ onImport, onError }: BankConnectProps) {
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [status, setStatus] = useState<"idle" | "linking" | "loading">("idle")

    const fail = useCallback((msg: string) => {
        setStatus("idle")
        onError?.(msg)
    }, [onError])

    const initLink = useCallback(async () => {
        setStatus("linking")
        try {
            const res = await fetch("/api/plaid/create-link-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product: "transactions" }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not start the bank connection.")
            setLinkToken(json.link_token)
        } catch (e: any) {
            fail(e?.message ?? "Could not start the bank connection.")
        }
    }, [fail])

    const onSuccess = useCallback(async (publicToken: string) => {
        setStatus("loading")
        try {
            const res = await fetch("/api/plaid/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ public_token: publicToken }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not import your transactions.")
            if (!json.transactions?.length) throw new Error("No transactions were found on this account.")
            onImport(json.transactions)
            setStatus("idle")
        } catch (e: any) {
            fail(e?.message ?? "Could not import your transactions.")
        }
    }, [fail, onImport])

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: (public_token) => onSuccess(public_token),
        onExit: () => { if (status === "linking") setStatus("idle") },
    })

    useEffect(() => {
        if (linkToken && ready && status === "linking") open()
    }, [linkToken, ready, status, open])

    const busy = status !== "idle"

    return (
        <Button onClick={initLink} disabled={busy} className="flex items-center justify-center gap-2" variant="outline">
            {status === "loading" ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Importing transactions…</>
            ) : status === "linking" ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Opening…</>
            ) : (
                <><Plug className="h-4 w-4" /> Connect Bank Account</>
            )}
        </Button>
    )
}
