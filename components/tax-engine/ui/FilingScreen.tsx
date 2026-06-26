"use client"

import { useState } from "react"
import { ArrowLeft, Printer, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { TaxCalculationResult } from "../types/result"
import { PrintableSummary } from "./PrintableSummary"

/**
 * Filing step. Print/PDF works today (window.print); e-file is a clearly-labeled
 * stub gated behind an acknowledgment. (Real individual 1040 e-file requires an
 * IRS-authorized MeF provider — see the project notes on the Tax1099 API.)
 */
export function FilingScreen({
  result,
  onBack,
}: {
  result: TaxCalculationResult
  onBack: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" onClick={onBack} className="flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to review
      </Button>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>
            {result.owes
              ? `Estimated balance due: ${formatCurrency(Math.abs(result.refundOrOwed), { cents: false })}`
              : `Estimated refund: ${formatCurrency(result.refundOrOwed, { cents: false })}`}
          </CardTitle>
          <CardDescription>Save a copy or print your estimate for your records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => window.print()} className="w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-2" />
            Print / save as PDF
          </Button>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>E-file is coming soon</AlertTitle>
            <AlertDescription>
              Electronic filing of your federal return goes through the IRS Modernized e-File
              system and requires an authorized provider. This is wired as a stub for now — your
              data stays in your browser and is never transmitted.
            </AlertDescription>
          </Alert>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(c) => setAcknowledged(c === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              I understand this is an estimate, not an official filing, and that I should verify the
              numbers (or consult a tax professional) before filing with the IRS.
            </span>
          </label>

          <Button disabled={!acknowledged} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            <Send className="h-4 w-4 mr-2" />
            E-file (coming soon)
          </Button>
        </CardContent>
      </Card>

      <PrintableSummary result={result} />
    </div>
  )
}
