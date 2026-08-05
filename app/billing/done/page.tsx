"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Bridge page for the iOS checkout round-trip.
 *
 * Stripe Checkout and the customer portal only accept http(s) redirect URLs,
 * but the app's ASWebAuthenticationSession closes on the finnacalc:// scheme.
 * This page immediately bounces the browser to
 * finnacalc://billing-callback?status=… so the in-app session dismisses
 * itself; the static copy below is the fallback when the redirect can't fire
 * (or someone lands here on the web).
 */
function BillingDoneInner() {
    const params = useSearchParams()
    const status = params.get("status") ?? "done"

    useEffect(() => {
        window.location.replace(`finnacalc://billing-callback?status=${encodeURIComponent(status)}`)
    }, [status])

    const headline =
        status === "success"
            ? "You're all set"
            : status === "cancel"
              ? "Checkout canceled"
              : "Done"

    return (
        <main style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>{headline}</h1>
            <p style={{ color: "#555" }}>You can close this window and return to the FinnaCalc app.</p>
        </main>
    )
}

export default function BillingDonePage() {
    // useSearchParams requires a Suspense boundary during prerender.
    return (
        <Suspense fallback={null}>
            <BillingDoneInner />
        </Suspense>
    )
}
