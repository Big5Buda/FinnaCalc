/** Additional 2026 rules; same reviewed values as the native federal estimator. */
export const CAR_LOAN_INTEREST_2026 = {
  "cap": 10000,
  "phaseoutRatePerDollar": 0.2,
  "threshold": 100000,
  "thresholdMfj": 200000
}

export const CHARITABLE_ITEMIZED_FLOOR = 0.005

export const EITC_INCOME_LIMIT_2026 = [
  19540,
  51593,
  58629,
  62974
]

export const EITC_INCOME_LIMIT_MFJ_2026 = [
  26820,
  58863,
  65899,
  70244
]

export const EITC_TABLE_STEP_2026 = 50

export const ITEMIZED_LIMIT_FRACTION = 0.05405405405405406

export const NONITEMIZER_CHARITY_LIMIT = 1000

export const NONITEMIZER_CHARITY_LIMIT_MFJ = 2000

export const OBBBA_PHASEOUT_STEP_2026 = 1000

export const OVERTIME_DEDUCTION_2026 = {
  "cap": 12500,
  "capMfj": 25000,
  "phaseoutRatePerDollar": 0.1,
  "threshold": 150000,
  "thresholdMfj": 300000
}

export const QBI_ACTIVE_INCOME_MINIMUM = 1000

export const QBI_ACTIVE_MINIMUM = 400

export const SENIOR_DEDUCTION_2026 = {
  "perPerson": 6000,
  "phaseoutRate": 0.06,
  "threshold": {
    "hoh": 75000,
    "mfj": 150000,
    "mfs": 75000,
    "qss": 75000,
    "single": 75000
  }
}

export const SUPPORTED_TAX_YEAR = 2026

export const TIPS_DEDUCTION_2026 = {
  "cap": 25000,
  "phaseoutRatePerDollar": 0.1,
  "threshold": 150000,
  "thresholdMfj": 300000
}
