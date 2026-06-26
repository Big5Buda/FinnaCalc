"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatPercent } from "@/lib/format"
import type { TaxCalculationResult } from "../types/result"

/**
 * Live running refund / amount-owed estimate. Updates as the user answers
 * questions. Token-only styling: refunds emphasize with `text-primary`, balances
 * due with `text-destructive`.
 */
export function RefundMeter({ result }: { result: TaxCalculationResult }) {
  const owes = result.owes
  const amount = Math.abs(result.refundOrOwed)

  return (
    <Card className="border-border bg-card sticky top-4">
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            {owes ? "Estimated amount you owe" : "Estimated federal refund"}
          </p>
          <p
            className={cn(
              "text-4xl font-bold tabular-nums",
              owes ? "text-destructive" : "text-primary",
            )}
          >
            {formatCurrency(amount, { cents: false })}
          </p>
          <p className="text-xs text-muted-foreground">Tax Year 2024 · federal estimate</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <MeterRow label="Total income" value={result.totalIncome} />
          <MeterRow label="AGI" value={result.agi} />
          <MeterRow
            label={result.deductionUsed === "itemized" ? "Itemized ded." : "Standard ded."}
            value={result.deductionAmount}
          />
          <MeterRow label="Taxable income" value={result.taxableIncome} />
          <MeterRow label="Tax before credits" value={result.regularTax} />
          <MeterRow label="Credits" value={result.totalNonrefundableCredits + result.totalRefundableCredits} />
          <MeterRow label="Total tax" value={result.totalTax} />
          <MeterRow label="Payments" value={result.totalPayments} />
        </div>

        {result.state && result.state.supported && result.state.hasIncomeTax && (
          <div className="border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {result.state.name} {result.state.refundOrOwed < 0 ? "owed" : "refund"}
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  result.state.refundOrOwed < 0 ? "text-destructive" : "text-primary",
                )}
              >
                {formatCurrency(Math.abs(result.state.refundOrOwed), { cents: false })}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              State tax {formatCurrency(result.state.tax, { cents: false })}
            </p>
          </div>
        )}
        {result.state && !result.state.hasIncomeTax && (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {result.state.name}: no state income tax. 🎉
          </p>
        )}

        <div className="flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Marginal rate: {formatPercent(result.marginalRate, 0)}</span>
          <span>Effective rate: {formatPercent(result.effectiveRate, 1)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function MeterRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{formatCurrency(value)}</span>
    </div>
  )
}
