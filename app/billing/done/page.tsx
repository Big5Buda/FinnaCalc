"use client"

import Link from "next/link"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, CircleSlash } from "lucide-react"

/**
 * Where Stripe Checkout and the customer portal come back to.
 *
 * On the web this is just a confirmation page. The iOS app finishes checkout
 * in an ASWebAuthenticationSession that only closes on the finnacalc:// scheme,
 * so its checkout links carry `client=ios` and this page bounces there; a web
 * checkout never does, and stays on the site.
 */
function BillingDoneInner() {
    const params = useSearchParams()
    const status = params.get("status") ?? "done"
    const isApp = params.get("client") === "ios"

    useEffect(() => {
        if (isApp) {
            window.location.replace(`finnacalc://billing-callback?status=${encodeURIComponent(status)}`)
        }
    }, [isApp, status])

    const success = status === "success"
    const headline = success ? "You're all set" : status === "cancel" ? "Checkout canceled" : "Done"
    const detail = isApp
        ? "You can close this window and return to the FinnaCalc app."
        : success
          ? "Your plan is active. It can take a few seconds to show up while Stripe confirms the payment."
          : status === "cancel"
            ? "Nothing was charged. You can pick a plan whenever you're ready."
            : "Your billing settings are up to date."

    return (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 py-20 text-center">
            {success ? (
                <CheckCircle2 className="h-10 w-10 text-positive" />
            ) : (
                <CircleSlash className="h-10 w-10 text-muted-foreground" />
            )}
            <h1 className="text-xl font-bold text-foreground">{headline}</h1>
            <p className="text-sm text-muted-foreground">{detail}</p>
            {!isApp && (
                <div className="flex gap-3 pt-2">
                    <Link
                        href="/account"
                        className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                        Go to your account
                    </Link>
                    <Link
                        href="/plans"
                        className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
                    >
                        See plans
                    </Link>
                </div>
            )}
        </div>
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
