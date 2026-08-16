/**
 * Filing status, taxpayer identity, residency, and dependents.
 * Maps to Form 1040 page 1 (filing status, dependents) and Schedule 8812.
 */

/** Form 1040 filing status checkboxes. */
export type FilingStatus =
  | "single" // Single
  | "mfj" // Married filing jointly
  | "mfs" // Married filing separately
  | "hoh" // Head of household
  | "qss" // Qualifying surviving spouse

/** Two-letter USPS state codes (+ DC). Residency drives the state engine (later phase). */
export type StateCode =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "DC" | "FL"
  | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME"
  | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH"
  | "NJ" | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI"
  | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY"

/** Individual identity block (taxpayer or spouse). SSN is sensitive — never persisted. */
export interface TaxpayerInfo {
  firstName: string
  lastName: string
  /** SSN — SENSITIVE: held in memory only, never written to localStorage. */
  ssn: string
  /** ISO date string (YYYY-MM-DD). Used to derive the 65+ additional standard deduction. */
  dateOfBirth: string
  occupation: string
  /** Legally blind — adds an additional standard deduction amount (Form 1040 std-ded chart). */
  blind: boolean
  /** Can be claimed as a dependent on someone else's return — caps the standard deduction. */
  claimedAsDependentByAnother: boolean
}

/** Mailing address (Form 1040 header). */
export interface Address {
  line1: string
  line2?: string
  city: string
  state: StateCode | ""
  zip: string
}

/**
 * A dependent claimed on the return.
 * Qualification follows the IRS qualifying-child / qualifying-relative tests
 * (Pub 17 ch. 3). The booleans below are the engine inputs that gate CTC/ODC,
 * the Child & Dependent Care Credit, and EITC.
 */
export interface Dependent {
  id: string
  firstName: string
  lastName: string
  /** SENSITIVE. */
  ssn: string
  dateOfBirth: string
  /** "child" = qualifying child; "relative" = qualifying relative. */
  relationshipType: "child" | "relative"
  relationship: string // e.g. "son", "daughter", "parent"
  /** Months the dependent lived with the taxpayer in 2024 (residency test). */
  monthsLivedWithTaxpayer: number
  /** Taxpayer provided > half of the dependent's support. */
  taxpayerProvidedOverHalfSupport: boolean
  /** Qualifies for the $2,000 Child Tax Credit (under 17 at year end, has SSN, etc.). */
  qualifiesForCTC: boolean
  /** Qualifies for the $500 Credit for Other Dependents (ODC) instead of CTC. */
  qualifiesForODC: boolean
  /** Counts as a qualifying child for EITC purposes (relationship/age/residency). */
  qualifiesForEITC: boolean
  /** Under 13 (or disabled) — gates the Child & Dependent Care Credit (Form 2441). */
  qualifiesForCareCredit: boolean
}
