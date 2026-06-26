"use client"

import { Info, ShieldAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { TaxCalculationResult } from "../types/result"

/** Surfaces the engine's audit flags and not-fully-modeled warnings. */
export function AuditRiskPanel({ result }: { result: TaxCalculationResult }) {
  if (result.auditFlags.length === 0 && result.warnings.length === 0) return null

  return (
    <div className="space-y-3">
      {result.auditFlags.map((flag, i) => (
        <Alert key={`flag-${i}`} variant={flag.severity === "high" ? "destructive" : "default"}>
          {flag.severity === "high" ? (
            <ShieldAlert className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertTitle>{flag.severity === "info" ? "Heads up" : "Check this"}</AlertTitle>
          <AlertDescription>{flag.message}</AlertDescription>
        </Alert>
      ))}
      {result.warnings.map((w) => (
        <Alert key={w.code}>
          <Info className="h-4 w-4" />
          <AlertDescription>{w.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
