/**
 * Schedule C — net profit or loss from each business, split by owner
 * (taxpayer vs spouse) so self-employment tax can be figured per person.
 */
import type { TaxReturn2024 } from "../../types/taxReturn"

export interface ScheduleCResult {
  netByOwner: { taxpayer: number; spouse: number }
  totalNet: number
}

export function computeScheduleC(r: TaxReturn2024): ScheduleCResult {
  if (!r.income.flags.hasSelfEmployment) {
    return { netByOwner: { taxpayer: 0, spouse: 0 }, totalNet: 0 }
  }

  let taxpayer = 0
  let spouse = 0
  for (const c of r.income.scheduleC) {
    const expenses = Object.values(c.expenses).reduce((a, b) => a + (b || 0), 0)
    const net =
      c.grossReceipts - c.costOfGoodsSold - expenses - c.homeOfficeDeduction - c.vehicleExpense
    if (c.owner === "spouse") spouse += net
    else taxpayer += net
  }

  return { netByOwner: { taxpayer, spouse }, totalNet: taxpayer + spouse }
}
