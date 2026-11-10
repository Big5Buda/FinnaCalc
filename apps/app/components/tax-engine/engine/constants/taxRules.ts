/** Year-specific federal constants. 2024 remains explicit for historical regression cases.
 * 2026 mirrors the reviewed native catalog. Sources and draft-form limits: docs/tax-year-2026.md.
 */
import * as legacy from "./index"
export const SUPPORTED_TAX_YEAR = 2026
export type TaxYear = 2024 | 2026
type Widen<T> = T extends number ? number : T extends string ? string : T extends boolean ? boolean : T extends readonly (infer U)[] ? readonly Widen<U>[] : T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } : T
const historical = {
ORDINARY_BRACKETS_2024: legacy.ORDINARY_BRACKETS_2024,
CAP_GAIN_BREAKPOINTS_2024: legacy.CAP_GAIN_BREAKPOINTS_2024,
CTC_2024: legacy.CTC_2024,
CTC_PHASEOUT_THRESHOLD_2024: legacy.CTC_PHASEOUT_THRESHOLD_2024,
IRA_2024: legacy.IRA_2024,
HSA_2024: legacy.HSA_2024,
EITC_2024: legacy.EITC_2024,
EITC_INVESTMENT_INCOME_LIMIT_2024: legacy.EITC_INVESTMENT_INCOME_LIMIT_2024,
EITC_CHILDLESS_AGE: legacy.EITC_CHILDLESS_AGE,
QBI_2024: legacy.QBI_2024,
SS_TAXABILITY_2024: legacy.SS_TAXABILITY_2024,
SE_TAX_2024: legacy.SE_TAX_2024,
ADDITIONAL_MEDICARE_2024: legacy.ADDITIONAL_MEDICARE_2024,
NIIT_2024: legacy.NIIT_2024,
CAPITAL_LOSS_LIMIT_2024: legacy.CAPITAL_LOSS_LIMIT_2024,
MEDICAL_AGI_FLOOR_2024: legacy.MEDICAL_AGI_FLOOR_2024,
SALT_CAP_2024: legacy.SALT_CAP_2024,
CHARITABLE_LIMITS_2024: legacy.CHARITABLE_LIMITS_2024,
MORTGAGE_DEBT_LIMIT_2024: legacy.MORTGAGE_DEBT_LIMIT_2024,
STUDENT_LOAN_INTEREST_2024: legacy.STUDENT_LOAN_INTEREST_2024,
EDUCATOR_EXPENSE_2024: legacy.EDUCATOR_EXPENSE_2024,
EARLY_WITHDRAWAL_PENALTY_2024: legacy.EARLY_WITHDRAWAL_PENALTY_2024,
CARE_CREDIT_2024: legacy.CARE_CREDIT_2024,
EDUCATION_CREDITS_2024: legacy.EDUCATION_CREDITS_2024,
SAVERS_CREDIT_2024: legacy.SAVERS_CREDIT_2024,
CLEAN_ENERGY_2024: legacy.CLEAN_ENERGY_2024,
EV_CREDIT_2024: legacy.EV_CREDIT_2024,
STANDARD_DEDUCTION_2024: legacy.STANDARD_DEDUCTION_2024,
ADDITIONAL_STD_DEDUCTION_2024: legacy.ADDITIONAL_STD_DEDUCTION_2024,
DEPENDENT_STD_DEDUCTION_2024: legacy.DEPENDENT_STD_DEDUCTION_2024,
AMT_2024: legacy.AMT_2024
}
export type TaxRuleSet = Widen<typeof historical>
const current = {
  "ORDINARY_BRACKETS_2024": {
    "hoh": [
      {
        "max": 17700,
        "min": 0,
        "rate": 0.1
      },
      {
        "max": 67450,
        "min": 17700,
        "rate": 0.12
      },
      {
        "max": 105700,
        "min": 67450,
        "rate": 0.22
      },
      {
        "max": 201750,
        "min": 105700,
        "rate": 0.24
      },
      {
        "max": 256200,
        "min": 201750,
        "rate": 0.32
      },
      {
        "max": 640600,
        "min": 256200,
        "rate": 0.35
      },
      {
        "max": Infinity,
        "min": 640600,
        "rate": 0.37
      }
    ],
    "mfj": [
      {
        "max": 24800,
        "min": 0,
        "rate": 0.1
      },
      {
        "max": 100800,
        "min": 24800,
        "rate": 0.12
      },
      {
        "max": 211400,
        "min": 100800,
        "rate": 0.22
      },
      {
        "max": 403550,
        "min": 211400,
        "rate": 0.24
      },
      {
        "max": 512450,
        "min": 403550,
        "rate": 0.32
      },
      {
        "max": 768700,
        "min": 512450,
        "rate": 0.35
      },
      {
        "max": Infinity,
        "min": 768700,
        "rate": 0.37
      }
    ],
    "mfs": [
      {
        "max": 12400,
        "min": 0,
        "rate": 0.1
      },
      {
        "max": 50400,
        "min": 12400,
        "rate": 0.12
      },
      {
        "max": 105700,
        "min": 50400,
        "rate": 0.22
      },
      {
        "max": 201775,
        "min": 105700,
        "rate": 0.24
      },
      {
        "max": 256225,
        "min": 201775,
        "rate": 0.32
      },
      {
        "max": 384350,
        "min": 256225,
        "rate": 0.35
      },
      {
        "max": Infinity,
        "min": 384350,
        "rate": 0.37
      }
    ],
    "qss": [
      {
        "max": 24800,
        "min": 0,
        "rate": 0.1
      },
      {
        "max": 100800,
        "min": 24800,
        "rate": 0.12
      },
      {
        "max": 211400,
        "min": 100800,
        "rate": 0.22
      },
      {
        "max": 403550,
        "min": 211400,
        "rate": 0.24
      },
      {
        "max": 512450,
        "min": 403550,
        "rate": 0.32
      },
      {
        "max": 768700,
        "min": 512450,
        "rate": 0.35
      },
      {
        "max": Infinity,
        "min": 768700,
        "rate": 0.37
      }
    ],
    "single": [
      {
        "max": 12400,
        "min": 0,
        "rate": 0.1
      },
      {
        "max": 50400,
        "min": 12400,
        "rate": 0.12
      },
      {
        "max": 105700,
        "min": 50400,
        "rate": 0.22
      },
      {
        "max": 201775,
        "min": 105700,
        "rate": 0.24
      },
      {
        "max": 256225,
        "min": 201775,
        "rate": 0.32
      },
      {
        "max": 640600,
        "min": 256225,
        "rate": 0.35
      },
      {
        "max": Infinity,
        "min": 640600,
        "rate": 0.37
      }
    ]
  },
  "CAP_GAIN_BREAKPOINTS_2024": {
    "hoh": {
      "fifteenRateMax": 579600,
      "zeroRateMax": 66200
    },
    "mfj": {
      "fifteenRateMax": 613700,
      "zeroRateMax": 98900
    },
    "mfs": {
      "fifteenRateMax": 306850,
      "zeroRateMax": 49450
    },
    "qss": {
      "fifteenRateMax": 613700,
      "zeroRateMax": 98900
    },
    "single": {
      "fifteenRateMax": 545500,
      "zeroRateMax": 49450
    }
  },
  "CTC_2024": {
    "earnedIncomeRate": 0.15,
    "earnedIncomeThreshold": 2500,
    "perChild": 2200,
    "perOtherDependent": 500,
    "phaseoutIncrement": 1000,
    "phaseoutPer1000": 50,
    "refundableCapPerChild": 1700
  },
  "CTC_PHASEOUT_THRESHOLD_2024": {
    "hoh": 200000,
    "mfj": 400000,
    "mfs": 200000,
    "qss": 200000,
    "single": 200000
  },
  "IRA_2024": {
    "contributionLimit": 7500,
    "contributionLimitAge50": 8600,
    "minPhasedDeduction": 200,
    "phaseout": {
      "coveredMfj": {
        "end": 149000,
        "start": 129000
      },
      "coveredMfs": {
        "end": 10000,
        "start": 0
      },
      "coveredSingleHoh": {
        "end": 91000,
        "start": 81000
      },
      "spouseCoveredMfj": {
        "end": 252000,
        "start": 242000
      }
    },
    "roundUpTo": 10
  },
  "HSA_2024": {
    "catchUp": 1000,
    "catchUpAge": 55,
    "family": 8750,
    "selfOnly": 4400
  },
  "EITC_2024": [
    {
      "earnedIncomeAmount": 8680,
      "maxCredit": 664,
      "phaseInRate": 0.0765,
      "phaseoutRate": 0.0765,
      "phaseoutThreshold": 10860,
      "phaseoutThresholdMfj": 18140
    },
    {
      "earnedIncomeAmount": 13020,
      "maxCredit": 4427,
      "phaseInRate": 0.34,
      "phaseoutRate": 0.1598,
      "phaseoutThreshold": 23890,
      "phaseoutThresholdMfj": 31160
    },
    {
      "earnedIncomeAmount": 18290,
      "maxCredit": 7316,
      "phaseInRate": 0.4,
      "phaseoutRate": 0.2106,
      "phaseoutThreshold": 23890,
      "phaseoutThresholdMfj": 31160
    },
    {
      "earnedIncomeAmount": 18290,
      "maxCredit": 8231,
      "phaseInRate": 0.45,
      "phaseoutRate": 0.2106,
      "phaseoutThreshold": 23890,
      "phaseoutThresholdMfj": 31160
    }
  ],
  "EITC_INVESTMENT_INCOME_LIMIT_2024": 12200,
  "EITC_CHILDLESS_AGE": {
    "maxExclusive": 65,
    "min": 25
  },
  "QBI_2024": {
    "phaseInRange": {
      "hoh": 75000,
      "mfj": 150000,
      "mfs": 75000,
      "qss": 75000,
      "single": 75000
    },
    "rate": 0.2,
    "threshold": {
      "hoh": 201750,
      "mfj": 403500,
      "mfs": 201775,
      "qss": 201750,
      "single": 201750
    }
  },
  "SS_TAXABILITY_2024": {
    "firstTierRate": 0.5,
    "maxInclusionRate": 0.85
  },
  "SE_TAX_2024": {
    "deductibleFraction": 0.5,
    "medicareRate": 0.029,
    "netEarningsFactor": 0.9235,
    "socialSecurityRate": 0.124,
    "socialSecurityWageBase": 184500
  },
  "ADDITIONAL_MEDICARE_2024": {
    "rate": 0.009,
    "thresholds": {
      "hoh": 200000,
      "mfj": 250000,
      "mfs": 125000,
      "qss": 200000,
      "single": 200000
    }
  },
  "NIIT_2024": {
    "rate": 0.038,
    "thresholds": {
      "hoh": 200000,
      "mfj": 250000,
      "mfs": 125000,
      "qss": 250000,
      "single": 200000
    }
  },
  "CAPITAL_LOSS_LIMIT_2024": {
    "hoh": 3000,
    "mfj": 3000,
    "mfs": 1500,
    "qss": 3000,
    "single": 3000
  },
  "MEDICAL_AGI_FLOOR_2024": 0.075,
  "SALT_CAP_2024": {
    "floor": 10000,
    "floorMfs": 5000,
    "mfs": 20200,
    "phasedownRate": 0.3,
    "phasedownThreshold": 505000,
    "phasedownThresholdMfs": 252500,
    "standard": 40400
  },
  "CHARITABLE_LIMITS_2024": {
    "cashPctOfAgi": 0.6,
    "nonCashPctOfAgi": 0.3
  },
  "MORTGAGE_DEBT_LIMIT_2024": {
    "grandfathered": 1000000,
    "grandfatheredMfs": 500000,
    "postDec2017": 750000,
    "postDec2017Mfs": 375000
  },
  "STUDENT_LOAN_INTEREST_2024": {
    "maxDeduction": 2500,
    "phaseout": {
      "hoh": {
        "end": 100000,
        "start": 85000
      },
      "mfj": {
        "end": 205000,
        "start": 175000
      },
      "mfs": {
        "end": 0,
        "start": 0
      },
      "qss": {
        "end": 100000,
        "start": 85000
      },
      "single": {
        "end": 100000,
        "start": 85000
      }
    }
  },
  "EDUCATOR_EXPENSE_2024": {
    "perEducator": 350
  },
  "EARLY_WITHDRAWAL_PENALTY_2024": {
    "earlyNoExceptionCodes": [
      "1",
      "J",
      "S"
    ],
    "rate": 0.1
  },
  "CARE_CREDIT_2024": {
    "expenseCapOnePerson": 3000,
    "expenseCapTwoPlus": 6000,
    "fullRateAgiCeiling": 15000,
    "maxRate": 0.5,
    "minRate": 0.2,
    "rateStep": 0.01,
    "rateStepIncome": 2000
  },
  "EDUCATION_CREDITS_2024": {
    "aotc": {
      "firstTier": 2000,
      "max": 2500,
      "maxPriorYears": 4,
      "refundablePortion": 0.4,
      "secondTier": 2000,
      "secondTierRate": 0.25
    },
    "llc": {
      "expenseCap": 10000,
      "max": 2000,
      "rate": 0.2
    },
    "phaseout": {
      "hoh": {
        "end": 90000,
        "start": 80000
      },
      "mfj": {
        "end": 180000,
        "start": 160000
      },
      "mfs": {
        "end": 0,
        "start": 0
      },
      "qss": {
        "end": 90000,
        "start": 80000
      },
      "single": {
        "end": 90000,
        "start": 80000
      }
    }
  },
  "SAVERS_CREDIT_2024": {
    "contributionCap": 2000,
    "tiers": {
      "hoh": [
        {
          "agiCeiling": 36375,
          "rate": 0.5
        },
        {
          "agiCeiling": 39375,
          "rate": 0.2
        },
        {
          "agiCeiling": 60375,
          "rate": 0.1
        }
      ],
      "mfj": [
        {
          "agiCeiling": 48500,
          "rate": 0.5
        },
        {
          "agiCeiling": 52500,
          "rate": 0.2
        },
        {
          "agiCeiling": 80500,
          "rate": 0.1
        }
      ],
      "mfs": [
        {
          "agiCeiling": 24250,
          "rate": 0.5
        },
        {
          "agiCeiling": 26250,
          "rate": 0.2
        },
        {
          "agiCeiling": 40250,
          "rate": 0.1
        }
      ],
      "qss": [
        {
          "agiCeiling": 24250,
          "rate": 0.5
        },
        {
          "agiCeiling": 26250,
          "rate": 0.2
        },
        {
          "agiCeiling": 40250,
          "rate": 0.1
        }
      ],
      "single": [
        {
          "agiCeiling": 24250,
          "rate": 0.5
        },
        {
          "agiCeiling": 26250,
          "rate": 0.2
        },
        {
          "agiCeiling": 40250,
          "rate": 0.1
        }
      ]
    }
  },
  "CLEAN_ENERGY_2024": {
    "rate": 0.3
  },
  "EV_CREDIT_2024": {
    "magiCap": {
      "hoh": 225000,
      "mfj": 300000,
      "mfs": 150000,
      "qss": 150000,
      "single": 150000
    },
    "max": 7500
  },
  "STANDARD_DEDUCTION_2024": {
    "hoh": 24150,
    "mfj": 32200,
    "mfs": 16100,
    "qss": 32200,
    "single": 16100
  },
  "ADDITIONAL_STD_DEDUCTION_2024": {
    "married": 1650,
    "unmarried": 2050
  },
  "DEPENDENT_STD_DEDUCTION_2024": {
    "earnedIncomeBump": 450,
    "floor": 1350
  },
  "AMT_2024": {
    "exemption": {
      "hoh": 90100,
      "mfj": 140200,
      "mfs": 70100,
      "qss": 140200,
      "single": 90100
    },
    "exemptionPhaseoutRate": 0.5,
    "exemptionPhaseoutThreshold": {
      "hoh": 500000,
      "mfj": 1000000,
      "mfs": 500000,
      "qss": 1000000,
      "single": 500000
    },
    "highRate": 0.28,
    "lowRate": 0.26,
    "rate28Threshold": 244500,
    "rate28ThresholdMfs": 122250
  }
}
const verifiedCurrent: TaxRuleSet = current
export function taxRules(year: TaxYear): TaxRuleSet { return year === 2026 ? verifiedCurrent : historical }
export function effectiveSaltCap(status: string, magi: number, year: TaxYear) {
    const cap = taxRules(year).SALT_CAP_2024
    if (year === 2024) return status === "mfs" ? cap.mfs : cap.standard
    const s = current.SALT_CAP_2024
    return Math.max(status === "mfs" ? s.floorMfs : s.floor,
        (status === "mfs" ? s.mfs : s.standard) - s.phasedownRate * Math.max(0, magi - (status === "mfs" ? s.phasedownThresholdMfs : s.phasedownThreshold)))
}
