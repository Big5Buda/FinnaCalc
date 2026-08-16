/**
 * The Trade Tracker catalog — who the app lets you follow, ported from
 * TrackerCatalog in Features/Investing/TradeTrackerView.swift.
 *
 * Identity only. Every figure on these pages comes from the person's own SEC
 * filings at read time (Form 4 for insiders, 13F for investors, House
 * disclosures for politicians); nothing numeric is stored here, and anyone
 * without a verified filer number says so rather than showing an empty feed as
 * if they never trade.
 *
 * The app draws bundled portrait cutouts. Those assets live in the iOS asset
 * catalog, so the web uses the monogram + org logo treatment the app falls back
 * to for anyone without a free portrait.
 */

export type TrackerCategory = "investors" | "insiders" | "politicians"

export const TRACKER_CATEGORIES: { id: TrackerCategory; title: string }[] = [
    { id: "investors", title: "Investors" },
    { id: "insiders", title: "Insiders" },
    { id: "politicians", title: "Politicians" },
]

export type TrackedPerson = {
    id: string
    name: string
    org: string
    /** One factual line on who they are or why their trades get watched. */
    blurb: string
    category: TrackerCategory
    /** The org's ticker and website — either resolves the corner logo badge. */
    logoSymbol: string
    logoDomain?: string
    emojiBadge?: string
    /**
     * SEC filer number. Insiders file Form 4 under their own CIK; investors
     * file 13F under their firm's. Empty means we have no verified filer.
     */
    cik?: string
}

export const TRACKER_CATALOG: TrackedPerson[] = [
    {
        id: "buffett",
        name: "Warren Buffett",
        org: "Berkshire Hathaway",
        blurb: "Chairman of Berkshire Hathaway. His quarterly filings are the most-watched portfolio in investing.",
        category: "investors",
        logoSymbol: "BRK-B",
    },
    {
        id: "ackman",
        name: "Bill Ackman",
        org: "Pershing Square",
        blurb: "Runs Pershing Square, a concentrated fund known for big public positions.",
        category: "investors",
        logoSymbol: "",
        logoDomain: "pershingsquareholdings.com",
    },
    {
        id: "wood",
        name: "Cathie Wood",
        org: "ARK Invest",
        blurb: "Founder of ARK Invest, funds focused on high-growth technology bets.",
        category: "investors",
        logoSymbol: "ARKK",
    },
    {
        id: "burry",
        name: "Michael Burry",
        org: "Scion Asset Management",
        blurb: "The Big Short investor. Runs a small, contrarian book at Scion.",
        category: "investors",
        logoSymbol: "",
        logoDomain: "scionasset.com",
    },
    {
        id: "dalio",
        name: "Ray Dalio",
        org: "Bridgewater Associates",
        blurb: "Founded Bridgewater, one of the largest hedge funds in the world.",
        category: "investors",
        logoSymbol: "",
        logoDomain: "bridgewater.com",
    },
    {
        id: "griffin",
        name: "Ken Griffin",
        org: "Citadel",
        blurb: "Founder and CEO of Citadel, among the most profitable funds ever.",
        category: "investors",
        logoSymbol: "",
        logoDomain: "citadel.com",
    },
    {
        id: "tepper",
        name: "David Tepper",
        org: "Appaloosa Management",
        blurb: "Distressed-debt specialist behind Appaloosa. Owns the Carolina Panthers.",
        category: "investors",
        logoSymbol: "",
    },
    {
        id: "druckenmiller",
        name: "Stanley Druckenmiller",
        org: "Duquesne Family Office",
        blurb: "Ran money with George Soros, now invests his own through Duquesne.",
        category: "investors",
        logoSymbol: "",
    },
    {
        id: "soros",
        name: "George Soros",
        org: "Soros Fund Management",
        blurb: "Famous for breaking the Bank of England. His family office still files quarterly.",
        category: "investors",
        logoSymbol: "",
    },
    {
        id: "icahn",
        name: "Carl Icahn",
        org: "Icahn Enterprises",
        blurb: "Veteran activist investor who takes stakes and pushes for change.",
        category: "investors",
        logoSymbol: "IEP",
    },
    {
        id: "klarman",
        name: "Seth Klarman",
        org: "Baupost Group",
        blurb: "Value investor and author of Margin of Safety, runs Baupost.",
        category: "investors",
        logoSymbol: "",
        logoDomain: "baupost.com",
    },
    {
        id: "gates",
        name: "Bill Gates",
        org: "Gates Foundation Trust",
        blurb: "Microsoft co-founder. The foundation trust's portfolio files publicly.",
        category: "investors",
        logoSymbol: "MSFT",
    },
    {
        id: "marks",
        name: "Howard Marks",
        org: "Oaktree Capital",
        blurb: "Co-founded Oaktree and writes the memos Wall Street actually reads.",
        category: "investors",
        logoSymbol: "",
        logoDomain: "oaktreecapital.com",
        cik: "0001214156",
    },
    {
        id: "musk",
        name: "Elon Musk",
        org: "Tesla",
        blurb: "CEO of Tesla. His stock sales and awards are among the most-watched filings.",
        category: "insiders",
        logoSymbol: "TSLA",
        cik: "0001494730",
    },
    {
        id: "huang",
        name: "Jensen Huang",
        org: "NVIDIA",
        blurb: "Co-founder and CEO of NVIDIA, the center of the AI chip boom.",
        category: "insiders",
        logoSymbol: "NVDA",
        cik: "0001197649",
    },
    {
        id: "nadella",
        name: "Satya Nadella",
        org: "Microsoft",
        blurb: "CEO of Microsoft since 2014.",
        category: "insiders",
        logoSymbol: "MSFT",
        cik: "0001513142",
    },
    {
        id: "zuckerberg",
        name: "Mark Zuckerberg",
        org: "Meta",
        blurb: "Founder and CEO of Meta. Sells on a preset schedule worth tracking.",
        category: "insiders",
        logoSymbol: "META",
        cik: "0001548760",
    },
    {
        id: "dimon",
        name: "Jamie Dimon",
        org: "JPMorgan Chase",
        blurb: "Longtime CEO of JPMorgan, the largest US bank. His rare sales make news.",
        category: "insiders",
        logoSymbol: "JPM",
        cik: "0001195345",
    },
    {
        id: "pichai",
        name: "Sundar Pichai",
        org: "Alphabet",
        blurb: "CEO of Alphabet and Google.",
        category: "insiders",
        logoSymbol: "GOOGL",
        cik: "0001534753",
    },
    {
        id: "jassy",
        name: "Andy Jassy",
        org: "Amazon",
        blurb: "CEO of Amazon, formerly built AWS.",
        category: "insiders",
        logoSymbol: "AMZN",
        cik: "0001374545",
    },
    {
        id: "bezos",
        name: "Jeff Bezos",
        org: "Amazon",
        blurb: "Founder and executive chair of Amazon. His planned sales move billions.",
        category: "insiders",
        logoSymbol: "AMZN",
        cik: "0001043298",
    },
    {
        id: "su",
        name: "Lisa Su",
        org: "AMD",
        blurb: "CEO credited with AMD's turnaround into an AI chip contender.",
        category: "insiders",
        logoSymbol: "AMD",
        logoDomain: "house.gov",
        cik: "0001405109",
    },
    {
        id: "tuberville",
        name: "Tommy Tuberville",
        org: "US Senate, Alabama",
        blurb: "Senator and former football coach with one of the most active trade records.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "senate.gov",
    },
    {
        id: "crenshaw",
        name: "Dan Crenshaw",
        org: "US House, Texas",
        blurb: "Texas representative whose disclosures draw regular attention.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "house.gov",
    },
    {
        id: "khanna",
        name: "Ro Khanna",
        org: "US House, California",
        blurb: "Represents Silicon Valley. Family disclosures are frequent and detailed.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "house.gov",
    },
    {
        id: "greene",
        name: "Marjorie Taylor Greene",
        org: "US House, Georgia",
        blurb: "Georgia representative known for frequent stock purchases.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "house.gov",
    },
    {
        id: "gottheimer",
        name: "Josh Gottheimer",
        org: "US House, New Jersey",
        blurb: "New Jersey representative and one of the chamber's most active traders.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "house.gov",
    },
    {
        id: "mccaul",
        name: "Michael McCaul",
        org: "US House, Texas",
        blurb: "Texas representative whose family files among the largest trade volumes.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "house.gov",
    },
    {
        id: "scott",
        name: "Rick Scott",
        org: "US Senate, Florida",
        blurb: "Florida senator and former hospital executive with sizable holdings.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "senate.gov",
    },
    {
        id: "trump",
        name: "Donald Trump",
        org: "White House",
        blurb: "President of the United States. His annual disclosures run to hundreds of holdings, including Trump Media.",
        category: "politicians",
        logoSymbol: "",
        emojiBadge: "\\u{1F1FA}\\u{1F1F8}",
    },
    {
        id: "bessent",
        name: "Scott Bessent",
        org: "US Treasury",
        blurb: "Treasury Secretary and former hedge fund manager who ran Key Square Group.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "home.treasury.gov",
    },
    {
        id: "lutnick",
        name: "Howard Lutnick",
        org: "US Commerce",
        blurb: "Commerce Secretary and former CEO of Cantor Fitzgerald.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "commerce.gov",
    },
    {
        id: "patel",
        name: "Kash Patel",
        org: "FBI",
        blurb: "FBI Director whose disclosed holdings regularly draw scrutiny.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "fbi.gov",
    },
    {
        id: "miller",
        name: "Stephen Miller",
        org: "White House",
        blurb: "Deputy chief of staff whose financial disclosures have drawn attention.",
        category: "politicians",
        logoSymbol: "",
        logoDomain: "whitehouse.gov",
    },
]

export function personById(id: string): TrackedPerson | undefined {
    return TRACKER_CATALOG.find((person) => person.id === id)
}

export function peopleIn(category: TrackerCategory): TrackedPerson[] {
    return TRACKER_CATALOG.filter((person) => person.category === category)
}

/**
 * Logo for an organisation's website — funds, agencies and anything else
 * without a ticker. Same Brandfetch CDN and 404 fallback as the ticker marks.
 */
export function domainLogoURL(domain: string, size = 64): string {
    const host = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    const side = [64, 128, 256].find((bucket) => bucket >= size * 2) ?? 256
    return `https://cdn.brandfetch.io/${host}/w/${side}/h/${side}/fallback/404?c=1idsFuoxxIb4DvxlMNa`
}
