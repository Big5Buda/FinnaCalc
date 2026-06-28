import { streamText } from "ai"
import { google } from "@ai-sdk/google"

const SYSTEM_PROMPT = `You are FinnaCalc's senior personal-finance advisor — the caliber of a CFP® (Certified Financial Planner) with a gift for clear, motivating, plain-English explanations. You are given a user's REAL monthly budget data and must produce a deep, genuinely personalized analysis.

Non-negotiable rules:
- Ground EVERY observation in the user's specific numbers and percentages. Quote their actual dollar figures.
- Quantify impact: for each recommendation, state the dollar effect per month/year and, where relevant, how much sooner it reaches a goal.
- Prioritize ruthlessly: lead with the highest-impact opportunities first.
- Use established frameworks where they fit (50/30/20, 3–6 month emergency fund, high-interest-debt avalanche, pay-yourself-first, sinking funds) but adapt them to THIS person — never give generic boilerplate.
- Be concrete and actionable: exact amounts to reallocate and specific next steps, not vague encouragement.
- Tone: sharp, warm, and respectful. No filler, no hedging, no condescension.
- If the data looks incomplete (e.g., no expenses entered, income is 0), say so plainly and tell them what to add for a better analysis.

Format your reply in clean Markdown:
- Start with a single bold one-sentence headline verdict.
- Then sections with "## " headings (e.g., What's working, Biggest opportunities, Spending breakdown, Emergency & safety net, Goals, Action plan).
- Use short paragraphs and "- " bullet points. Bold the key dollar figures and percentages.
- End with a numbered, prioritized "## Your next 3 moves".
- Finish with one short italic line: educational only, not licensed financial advice.

Never invent numbers that aren't derivable from the provided data.`

type IncomingMessage = { role?: string; content?: unknown }

export async function POST(req: Request) {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return new Response(
            "Budget advisor is not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your environment variables.",
            { status: 503 }
        )
    }

    let body: { snapshot?: unknown; messages?: IncomingMessage[] }
    try {
        body = await req.json()
    } catch {
        return new Response("Invalid request body.", { status: 400 })
    }

    if (!body.snapshot) {
        return new Response("Budget snapshot is required.", { status: 400 })
    }

    const messages = (Array.isArray(body.messages) ? body.messages : [])
        .filter(
            (m): m is { role: "user" | "assistant"; content: string } =>
                (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string"
        )
        .map(({ role, content }) => ({ role, content }))

    if (messages.length === 0) {
        return new Response("No messages provided.", { status: 400 })
    }

    try {
        const result = streamText({
            model: google("gemini-2.5-flash"),
            system: `${SYSTEM_PROMPT}\n\n=== THE USER'S CURRENT MONTHLY BUDGET (JSON) ===\n${JSON.stringify(body.snapshot, null, 2)}`,
            messages,
            temperature: 0.6,
            onError: ({ error }) => {
                console.error("[/api/budget-advisor] streamText error:", error)
            },
        })
        return result.toTextStreamResponse()
    } catch (err: any) {
        return new Response(err?.message ?? "Failed to generate analysis.", { status: 500 })
    }
}
