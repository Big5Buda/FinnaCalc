import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
    title: "Create account",
    description: "Create a free FinnaCalc account to save your progress across devices.",
}

export default function SignUpPage() {
    return (
        <Suspense fallback={null}>
            <AuthForm mode="signUp" />
        </Suspense>
    )
}
