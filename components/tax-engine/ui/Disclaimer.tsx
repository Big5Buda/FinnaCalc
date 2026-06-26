"use client"

import { TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** Persistent estimate-only disclaimer shown on the interview and review screens. */
export function Disclaimer() {
  return (
    <Alert>
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>Estimate only — not tax advice</AlertTitle>
      <AlertDescription>
        An educational Tax Year 2024 <span className="font-medium">federal</span> estimate using
        published 2024 IRS amounts (Rev. Proc. 2023-34) — not an official IRS filing or professional
        tax advice. State income tax isn&apos;t included yet, and a few situations (ACA premium
        credit repayment caps, the QBI wage limit for high earners) are simplified.
      </AlertDescription>
    </Alert>
  )
}
