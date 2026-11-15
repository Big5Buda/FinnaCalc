# Website federal tax year 2026

The public web estimator defaults to 2026. Explicit 2024 return objects and
constants are retained for historical regression tests; their year is never
silently rewritten. This web estimator keeps answers in React state, not a shared
cross-year storage key. Export summaries carry the calculated return's year.

The 2026 constant catalog mirrors the reviewed native app's TaxConstants.swift.
Existing TypeScript pipeline modules now select indexed constants by return year.
Legacy `_2024` local names remain compatibility identifiers, not the selected year.
No global mutable year context is used. Pure low-level helpers default to 2024 for
backward compatibility; the public orchestrator explicitly supplies the return year.

Sources:
- IRS Rev. Proc. 2025-32: https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
  Ordinary brackets, standard/additional deductions, capital-gain thresholds,
  CTC/ACTC, EITC parameters, AMT, QBI and indexed adjustments.
- IRS Publication 505 (2026): https://www.irs.gov/publications/p505
  SALT phase-down, Schedule 1-A, cash charity and itemized deduction changes.
- IRA/Saver's: https://www.irs.gov/pub/irs-drop/n-25-67.pdf
- HSA: https://www.irs.gov/pub/irs-drop/rp-25-19.pdf
- SSA wage base: https://www.ssa.gov/OACT/COLA/cbb.html
- 2026 Form 2441 instructions: https://www.irs.gov/pub/irs-dft/i2441--dft.pdf
- 2026 Form 6251: https://www.irs.gov/pub/irs-dft/f6251--dft.pdf
- Energy: https://www.irs.gov/instructions/i5695
- Clean vehicle: https://www.irs.gov/credits-deductions/clean-vehicle-tax-credits
- Marketplace: https://www.irs.gov/newsroom/irs-updates-frequently-asked-questions-on-the-premium-tax-credit

Formula updates include 50% AMT exemption phaseout and MFS offset, two-stage care
credit, wider QBI phase-in and confirmed-active minimum, 2026 charity floor and
nonitemizer gifts, section 68 limitation and deduction comparison, and Schedule
1-A senior/tips/overtime/car-interest deductions. Qualified tips/overtime must
already be included in income. New clean-energy costs earn no 2026 credit; unused
prior residential clean-energy credit is a distinct carryforward. EV requires
confirmation of eligible earlier acquisition. Excess APTC is fully repayable.

2026 EITC uses the reviewed $50-band method with 2026 parameters and published
income endpoints. Reconcile the final 2026 IRS table/draft instructions when
available before claiming filing-level precision. This remains planning software,
not filing software. Existing advanced-case warnings remain visible.

The simplified public screen still does not collect every supported federal
input. New optional deduction questions are shown in one disclosure. A dependency
mapping bug in the old short screen was corrected so qualifying children actually
reach CTC/EITC flags. The old 2024 state income-tax tables are not presented as
2026: the public tool remains federal-only; canonical 2026 income-tax state
requests explicitly return unsupported rather than wrong-year figures. The
historical state cases remain available to explicit 2024 tests.
