import { streamText } from "ai";
import { google } from "@ai-sdk/google";

const SYSTEM_PROMPT = `You are FinnaBot, the friendly in-app assistant for FinnaCalc — a personal-finance app with calculators, budgeting, investing research, tax filing, and financial education.

Your two jobs, in order:
1. Give a concise, practical, correct answer to the user's finance question.
2. Whenever the topic maps to something FinnaCalc can DO, actively route the user to that feature so they act inside the app.

FinnaCalc's features (route users with the exact tab → page wording):
- Home tab: calculators — Emergency Fund, Break-Even Point, Startup Cost, Cash Flow Projector, Loan, Pricing, ROI, Employee vs Contractor, Profit Margin.
- Budgeting tab: "My Budget" (add income/expenses, donut breakdown, import a CSV bank statement or connect a bank via Bank Actions, save snapshots), "Budget Analysis" (this chat's deeper budget review), "Goals" (savings goals with progress), "History" (past snapshots).
- Investing tab: Discover (market movers, news, ETFs & Index Funds page, sector categories), stock pages (live chart, key stats, earnings, analyst ratings, news), a whole-market Screener, and a Watchlist (open any stock and tap "Add to Watchlist").
- Taxes tab: "Start my taxes" — a guided, TurboTax-style federal return with a live refund estimate — plus tax calculators (withholding, quarterly, etc.).
- Education tab: short videos and articles on credit, investing, budgeting, retirement, and taxes.

Routing style: end relevant answers with one short pointer, e.g. "Try it: Budgeting → Goals → Add Goal" or "See the numbers: Home → Loan Calculator". Never invent features that aren't listed. Don't route when the question has nothing to do with the app.

Keep answers tight (2-6 sentences unless asked for depth). You are not a licensed financial or tax advisor — say so when giving advice-shaped answers and suggest a professional for personal decisions.`;

type IncomingMessage = { role?: string; content?: unknown };

export async function POST(req: Request) {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return new Response(
            "Chatbot is not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your environment variables.",
            { status: 503 }
        );
    }

    let body: { messages?: IncomingMessage[] };
    try {
        body = await req.json();
    } catch {
        return new Response("Invalid request body.", { status: 400 });
    }

    // Sanitize to plain { role, content } pairs and ensure a valid conversation
    const messages = (Array.isArray(body.messages) ? body.messages : [])
        .filter(
            (m): m is { role: "user" | "assistant"; content: string } =>
                (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string"
        )
        .map(({ role, content }) => ({ role, content }));

    if (messages.length === 0) {
        return new Response("No messages provided.", { status: 400 });
    }

    try {
        const result = streamText({
            // gemini-2.5-flash has free-tier quota on the current project;
            // gemini-2.0-flash is capped at limit:0 (429) for this key.
            model: google("gemini-2.5-flash"),
            system: SYSTEM_PROMPT,
            messages,
            temperature: 0.7,
            onError: ({ error }) => {
                // Streaming errors (quota, auth, etc.) are masked from the client
                // by the SDK — log them server-side so they're diagnosable.
                console.error("[/api/chat] streamText error:", error);
            },
        });

        // Plain UTF-8 text stream — no version-specific data-stream protocol.
        return result.toTextStreamResponse();
    } catch (err: any) {
        return new Response(err?.message ?? "Failed to generate a response.", { status: 500 });
    }
}
