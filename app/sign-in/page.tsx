import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to FinnaCalc to sync your budget, goals and plan across your devices.",
}

export default function SignInPage() {
    // useSearchParams needs a Suspense boundary during prerender.
    return (
        <Suspense fallback={null}>
            <AuthForm mode="signIn" />
        </Suspense>
    )
}
