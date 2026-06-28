// Shared catalog of education content (video lessons + reading resources) plus
// a small relevance-ranked search used by the education page. Keeping the data
// here lets both the Education page (search) and the Education Hub (browse) use
// the same source of truth.

export interface EduItem {
    title: string
    url: string
}

export const EDU_TOPICS: { id: string; name: string }[] = [
    { id: "credit", name: "Credit & Debt" },
    { id: "investing", name: "Investing" },
    { id: "budgeting", name: "Budgeting" },
    { id: "retirement", name: "Retirement" },
    { id: "taxes", name: "Tax Planning" },
]

export const videoLessons: Record<string, EduItem[]> = {
    credit: [
        { title: "What Is a Credit Score?", url: "https://www.youtube.com/watch?v=jwML94IOW0s" },
        { title: "What Can Change Your Credit Score?", url: "https://www.youtube.com/watch?v=IZN5IT28iHo" },
        { title: "Understanding Loans and Debt", url: "https://www.youtube.com/watch?v=E2dzSPOhUOI" },
        { title: "Good Debt vs. Bad Debt", url: "https://www.youtube.com/watch?v=MFCdA2vGVh4" },
        { title: "What Is APR and Why It Matters", url: "https://www.youtube.com/watch?v=MqqXTrEEZ7Y" },
        { title: "Understanding Your FICO Score", url: "https://www.youtube.com/watch?v=8AtM1R9NmwM" },
    ],
    investing: [
        { title: "What Are Stocks?", url: "https://www.youtube.com/watch?v=98qfFzqDKR8" },
        { title: "Bonds vs. Stocks: What's the Difference?", url: "https://www.youtube.com/watch?v=rs1md3e4aYU" },
        { title: "Understanding Risk and Return", url: "https://www.youtube.com/watch?v=7mo167ohvJw" },
        { title: "A Beginner's Guide to Investing", url: "https://www.youtube.com/watch?v=8_iWSsoiNXs" },
        { title: "Index Funds vs. Mutual Funds vs. ETFs", url: "https://www.youtube.com/watch?v=ugBs333NhbI" },
    ],
    retirement: [
        { title: "What Is a 401(k)?", url: "https://www.youtube.com/watch?v=d8rNitoPZeo" },
        { title: "An Introduction to Traditional IRAs", url: "https://www.youtube.com/watch?v=UV8kgqk_DAY" },
        { title: "The Power of a Roth IRA", url: "https://www.youtube.com/watch?v=Xd8VXDqXtkE" },
        { title: "Managing Your 401(k) When You Change Jobs", url: "https://www.youtube.com/watch?v=PLZHTIrazF8" },
    ],
    budgeting: [
        { title: "How to Budget Your Paycheck", url: "https://www.youtube.com/watch?v=5tQuez0kbOY" },
        { title: "How to Stop Living Paycheck to Paycheck", url: "https://www.youtube.com/watch?v=NSpMFtcXxcc" },
        { title: "How to Manage Your Money (The 50/30/20 Rule)", url: "https://www.youtube.com/watch?v=HQzoZfc3GwQ" },
        { title: "How to Manage Your Money (The 70/20/10 Rule)", url: "https://www.youtube.com/watch?v=HkNPZVu-jZM" },
        { title: "A Beginner's Guide to Paying Off Debt", url: "https://www.youtube.com/watch?v=_LdpjN2oDNo" },
    ],
    taxes: [
        { title: "What Are Taxes?", url: "https://www.youtube.com/watch?v=kdfk22Ck4nM" },
        { title: "How Tax Brackets Work", url: "https://www.youtube.com/watch?v=AhgR3X--bbY" },
        { title: "An Introduction to Tax Deductions", url: "https://www.youtube.com/watch?v=GypHy3gnG5E" },
        { title: "Understanding Tax Credits", url: "https://www.youtube.com/watch?v=4gYvlMwvdnw" },
        { title: "A Guide to Common Tax Forms (Part 1)", url: "https://www.youtube.com/watch?v=boklbFhF8l8" },
        { title: "A Guide to Common Tax Forms (Part 2)", url: "https://www.youtube.com/watch?v=W1562KoBExA" },
    ],
}

export const readingResources: Record<string, EduItem[]> = {
    credit: [
        { title: "An Introduction to Credit and Loans", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:loans-and-debt/xa6995ea67a8e9fdd:borrowing-money/a/loans-and-credit" },
        { title: "How to Raise Your Credit Score", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:consumer-credit/xa6995ea67a8e9fdd:credit-score/a/how-do-i-raise-my-credit-score" },
    ],
    investing: [
        { title: "How to Invest with Confidence", url: "https://www.investopedia.com/articles/basics/11/3-s-simple-investing.asp" },
        { title: "How and Where to Start Investing", url: "https://www.investopedia.com/terms/i/investment.asp" },
    ],
    retirement: [
        { title: "How to Invest for Retirement", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:investments-retirement/xa6995ea67a8e9fdd:investing/a/how-to-invest-in-your-retirement-account" },
        { title: "Building a Strong Foundation for Retirement", url: "https://www.khanacademy.org/college-careers-more/personal-finance/pf-investment-vehicles-insurance-and-retirement/pf-ira-401ks/a/building-a-foundation-for-retirement" },
        { title: "The Effect of Time on Your Retirement Savings", url: "https://www.khanacademy.org/college-careers-more/personal-finance/pf-investment-vehicles-insurance-and-retirement/pf-ira-401ks/a/the-effect-of-time-on-your-retirement-account" },
        { title: "Pensions, 403(b)s, and SIMPLE IRAs Explained", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:investments-retirement/xa6995ea67a8e9fdd:saving-for-retirement/a/what-is-a-pension-403-b-simple-ira-and-others" },
    ],
    budgeting: [
        { title: "What Is a Budget?", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:budgeting-and-saving/xa6995ea67a8e9fdd:budgeting/a/what-is-a-budget" },
        { title: "A Step-by-Step Guide to Creating a Budget", url: "https://www.khanacademy.org/college-careers-more/personal-finance/pf-saving-and-budgeting/tips-for-tracking-and-saving-money/a/creating-a-budget" },
        { title: "How to Balance Your Budget", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:budgeting-and-saving/xa6995ea67a8e9fdd:budgeting/a/balancing-your-budget" },
        { title: "Understanding Budgeting Constraints and Decisions", url: "https://www.khanacademy.org/economics-finance-domain/microeconomics/choices-opp-cost-tutorial/utility-maximization-with-indifference-curves/a/how-individuals-make-choices-based-on-their-budget-constraint-cnx" },
    ],
    taxes: [
        { title: "An Overview of Common Tax Forms", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:taxes-and-tax-forms/xa6995ea67a8e9fdd:tax-forms/a/tax-forms" },
        { title: "Your Guide to Key Tax Terms", url: "https://www.khanacademy.org/math/grade-7-math-tx/xa876d090ec748f45:number-and-operations/xa876d090ec748f45:income-tax-withholding/a/your-guide-to-key-tax-terms-brought-to-you-by-better-money-habits" },
        { title: "Understanding the Taxes You Pay", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:taxes-and-tax-forms/xa6995ea67a8e9fdd:what-are-taxes/a/understanding-the-taxes-you-pay" },
        { title: "A Guide to Taxes for the Self-Employed", url: "https://www.khanacademy.org/college-careers-more/financial-literacy/xa6995ea67a8e9fdd:employment/xa6995ea67a8e9fdd:non-typical-pay-structures/a/tax-responsibilities-for-self-employed-individuals" },
    ],
}

export interface EduSearchDoc {
    topic: string
    topicName: string
    type: "video" | "article"
    title: string
    url: string
    index: number
}

const topicName = (id: string) => EDU_TOPICS.find((t) => t.id === id)?.name ?? id

export const EDU_SEARCH_INDEX: EduSearchDoc[] = [
    ...Object.entries(videoLessons).flatMap(([topic, items]) =>
        items.map((it, index) => ({ topic, topicName: topicName(topic), type: "video" as const, title: it.title, url: it.url, index }))
    ),
    ...Object.entries(readingResources).flatMap(([topic, items]) =>
        items.map((it, index) => ({ topic, topicName: topicName(topic), type: "article" as const, title: it.title, url: it.url, index }))
    ),
]

// ─── Relevance search ────────────────────────────────────────────────────────────

const STOP = new Set([
    "how", "to", "what", "is", "are", "a", "an", "the", "and", "or", "of", "in", "for",
    "my", "do", "i", "on", "with", "you", "your", "vs", "me", "can", "should", "about",
    "best", "way", "ways", "tips", "guide", "explain", "explained",
])

function tokenize(s: string): string[] {
    return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t))
}

function stem(t: string): string {
    return t.replace(/(ings|ing|ies|ied|ed|es|s)$/i, "") || t
}

/**
 * Ranks education content against a free-text query. Forgiving: matches on
 * stems, prefixes, and substrings so "how to invest" surfaces "A Beginner's
 * Guide to Investing", "How and Where to Start Investing", etc. Returns [] when
 * nothing is reasonably related.
 */
export function searchEducation(query: string): EduSearchDoc[] {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const qTokens = tokenize(q).map(stem)
    if (qTokens.length === 0) {
        // Query was all stopwords — fall back to a plain substring match.
        return EDU_SEARCH_INDEX.filter((d) => `${d.title} ${d.topicName}`.toLowerCase().includes(q))
    }

    const scored = EDU_SEARCH_INDEX.map((doc) => {
        const titleText = doc.title.toLowerCase()
        const fullText = `${doc.title} ${doc.topicName}`.toLowerCase()
        const docTokens = tokenize(fullText).map(stem)
        let score = 0

        if (titleText.includes(q)) score += 12 // whole phrase in the title
        else if (fullText.includes(q)) score += 8

        let matched = 0
        for (const qt of qTokens) {
            if (docTokens.includes(qt)) {
                score += 5
                matched++
            } else if (docTokens.some((dt) => dt.startsWith(qt) || qt.startsWith(dt))) {
                score += 3
                matched++
            } else if (fullText.includes(qt)) {
                score += 1.5
                matched++
            }
        }
        // Reward covering more of the query.
        if (matched === qTokens.length && qTokens.length > 1) score += 3

        return { doc, score }
    })

    return scored
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 24)
        .map((x) => x.doc)
}
