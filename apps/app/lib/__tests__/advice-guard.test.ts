import { describe, expect, it } from "vitest"
import { extractSymbols, guardTextStream, screenText, splitSentences } from "../advice-guard"

/**
 * This corpus is the specification. It was written before the patterns, and a
 * pattern that fails it is wrong — not the corpus.
 *
 * Two modes. "securities" is /api/chat, where a conversation may be seeded
 * with the reader's real tickers, so a bare imperative one sentence after a
 * ticker is a recommendation. "budget" is /api/budget-advisor, where the
 * model is REQUIRED to say "increase", "cut", "reallocate" about budget lines
 * all day long, so only a sentence that names a security in the same breath
 * may be touched. The adversarial review of the first draft found it would
 * have blocked "you should increase that emergency fund transfer" and
 * truncated the paid deep report mid-stream. Those sentences are here so that
 * can never happen quietly again.
 */

type Case = { text: string; prev?: string }

const BLOCK_SECURITIES: Case[] = [
    { text: "You should sell NVDA before earnings." },
    { text: "I'd trim AAPL down to 20% of the portfolio." },
    { text: "Consider adding to your VTI position." },
    { text: "You might want to rebalance out of tech." },
    { text: "Sell.", prev: "NVDA is 34% of your portfolio." },
    { text: "Trim it.", prev: "NVDA is 34% of your portfolio." },
    { text: "It might be worth trimming that position.", prev: "NVDA is 34% of your portfolio." },
    { text: "One option would be to reduce NVDA and buy an index fund." },
    { text: "Most investors in your position lighten up on a single stock." },
    { text: "The math favours trimming NVDA here." },
    { text: "NVDA looks overvalued right now." },
    { text: "AAPL is a good buy at these levels." },
    { text: "That stock is cheap." },
    { text: "This ETF is a great pick for the long run." },
    { text: "NVDA will likely recover by year end." },
    { text: "The S&P 500 should rally into the new year." },
    { text: "I'd put the price target around $150." },
    { text: "It has room to run from here." , prev: "AAPL closed at $190." },
    { text: "Your portfolio is too concentrated in tech." },
    { text: "You're overexposed to a single holding." },
    { text: "An index fund is suitable for your age and timeline." },
    { text: "Given your goals, VOO makes sense for you." },
    { text: "Honestly, I can't advise, but historically buying the dip in SPY has paid off." },
    // A definition that ends in an instruction is still an instruction.
    { text: "A high P/E often means a stock is pricey, so you should sell that stock." },
]

const PASS_SECURITIES: Case[] = [
    { text: "NVDA is 34.2% of the portfolio, past the 25% cap you set." },
    { text: "Your largest position is AAPL at 31%." },
    { text: "A P/E ratio compares a share's price to the company's earnings per share." },
    { text: "Concentration risk means a bad day for one holding is a bad day for the portfolio." },
    { text: "Qualified dividends are taxed at long-term capital gains rates." },
    { text: "I can't tell you whether to sell NVDA; that's your call. What I can say is that it's 34% of the portfolio, and the Mix goal card shows the gap." },
    { text: "Historically the S&P 500 has fallen in about one year in four." },
    { text: "Nothing here is a recommendation to buy or sell any security." },
    { text: "You can buy fractional shares at most brokerages." },
    { text: "The Screener filters the whole market by criteria you choose." },
    { text: "You should increase your emergency fund contribution." },
    { text: "Trim your dining budget by $100 and the surplus grows." },
    { text: "Sell the car if the payment is crushing you." },
    { text: "An expense ratio is charged as a percentage of assets every year." },
    { text: "Choosing what to own is your call and outside what FinnaCalc does." },
    { text: "## Your next 3 moves" },
    { text: "That sector is 40% of the portfolio, which the card shows as a measurement." },
    // Definitions — what a figure generally means, with no specific subject.
    // The first of these was removed from a live answer on production.
    { text: "A high P/E ratio can suggest a stock is overvalued or that investors expect strong growth, while a low P/E may indicate it is undervalued." },
    { text: "Beta above 1 means a stock tends to swing more than the market as a whole." },
    { text: "A yield that looks high can be a sign the price has fallen, not that the payout is safe." },
    { text: "Analysts often describe a stock trading below book value as undervalued; that is a label, not a fact." },
]

const BLOCK_BUDGET: Case[] = [
    { text: "Invest the $400 surplus in an S&P 500 index fund." },
    { text: "You should put the extra $200 into VOO each month." },
    { text: "Consider buying some bonds with that cushion." },
    { text: "Move the surplus into a brokerage account and buy a broad ETF." },
]

const PASS_BUDGET: Case[] = [
    { text: "You should increase that emergency fund transfer to $300 a month." },
    { text: "Cut dining out by $150 and move it to the HOA reserve." },
    { text: "Reallocate $200 from subscriptions to the credit card balance." },
    { text: "Your PMI drops off once you reach 20% equity in the home." },
    { text: "Increase your 401(k) contribution to get the full match." },
    { text: "Build the cushion to 3–6 months of expenses." },
    { text: "IRA and HSA contributions reduce taxable income." },
    { text: "**Biggest opportunity:** the $340 in unused subscriptions." },
    { text: "- Add $120 to the sinking fund for car repairs." },
    { text: "Reduce the grocery line by $80 and the budget balances." },
    { text: "Your CPI-adjusted income is flat year over year." },
    { text: "Put the tax refund toward the highest-APR card first." },
]

function expectBlocked(cases: Case[], mode: "securities" | "budget") {
    for (const c of cases) {
        const input = c.prev ? `${c.prev} ${c.text}` : c.text
        const out = screenText(input, mode)
        expect(out.removed.length, `should block: ${c.text}`).toBeGreaterThan(0)
        expect(out.text, `blocked sentence should be gone: ${c.text}`).not.toContain(c.text)
    }
}

function expectPassed(cases: Case[], mode: "securities" | "budget") {
    for (const c of cases) {
        const input = c.prev ? `${c.prev} ${c.text}` : c.text
        const out = screenText(input, mode)
        expect(out.removed, `should pass: ${c.text}`).toEqual([])
        expect(out.text).toBe(input)
    }
}

describe("screenText — securities mode (/api/chat)", () => {
    it("removes recommendations, merit labels, predictions, verdicts and suitability", () => {
        expectBlocked(BLOCK_SECURITIES, "securities")
    })
    it("leaves measurements, definitions, refusals, disclaimers and budget talk alone", () => {
        expectPassed(PASS_SECURITIES, "securities")
    })
    it("keeps the clean sentences around a removed one and appends a single note", () => {
        const out = screenText(
            "NVDA is 34% of the portfolio. You should trim it. The Mix goal card shows the gap.",
            "securities"
        )
        expect(out.removed).toHaveLength(1)
        expect(out.text).toContain("NVDA is 34% of the portfolio.")
        expect(out.text).toContain("The Mix goal card shows the gap.")
        expect(out.text).not.toContain("You should trim it.")
        expect(out.text.match(/was removed/g)).toHaveLength(1)
    })
    it("uses the previous sentence as context, but only the previous one", () => {
        // Two sentences back is out of the window: "Sell." on its own after a
        // budget sentence is not a securities recommendation.
        const out = screenText("NVDA is 34% of the portfolio. Your rent is $1,400. Sell.", "securities")
        expect(out.removed).toEqual([])
    })
})

describe("screenText — budget mode (/api/budget-advisor)", () => {
    it("blocks only sentences that name a security", () => {
        expectBlocked(BLOCK_BUDGET, "budget")
    })
    it("never touches the verbs the budget prompt requires", () => {
        expectPassed(PASS_BUDGET, "budget")
    })
    it("does not read context across sentences", () => {
        const out = screenText("VOO is a broad fund. Increase your savings rate by 2%.", "budget")
        expect(out.removed).toEqual([])
    })
})

describe("splitSentences", () => {
    it("splits on terminators and on newlines, and keeps markdown lines whole", () => {
        expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"])
        expect(splitSentences("## Heading\n- bullet one\n- bullet two")).toEqual([
            "## Heading",
            "- bullet one",
            "- bullet two",
        ])
    })
    it("does not treat an all-caps heading as a run of tickers", () => {
        const out = screenText("## YOUR NEXT 3 MOVES\nCut the gym membership.", "securities")
        expect(out.removed).toEqual([])
    })
})

async function* chunks(parts: string[]) {
    for (const p of parts) yield p
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let out = ""
    for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        out += decoder.decode(value, { stream: true })
    }
    return out
}

describe("guardTextStream", () => {
    it("line granularity: emits each clean line as it completes, screens across chunk boundaries", async () => {
        const seen: string[] = []
        const stream = guardTextStream(
            chunks(["## Plan\n- Cut din", "ing by $100.\n- Invest the surplus in an index fund.\n- Add $50 to the cushion."]),
            { mode: "budget", granularity: "line", onFinish: (r) => { seen.push(...r.removed.map((x) => x.sentence)) } }
        )
        const out = await drain(stream)
        expect(out).toContain("## Plan")
        expect(out).toContain("- Cut dining by $100.")
        expect(out).toContain("- Add $50 to the cushion.")
        expect(out).not.toContain("Invest the surplus")
        expect(out).toContain("was removed")
        expect(seen).toEqual(["- Invest the surplus in an index fund."])
    })
    it("whole granularity: buffers everything, screens once, emits once", async () => {
        const stream = guardTextStream(chunks(["NVDA is 34%. ", "You should ", "sell it."]), {
            mode: "securities",
            granularity: "whole",
        })
        const out = await drain(stream)
        expect(out).toContain("NVDA is 34%.")
        expect(out).not.toContain("You should sell it.")
    })
    it("reports what was shown and the tail separately, for the record", async () => {
        let info: any
        const stream = guardTextStream(chunks(["NVDA is 34%. ", "You should sell it."]), {
            mode: "securities",
            granularity: "whole",
            tail: () => "\n\n(tail)",
            onFinish: (i) => {
                info = i
            },
        })
        const out = await drain(stream)
        expect(info.full).toBe("NVDA is 34%. You should sell it.")
        expect(info.shown).not.toContain("You should sell it.")
        expect(info.tail).toBe("\n\n(tail)")
        expect(out).toBe(info.shown + info.tail)
        expect(info.removed.map((r: any) => r.rule)).toEqual(["second-person-recommendation"])
    })
    it("emits the tail after the screened text", async () => {
        const stream = guardTextStream(chunks(["Fine."]), {
            mode: "securities",
            granularity: "whole",
            tail: () => "\n\n— cut off",
        })
        expect(await drain(stream)).toBe("Fine.\n\n— cut off")
    })
})

describe("extractSymbols", () => {
    it("finds tickers and ignores acronyms and shouted headings", () => {
        expect(extractSymbols("NVDA is 34%, AAPL 30%. Your IRA and HOA dues are separate.")).toEqual(["AAPL", "NVDA"])
        expect(extractSymbols("## YOUR NEXT 3 MOVES\nCut the gym membership.")).toEqual([])
        expect(extractSymbols("Nothing to see.")).toEqual([])
    })
})
