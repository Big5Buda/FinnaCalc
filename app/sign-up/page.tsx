import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthSplit } from "@/components/auth/auth-split"

export const metadata: Metadata = {
    title: "Sign up",
    description: "Create a free FinnaCalc account to save your progress across devices.",
}

export default function SignUpPage() {
    return (
        <AuthSplit>
            <AuthForm mode="signUp" />
        </AuthSplit>
    )
}
