import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthSplit } from "@/components/auth/auth-split"

export const metadata: Metadata = {
    title: "Log in",
    description: "Log in to FinnaCalc to access your account, connected portfolio, and subscription features.",
}

export default function SignInPage() {
    return (
        <AuthSplit>
            <AuthForm mode="signIn" />
        </AuthSplit>
    )
}
