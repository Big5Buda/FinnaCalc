import type { Metadata } from "next"
import { PlansView } from "@/components/plans/plans-view"

export const metadata: Metadata = {
    title: "Plans",
    description:
        "Budgeting Plus, Investing Plus, and FinnaCalc Pro — what each plan adds, and what stays free.",
}

export default function PlansPage() {
    return <PlansView />
}
