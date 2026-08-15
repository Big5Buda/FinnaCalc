import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthSplit } from "@/components/auth/auth-split"

export const metadata: Metadata = {
    title: "Log in",
    description: "Log in to FinnaCalc to sync your budget, goals and plan across your devices.",
}

export default function SignInPage() {
    return (
        <AuthSplit>
            <AuthForm mode="signIn" />
        </AuthSplit>
    )
}
