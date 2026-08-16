/**
 * Turns a bank-statement description ("SQ *BLUE BOTTLE COFFEE", "ACH PAYROLL
 * DEP") into one of the budget categories, so imported rows land in real
 * categories instead of a single "Other" bucket — which is what the category
 * list, the cap bars and the donut all group on.
 *
 * Ported 1:1 from Features/Budgeting/TransactionCategorizer.swift. Matching is
 * keyword-on-lowercased-description, first table hit wins, and the tables are
 * ordered most-specific-first: "student loan" has to beat "loan", and a grocery
 * store has to beat a generic "market".
 */

import { categoriesFor, type BudgetType, type ItemType } from "@/lib/budget/types"

type Table = { category: string; keywords: string[] }[]

const PERSONAL_EXPENSE: Table = [
    {
        category: "Savings",
        keywords: ["savings", "emergency fund", "ally bank", "marcus", "sofi save", "transfer to sav", "acorns", "betterment"],
    },
    {
        category: "Retirement",
        keywords: ["401k", "401 k", "403b", "roth", " ira", "ira ", "retirement", "pension", "vanguard", "fidelity", "empower"],
    },
    {
        category: "Debt Payments",
        keywords: ["student loan", "navient", "sallie mae", "nelnet", "loan payment", "car loan", "auto loan", "credit card payment", "card payment", "cc payment", "interest charge", "collections", "afterpay", "klarna", "affirm"],
    },
    {
        category: "Housing",
        keywords: ["rent", "mortgage", "landlord", "hoa ", " hoa", "property mgmt", "property management", "apartment", "lease payment", "escrow", "zillow", "greystar"],
    },
    {
        category: "Utilities",
        keywords: ["electric", "power co", "pg&e", "con ed", "coned", "duke energy", "national grid", "water bill", "water dept", "sewer", "trash", "waste management", "internet", "comcast", "xfinity", "spectrum", "verizon", "at&t", "att ", "t-mobile", "tmobile", "sprint", "utility", "utilities", "natural gas", "gas company"],
    },
    {
        category: "Food",
        keywords: ["grocer", "supermarket", "safeway", "kroger", "trader joe", "whole foods", "aldi", "publix", "wegmans", "sprouts", "food lion", "h-e-b", "heb ", "restaurant", "cafe", "caffe", "coffee", "starbucks", "dunkin", "peet", "mcdonald", "chipotle", "subway", "panera", "wendy", "burger", "pizza", "taco", "sushi", "deli", "bakery", "doordash", "uber eats", "ubereats", "grubhub", "postmates", "instacart", "seamless", "diner", "bistro", "steakhouse", "food"],
    },
    {
        category: "Transportation",
        keywords: ["uber", "lyft", "shell", "chevron", "exxon", "mobil", "texaco", "bp ", "bp#", "citgo", "sunoco", "arco", "wawa", "fuel", "gas station", "parking", "toll", "e-zpass", "ezpass", "transit", "metro card", "metrocard", "mta*", "mta ", "nyct", "paygo", "septa", "wmata", "bart ", "caltrain", "amtrak", "greyhound", "airline", "delta air", "united air", "southwest air", "jetblue", "american air", "car wash", "jiffy lube", "oil change", "autozone", "tire", "dmv", "zipcar", "hertz", "avis", "enterprise rent"],
    },
    {
        category: "Entertainment",
        keywords: ["netflix", "spotify", "hulu", "disney", "hbo", "max.com", "peacock", "paramount", "apple music", "apple tv", "youtube", "prime video", "audible", "kindle", "steam", "xbox", "playstation", "nintendo", "twitch", "patreon", "cinema", "movie", "amc ", "regal ", "theater", "theatre", "concert", "ticketmaster", "stubhub", "eventbrite", "bar ", "pub ", "brewery", "tavern", "liquor", "casino", "golf"],
    },
    {
        category: "Healthcare",
        keywords: ["pharmacy", "cvs", "walgreens", "rite aid", "doctor", "physician", "dentist", "dental", "orthodont", "medical", "clinic", "hospital", "urgent care", "optometr", "vision center", "lenscrafters", "therapy", "therapist", "psychiatr", "labcorp", "quest diagnostics", "healthcare", "health center", "gym", "fitness", "planet fit", "equinox", "peloton"],
    },
    {
        category: "Insurance",
        keywords: ["insurance", "geico", "progressive", "allstate", "state farm", "usaa", "aetna", "cigna", "blue cross", "blue shield", "unitedhealth", "humana", "kaiser", "lemonade", "policy premium", "premium payment"],
    },
]

const PERSONAL_INCOME: Table = [
    {
        category: "Salary",
        keywords: ["payroll", "salary", "paycheck", "direct dep", "dir dep", "wages", "adp ", "gusto", "paychex", "workday", "employer", "bi-weekly pay"],
    },
    {
        category: "Freelance",
        keywords: ["freelance", "invoice", "upwork", "fiverr", "contract", "consulting", "1099", "contractor", "stripe payout", "paypal payout", "gig"],
    },
    {
        category: "Investments",
        keywords: ["dividend", "capital gain", "interest earned", "interest paid", "brokerage", "coinbase", "robinhood", "e*trade", "etrade", "schwab", "vanguard", "fidelity", "webull", "treasury"],
    },
    { category: "Gift", keywords: ["gift", "birthday", "venmo from", "zelle from", "cash app from"] },
]

const BUSINESS_EXPENSE: Table = [
    {
        category: "Salaries/Wages",
        keywords: ["payroll", "salary", "wages", "adp ", "gusto", "paychex", "rippling", "justworks", "contractor pay"],
    },
    {
        category: "Marketing & Advertising",
        keywords: ["google ads", "facebook ads", "meta ads", "advertis", "marketing", "seo ", "mailchimp", "klaviyo", "hubspot", "linkedin ads", "tiktok ads", "sponsorship", "campaign"],
    },
    {
        category: "Software & Subscriptions",
        keywords: ["software", "saas", "aws", "amazon web", "azure", "google cloud", "gcp ", "digitalocean", "heroku", "slack", "notion", "figma", "adobe", "github", "gitlab", "atlassian", "zoom", "dropbox", "salesforce", "stripe fee", "subscription", "license", "hosting", "domain"],
    },
    {
        category: "Professional Fees",
        keywords: ["legal", "attorney", "lawyer", "law firm", "accountant", "cpa ", "bookkeep", "audit", "notary", "consulting fee", "advisory"],
    },
    { category: "Rent/Lease", keywords: ["rent", "lease", "office space", "coworking", "wework", "sublease"] },
    {
        category: "Utilities",
        keywords: ["electric", "water bill", "internet", "comcast", "xfinity", "verizon", "at&t", "phone bill", "utility", "utilities", "natural gas"],
    },
    {
        category: "Travel",
        keywords: ["airline", "flight", "delta air", "united air", "southwest air", "jetblue", "hotel", "marriott", "hilton", "hyatt", "airbnb", "travel", "uber", "lyft", "car rental", "hertz", "avis", "per diem"],
    },
    {
        category: "Taxes",
        keywords: ["irs ", "tax payment", "franchise tax", "sales tax", "payroll tax", "estimated tax", "state tax", "dept of revenue"],
    },
    { category: "Insurance", keywords: ["insurance", "liability policy", "workers comp", "policy premium"] },
    {
        category: "Repairs & Maintenance",
        keywords: ["repair", "maintenance", "hvac", "plumb", "electrician", "janitorial", "cleaning service"],
    },
    {
        category: "Cost of Goods Sold (COGS)",
        keywords: ["inventory", "wholesale", "supplier", "raw material", "materials", "freight", "shipping", "fulfillment", "manufactur", "packaging", "ups ", "fedex", "usps"],
    },
    {
        category: "Supplies",
        keywords: ["supplies", "staples", "office depot", "uline", "printer", "stationery"],
    },
    {
        category: "Loan Payments",
        keywords: ["loan payment", "sba loan", "line of credit", "interest charge", "term loan", "merchant advance"],
    },
]

const BUSINESS_INCOME: Table = [
    { category: "Subscriptions", keywords: ["subscription", "recurring", "membership", "mrr", "renewal"] },
    { category: "Service Revenue", keywords: ["service", "consulting", "retainer", "labor", "installation"] },
    {
        category: "Sales Revenue",
        keywords: ["sale", "order", "shopify", "stripe", "square", "paypal", "etsy", "amazon", "ebay", "woocommerce", "pos deposit", "card settlement"],
    },
    { category: "Interest Earned", keywords: ["interest", "dividend", "treasury", "money market"] },
    { category: "Other Fees", keywords: ["fee", "late charge", "surcharge", "penalty"] },
]

/** The catch-all each list ends with. */
export function fallbackCategory(type: ItemType, budgetType: BudgetType): string {
    if (budgetType === "personal") return "Other"
    return type === "income" ? "Other Revenue" : "Other Operating Costs"
}

/** Best category for a statement line; an unmatched description gets the catch-all. */
export function categorize(description: string, type: ItemType, budgetType: BudgetType): string {
    const text = description.toLowerCase()
    const table =
        budgetType === "personal"
            ? type === "expense"
                ? PERSONAL_EXPENSE
                : PERSONAL_INCOME
            : type === "expense"
              ? BUSINESS_EXPENSE
              : BUSINESS_INCOME

    for (const entry of table) {
        if (entry.keywords.some((keyword) => text.includes(keyword))) return entry.category
    }
    return fallbackCategory(type, budgetType)
}

/**
 * Whether a category is a real option for this budget — imported snapshots can
 * carry categories from the other budget type, which would otherwise show up as
 * a phantom group in the list and the donut.
 */
export function isValidCategory(category: string, type: ItemType, budgetType: BudgetType): boolean {
    return categoriesFor(type, budgetType).includes(category)
}

/**
 * Maps a Plaid personal_finance_category primary to a budget category (ported
 * from mapPlaidCategory).
 */
export function plaidCategory(primary: string, type: ItemType, budgetType: BudgetType): string {
    if (type === "income") {
        if (budgetType === "business") return "Other Revenue"
        return /INCOME|PAYROLL|DEPOSIT/.test(primary) ? "Salary" : "Other"
    }
    if (budgetType === "business") return "Other Operating Costs"
    const map: Record<string, string> = {
        FOOD_AND_DRINK: "Food",
        RENT_AND_UTILITIES: "Housing",
        TRANSPORTATION: "Transportation",
        TRAVEL: "Transportation",
        ENTERTAINMENT: "Entertainment",
        MEDICAL: "Healthcare",
        LOAN_PAYMENTS: "Debt Payments",
        INSURANCE: "Insurance",
    }
    return map[primary] ?? "Other"
}
