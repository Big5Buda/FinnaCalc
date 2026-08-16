/**
 * Provider-agnostic e-file contract. Any transmitter (Tax1099, or a true IRS MeF
 * 1040 provider) implements `EfileProvider`. The actual network call happens
 * server-side (see app/api/efile/route.ts) so the API key never reaches the client.
 */
import type { FilingStatus, StateCode } from "../../types/filing"

/** A neutral, serializable payload mapped from a computed return. */
export interface EfileBundle {
  taxYear: 2024
  filingStatus: FilingStatus
  agi: number
  taxableIncome: number
  totalTax: number
  totalPayments: number
  refundOrOwed: number
  state?: { code: StateCode; tax: number; refundOrOwed: number }
  /** Line-by-line trace for the transmitter to map into its own schema. */
  lines: { id: string; label: string; amount: number }[]
}

export interface EfileSubmissionResult {
  status: "accepted" | "rejected" | "queued" | "unsupported"
  providerRef?: string
  message: string
}

export interface EfileProvider {
  readonly name: string
  /** Whether this provider can transmit an individual Form 1040 income-tax return. */
  readonly supportsIndividual1040: boolean
  submit(bundle: EfileBundle): Promise<EfileSubmissionResult>
}
