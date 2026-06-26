/**
 * 2024 tax constants — single source of truth.
 *
 * MASTER SOURCES (Tax Year 2024, returns filed in 2025):
 *  - Rev. Proc. 2023-34 — annual inflation adjustments (brackets, standard
 *    deduction, cap-gain breakpoints, student loan / educator phaseouts, etc.)
 *  - 2024 Form 1040 and Instructions; Tax Rate Schedules; Tax Table.
 *  - Schedule 8812 (2024) — Child Tax Credit / ACTC.
 *  - Schedule SE / Form 8959 / Form 8960 (2024) — SE tax, Add'l Medicare, NIIT.
 *  - Social Security Administration — 2024 wage base ($168,600).
 *
 * RULE: no calculation module may contain a numeric tax literal. Every IRS value
 * lives here, annotated with its source, so accuracy is auditable in one place.
 */
export * from "./brackets2024"
export * from "./standardDeductions2024"
export * from "./ctc2024"
export * from "./filingThresholds2024"
export * from "./socialSecurity2024"
export * from "./retirement2024"
export * from "./eitc2024"
export * from "./qbi2024"
export * from "./amt2024"
export * from "./credits2024"
