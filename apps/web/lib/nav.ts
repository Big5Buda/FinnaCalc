import { CALCULATORS } from "@finnacalc/shared/calculators-catalog"

/**
 * The site's menu, and the single source of truth for what pages exist.
 *
 * Every item here maps to a feature that actually ships in the app — the
 * budgeting screens, the investing tools, the tax engine's real capabilities,
 * the education topics with lessons written for them. Nothing in this menu is
 * a page describing something that doesn't exist yet.
 *
 * The nav, the footer and the section index pages all read this, so a menu
 * entry and its page can never drift apart.
 */

export type MenuItem = {
    label: string
    href: string
    /** One line, shown under the label in the dropdown. */
    blurb: string
}

export type Menu = {
    label: string
    /** The menu label is itself a link — to the section's index page. */
    href: string
    items: MenuItem[]
}

/** The six calculators the menu surfaces; the rest live on the index page. */
const FEATURED_CALCULATORS = [
    "loan",
    "retirement",
    "compound-interest",
    "emergency-fund",
    "break-even",
    "cash-flow",
] as const

const calculatorItems: MenuItem[] = FEATURED_CALCULATORS.map((slug) => {
    const entry = CALCULATORS.find((candidate) => candidate.slug === slug)
    if (!entry) throw new Error(`nav: unknown calculator slug "${slug}"`)
    return {
        label: entry.shortTitle,
        href: `/calculators/${entry.slug}`,
        blurb: entry.summary,
    }
})

export const MENUS: Menu[] = [
    {
        label: "Calculators",
        href: "/calculators",
        items: [
            ...calculatorItems,
            {
                label: `All ${CALCULATORS.length} calculators`,
                href: "/calculators",
                blurb: "The full set — personal, business, loans and investment",
            },
        ],
    },
    {
        label: "Budgeting",
        href: "/budgeting",
        items: [
            {
                label: "Budget",
                href: "/budgeting/budget",
                blurb: "Income and expenses, month by month",
            },
            {
                label: "Goals",
                href: "/budgeting/goals",
                blurb: "Save toward something, and watch it fill",
            },
            {
                label: "Subscriptions",
                href: "/budgeting/subscriptions",
                blurb: "Find the recurring charges you forgot about",
            },
            {
                label: "Analysis",
                href: "/budgeting/analysis",
                blurb: "Where the money actually goes",
            },
            {
                label: "History",
                href: "/budgeting/history",
                blurb: "Past months, saved and comparable",
            },
        ],
    },
    {
        label: "Investing",
        href: "/investing",
        items: [
            {
                label: "Portfolio",
                href: "/investing/portfolio",
                blurb: "Your real holdings and cost basis",
            },
            {
                label: "Watchlist",
                href: "/investing/watchlist",
                blurb: "The names you're keeping an eye on",
            },
            {
                label: "Screener",
                href: "/investing/screener",
                blurb: "Filter the market down to what you're after",
            },
            {
                label: "Trade Tracker",
                href: "/investing/trade-tracker",
                blurb: "What insiders, funds and Congress filed",
            },
            {
                label: "ETFs & index funds",
                href: "/investing/etfs",
                blurb: "The funds most people actually buy",
            },
            {
                label: "Bonds",
                href: "/investing/bonds",
                blurb: "Yields, and what they mean right now",
            },
        ],
    },
    {
        label: "Taxes",
        href: "/taxes",
        items: [
            {
                label: "Tax estimator",
                href: "/taxes/estimator",
                blurb: "A full return, worked through step by step",
            },
            {
                label: "Capital gains",
                href: "/taxes/capital-gains",
                blurb: "Short vs long term, and the 0% bracket",
            },
            {
                label: "Self-employment",
                href: "/taxes/self-employment",
                blurb: "Schedule SE, QBI and the quarterly problem",
            },
            {
                label: "State taxes",
                href: "/taxes/state",
                blurb: "The layer on top of your federal bill",
            },
        ],
    },
    {
        label: "Education",
        href: "/education",
        items: [
            {
                label: "Credit & Debt",
                href: "/education/credit",
                blurb: "Credit scores, borrowing, and paying off debt",
            },
            {
                label: "Investing",
                href: "/education/investing",
                blurb: "Stocks, bonds, funds, and managing risk",
            },
            {
                label: "Budgeting",
                href: "/education/budgeting",
                blurb: "Budgets, tracking spending, and saving",
            },
            {
                label: "Retirement",
                href: "/education/retirement",
                blurb: "401(k)s, IRAs, and long-term growth",
            },
            {
                label: "Taxes",
                href: "/education/taxes",
                blurb: "Brackets, deductions, credits, and forms",
            },
            {
                label: "Business",
                href: "/education/business",
                blurb: "Running the numbers on a business you own",
            },
        ],
    },
]

/** Flat list of every page this menu promises, for the footer and sitemap. */
export function allMenuHrefs(): string[] {
    return MENUS.flatMap((menu) => [menu.href, ...menu.items.map((item) => item.href)])
}
