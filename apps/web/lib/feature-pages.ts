/**
 * The content for every feature page the nav promises. One entry per page,
 * rendered by components/feature-page.tsx.
 *
 * Rules this file is written under: every claim describes something the app
 * verifiably does today — the budgeting screens, the investing tools, the tax
 * engine's actual test suite. Where a limit exists (13F lag, estimates not
 * advice), the page says it in `note` rather than hoping nobody asks.
 */

export type FamilyKey = "budgeting" | "investing" | "taxes"

export type FeaturePoint = { title: string; body: string }

export type FeaturePage = {
    /** Which colour family the hero band takes. */
    family: FamilyKey
    /** <title> and og title. */
    title: string
    headline: string
    lede: string
    points: FeaturePoint[]
    /** The honest caveat, shown small under the points. */
    note?: string
}

export const FAMILY_GROUND: Record<FamilyKey, string> = {
    budgeting: "bg-section-budgeting",
    investing: "bg-section-investing",
    taxes: "bg-section-taxes",
}

export const FEATURE_PAGES: Record<string, FeaturePage> = {
    /* ── Budgeting ──────────────────────────────────────────────────── */

    "budgeting/budget": {
        family: "budgeting",
        title: "Budget",
        headline: "A budget you'll actually keep.",
        lede: "Income on one side, spending on the other, month by month. Link your bank through Plaid or type it in by hand — either way it stays on your device.",
        points: [
            {
                title: "Caps that push back",
                body: "Set a cap per category and watch the bar fill as the month goes. When eating out crosses the line, the bar says so before your statement does.",
            },
            {
                title: "Months you can compare",
                body: "Each month saves as its own budget. Look back at March, copy it forward, or start clean.",
            },
            {
                title: "Personal and business, separately",
                body: "Two budgets that never mix, for people whose money has two jobs.",
            },
            {
                title: "Yours, literally",
                body: "Everything lives in your browser's storage, not on our servers. Clearing your data really deletes it — that's the point.",
            },
        ],
    },
    "budgeting/goals": {
        family: "budgeting",
        title: "Savings goals",
        headline: "Pick a number. Watch it fill.",
        lede: "A goal is a name, a target and a date. FinnaCalc does the arithmetic in between — what to put aside monthly, and whether you're on pace.",
        points: [
            {
                title: "Saving, spending, or income goals",
                body: "Save $5,000 by June, keep eating out under $200, get revenue past $10k. Three shapes of goal, one screen.",
            },
            {
                title: "Funded from your real budget",
                body: "Goals read the same budget lines the rest of the app uses, so progress is measured, not self-reported.",
            },
            {
                title: "On pace or not, plainly",
                body: "Each goal shows what monthly amount gets you there and whether the current pace makes the date.",
            },
        ],
    },
    "budgeting/subscriptions": {
        family: "budgeting",
        title: "Subscriptions",
        headline: "Find the charges you forgot about.",
        lede: "Recurring charges hide in plain sight. FinnaCalc pulls them out of your spending into one list with a monthly total.",
        points: [
            {
                title: "Spotted automatically",
                body: "Connect a bank and recurring charges surface on their own — same amount, same name, month after month.",
            },
            {
                title: "The real monthly cost",
                body: "Annual charges divided out, trials flagged by date, and one figure for what subscriptions actually cost you a month.",
            },
            {
                title: "Cancel with information",
                body: "Each row shows when it started and what it's added up to. What you do about it is up to you — we just do the math.",
            },
        ],
    },
    "budgeting/analysis": {
        family: "budgeting",
        title: "Spending analysis",
        headline: "Where the money actually goes.",
        lede: "Not where you think it goes — where it went. Category breakdowns, month-over-month movement, and the lines that changed.",
        points: [
            {
                title: "By category, honestly",
                body: "A breakdown of the month's spending with the categories ranked. The big slice is usually a surprise exactly once.",
            },
            {
                title: "Month against month",
                body: "This month beside last month, with what moved highlighted. Trends beat snapshots.",
            },
            {
                title: "Findings in plain language",
                body: "The analysis writes out what it noticed — a category running hot, a charge that doubled — as sentences, not just charts.",
            },
        ],
    },
    "budgeting/history": {
        family: "budgeting",
        title: "Budget history",
        headline: "Past months, kept and comparable.",
        lede: "Every saved month stays. Snapshots hold what a budget looked like on the day you saved it, so you can see drift instead of guessing at it.",
        points: [
            {
                title: "Snapshots on demand",
                body: "Save a named snapshot of the current budget — before a move, before a job change — and diff your life against it later.",
            },
            {
                title: "Net by month",
                body: "A running view of what each month ended at, which is the honest version of “how are we doing”.",
            },
            {
                title: "Restore or copy forward",
                body: "Any saved month can seed the next one. Budgets improve by iteration, not willpower.",
            },
        ],
    },

    /* ── Investing ──────────────────────────────────────────────────── */

    "investing/portfolio": {
        family: "investing",
        title: "Portfolio",
        headline: "Your actual holdings, with their actual cost basis.",
        lede: "Connect your brokerage through SnapTrade and see the portfolio you really have — positions, cost basis, performance — not a demo of someone else's.",
        points: [
            {
                title: "Read from your brokerage",
                body: "Positions and balances come from the account itself. Your login goes to SnapTrade, never to us.",
            },
            {
                title: "Orders execute at your brokerage",
                body: "When you trade, the order is placed with your own broker after showing you its real impact first. FinnaCalc never holds your money.",
            },
            {
                title: "Analysis on what you own",
                body: "Concentration, sector weight, how a position has moved since you bought it — computed from your data, on your screen.",
            },
        ],
        note: "Brokerage connections require a signed-in account, because there has to be somewhere to put them.",
    },
    "investing/watchlist": {
        family: "investing",
        title: "Watchlist",
        headline: "The names you're watching, in one row.",
        lede: "A watchlist is a lightweight commitment — you're not buying, you're paying attention. FinnaCalc keeps it fast and keeps it yours.",
        points: [
            {
                title: "Live prices",
                body: "Quotes and sparklines for everything on the list, from the same market data feed the rest of the app runs on.",
            },
            {
                title: "One tap deep",
                body: "Every row opens the full stock page — chart, key stats, ten years of SEC financials, and the news that mentions it.",
            },
            {
                title: "On your device",
                body: "The list itself is stored locally. What you're watching is nobody's data but yours.",
            },
        ],
    },
    "investing/screener": {
        family: "investing",
        title: "Screener",
        headline: "Filter the market down to what you're actually after.",
        lede: "Most actives, gainers, losers, or your own filters — price range, volume, sector. The screener turns “the market” into a list you can read.",
        points: [
            {
                title: "Presets that answer real questions",
                body: "What moved today, what's being traded hardest, what fell — one tap each.",
            },
            {
                title: "Filters that stack",
                body: "Price, volume, sector and direction combine, and the result is ranked so the top of the list means something.",
            },
            {
                title: "Straight into research",
                body: "Every result opens its stock page with the chart and the filings. Screening is the start of the question, not the answer.",
            },
        ],
    },
    "investing/trade-tracker": {
        family: "investing",
        title: "Trade Tracker",
        headline: "What insiders, funds and Congress actually filed.",
        lede: "Not rumours — filings. Form 4s from executives, 13F holdings from the big funds, and House disclosure reports, read from the government's own records.",
        points: [
            {
                title: "Insider trades, decoded",
                body: "A Form 4 mixes real buys with tax withholdings and grants. FinnaCalc labels each transaction code plainly, so an exercise-and-withhold doesn't read as a panic sale.",
            },
            {
                title: "Fund holdings, dated",
                body: "13F filings show a fund's reported positions and exactly which quarter they describe — a snapshot of the past, clearly labelled as one.",
            },
            {
                title: "Congress on the record",
                body: "House members' disclosure filings with links to the official documents. We show the filing; the PDF is the source.",
            },
        ],
        note: "13Fs arrive up to 45 days after a quarter ends and House reports disclose ranges, not exact amounts. The pages say so, because pretending otherwise would be a lie about latency.",
    },
    "investing/etfs": {
        family: "investing",
        title: "ETFs & index funds",
        headline: "The funds most people should probably start with.",
        lede: "Index ETFs are how most long-term money is actually invested. FinnaCalc covers the majors with live prices and plain explanations of what each one holds.",
        points: [
            {
                title: "The big indexes, live",
                body: "S&P 500, total market, Nasdaq 100, small caps, international — the ETFs that track them, with current prices and moves.",
            },
            {
                title: "What's inside, in words",
                body: "Each fund page says what the index holds and what owning it means, in sentences rather than factsheet jargon.",
            },
            {
                title: "Costs that compound",
                body: "Expense ratios look tiny until you run them over twenty years. We run them over twenty years.",
            },
        ],
    },
    "investing/bonds": {
        family: "investing",
        title: "Bonds",
        headline: "Yields, and what they're telling you.",
        lede: "Treasury yields set the floor under everything else. FinnaCalc shows the current picture and explains it like a person would.",
        points: [
            {
                title: "The yield picture",
                body: "Current Treasury yields across maturities, and what the shape of that curve has historically meant.",
            },
            {
                title: "Bonds vs. everything else",
                body: "What a guaranteed 4% is actually worth against a risky 7% — worked through with real arithmetic, not vibes.",
            },
            {
                title: "When boring wins",
                body: "The honest case for bonds at different ages and horizons, including the years when the answer is “not yet”.",
            },
        ],
    },
    "investing/safe-investments": {
        family: "investing",
        title: "Safe investments",
        headline: "Where cash goes when it shouldn't be moving.",
        lede: "Emergency funds and short-horizon money don't belong in stocks. This is the map of the alternatives — HYSAs, CDs, Treasuries, money market funds.",
        points: [
            {
                title: "The safe options, compared",
                body: "What each one pays, how locked up your money is, and what's actually guaranteed versus merely stable.",
            },
            {
                title: "Insurance limits, stated",
                body: "FDIC and NCUA limits explained plainly, because “safe” should mean something specific.",
            },
            {
                title: "Matched to the timeline",
                body: "Money you need in six months, two years, five years — each horizon has a right shelf, and the page walks the shelves.",
            },
        ],
    },

    /* ── Taxes ──────────────────────────────────────────────────────── */

    "taxes/estimator": {
        family: "taxes",
        title: "Tax estimator",
        headline: "A full return, worked through step by step.",
        lede: "Not a bracket lookup — a 1040 engine. Filing status, dependents, deductions, credits, capital gains, self-employment, state on top. It walks the same order the form does.",
        points: [
            {
                title: "The whole return",
                body: "Income, adjustments, the standard-vs-itemized decision, credits including EITC and the child tax credit, AMT when it applies — computed in sequence, the way the IRS does it.",
            },
            {
                title: "Checked 176 ways",
                body: "The engine runs against 176 automated test returns covering the edge cases that break simpler calculators. When tax law shifts, the tests catch what changed.",
            },
            {
                title: "An estimate that explains itself",
                body: "Every line of the result traces back to an input you gave it. No black box between your numbers and the answer.",
            },
        ],
        note: "An estimate for planning, clearly labelled as one. FinnaCalc never files for you and this is not tax advice.",
    },
    "taxes/capital-gains": {
        family: "taxes",
        title: "Capital gains",
        headline: "Short term, long term, and the 0% bracket most people miss.",
        lede: "The same dollar of gain can be taxed at 37% or at nothing, depending on holding period and income. The engine handles the real rules.",
        points: [
            {
                title: "Holding period, priced",
                body: "Short-term gains stack on ordinary income; long-term gains get their own brackets — including the 0% one. The estimator shows the difference on your numbers.",
            },
            {
                title: "Qualified dividends too",
                body: "Dividends ride the same preferential brackets when they qualify, and the engine computes the qualified-dividend worksheet properly.",
            },
            {
                title: "Timing, quantified",
                body: "What selling in December versus January actually changes, worked out rather than guessed at.",
            },
        ],
        note: "Estimates for planning. Wash-sale tracking and lot-level accounting stay at your brokerage.",
    },
    "taxes/self-employment": {
        family: "taxes",
        title: "Self-employment",
        headline: "Schedule SE, QBI, and the quarterly problem.",
        lede: "Self-employment tax is the one that ambushes first-year freelancers. The engine computes it the way the form does, deduction-for-half included.",
        points: [
            {
                title: "SE tax, correctly",
                body: "The 92.35% multiplier, the Social Security wage cap, the deduction for half of SE tax — the actual Schedule SE arithmetic, not a flat 15.3% guess.",
            },
            {
                title: "The QBI deduction",
                body: "Up to 20% of qualified business income comes off before tax, with the phase-outs applied where they apply. The engine runs the real thresholds.",
            },
            {
                title: "What to set aside",
                body: "The output you actually need as a freelancer: a defensible per-quarter number, from your income, not a rule of thumb.",
            },
        ],
        note: "Planning estimates. Entity choice and deductions strategy are conversations for your accountant.",
    },
    "taxes/state": {
        family: "taxes",
        title: "State taxes",
        headline: "The layer on top of the federal bill.",
        lede: "Nine states tax nothing, a few tax plenty, and the rest are somewhere specific in between. The estimator applies your state's actual structure.",
        points: [
            {
                title: "Your state's real rules",
                body: "Flat, progressive, or none — the engine carries each state's structure and applies the one you live under.",
            },
            {
                title: "One combined answer",
                body: "Federal plus state in a single estimate, which is the number that actually determines what a raise or a move is worth.",
            },
            {
                title: "Moves, priced",
                body: "Comparing two states side by side turns “I hear Texas is cheaper” into an actual figure on your actual income.",
            },
        ],
        note: "State rules shift year to year; the engine's tests pin the current ones. Local city taxes aren't modelled.",
    },
}

/** The section index pages: the family's one-line case plus its children. */
export type SectionIndex = {
    family: FamilyKey
    title: string
    headline: string
    lede: string
}

export const SECTION_INDEXES: Record<string, SectionIndex> = {
    budgeting: {
        family: "budgeting",
        title: "Budgeting",
        headline: "A budget that lives on your device, not our servers.",
        lede: "Link your bank or type it in. Caps, goals, subscriptions, analysis and history — all of it stored in your browser, where clearing your data really deletes it.",
    },
    investing: {
        family: "investing",
        title: "Investing",
        headline: "Live prices, your actual holdings, ten years of filings.",
        lede: "Research like you mean it: quotes, the screener, insider and fund filings, and your real portfolio. Orders execute at your own brokerage — we never touch the money.",
    },
    taxes: {
        family: "taxes",
        title: "Taxes",
        headline: "Know your tax bill before April does.",
        lede: "A real 1040 engine underneath — federal and state, capital gains, self-employment — checked against 176 test returns. An estimate you can plan around, never filed for you.",
    },
}
