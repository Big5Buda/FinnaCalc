"use client"

import { formatCurrency } from "@/lib/format"
import { build1040Summary } from "../export/build1040Summary"
import type { TaxCalculationResult } from "../types/result"

/**
 * Clean 1040 summary shown on the filing screen and isolated for printing
 * (see the `@media print` rule in globals.css targeting #print-area).
 */
export function PrintableSummary({ result }: { result: TaxCalculationResult }) {
  const summary = build1040Summary(result)

  return (
    <div id="print-area" className="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <div className="mb-4 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">FinnaCalc · Tax Year {summary.taxYear} estimate</p>
        <h3 className="text-lg font-bold">{summary.filingStatusLabel}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{summary.headline.label}</p>
        <p className="text-3xl font-bold tabular-nums">
          {formatCurrency(summary.headline.amount, { cents: false })}
        </p>
      </div>

      <div className="space-y-5">
        {summary.groups.map((g) => (
          <div key={g.title}>
            <h4 className="mb-1.5 text-sm font-semibold text-foreground">{g.title}</h4>
            <div className="space-y-1">
              {g.lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {l.label}
                    {l.formRef && <span className="ml-2 text-xs text-muted-foreground/70">{l.formRef}</span>}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">{formatCurrency(l.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {summary.state && (
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-foreground">{summary.state.name} state</h4>
            {summary.state.hasIncomeTax ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">State income tax</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrency(summary.state.tax)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    State {summary.state.refundOrOwed < 0 ? "balance due" : "refund"}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrency(Math.abs(summary.state.refundOrOwed))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No state income tax.</p>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Educational federal estimate.
      </p>
    </div>
  )
}
