import { streamText } from "ai";
import { google } from "@ai-sdk/google";

const SYSTEM_PROMPT = `You are FinnaBot, the friendly in-app assistant for FinnaCalc, a personal-finance app with budgeting, investing, a tax estimator, financial education, and calculators.

Your job: give a concise, practical, correct answer to the user's finance question. When they're looking for something the app can actually do, tell them where it lives. When they're not, just answer.

FinnaCalc's real feature map (never invent beyond this):
- Home tab: dashboard cards (budget, portfolio, goals) plus calculators: Emergency Fund, Break-Even Point, Startup Cost, Cash Flow Projector, Loan, Pricing, ROI, Employee vs Contractor, Profit Margin.
- Budgeting tab: My Budget (income/expenses by hand, CSV statement import, or a connected bank that syncs on its own), Subscriptions (detected bills with charge reminders), Budget Analysis (AI budget review with follow-up chat), Goals (saving, spending, income goals with percent alerts), History (monthly snapshots).
- Investing tab: a search bar at the top of the page finds any stock or ETF by name or ticker; Discover (market card, movers, news, ETFs page, sector categories, Trade Tracker following notable investors and insiders); stock pages (live chart with candlesticks and scales, key stats explained, ten years of financials, earnings, analyst views, news); Screener for filtering the whole market; Watchlist; Portfolio (connect a brokerage through SnapTrade to see live holdings; buying and selling works where the brokerage allows it; Investing Goals including Mix goals that cap a slice of the portfolio; Portfolio Analysis with diversification, performance, sectors, dividends and a tax view).
- Taxes tab: a guided federal tax ESTIMATOR for the current tax year with a live refund estimate. It does not file returns; say so if asked about filing.
- Education tab: short videos and articles on credit, investing, budgeting, retirement, taxes.
- Plans: Budgeting Plus, Investing Plus, and FinnaCalc Pro subscriptions, managed from the Account screen.

Routing rules:
- Point to a place ONLY when the user is looking for something, wants to try something, or asks a question one of these tools genuinely answers. At most one pointer, woven in naturally ("that lives in Investing → Screener") or as a final "Go here:" line. Most answers need no pointer at all; never end every message with one.
- To look up a specific stock: the search bar at the top of the Investing tab, not the Screener. The Screener filters the whole market by criteria.
- Never claim a specific ticker, fund, or data point exists in the app; say where to check instead.
- You are sometimes embedded INSIDE a feature (for example the chat at the bottom of Portfolio Analysis, or Budget Analysis). Never tell the user to go to the screen they are already on. If the surrounding context is a portfolio or budget, answer about it directly.

Voice and formatting:
- Warm, direct, plainspoken. Answer first, context after. No filler openers.
- Short paragraphs (1-3 sentences). Markdown: **bold** the key figure or term, hyphen bullets for options or steps. No headings unless the answer is genuinely long.
- Keep answers tight (2-6 sentences unless asked for depth).

You are not a licensed financial or tax advisor and FinnaCalc never promises returns. Don't repeat disclaimers every reply; suggest a professional only for genuinely personal, high-stakes decisions (large investments, tax filing positions, debt restructuring).`;

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
        let failure: unknown = null;

        const result = streamText({
            // gemini-2.5-flash went paid-only Apr 2026; gemini-3.5-flash is the
            // current free-tier flash model. Free-tier limits are applied PER
            // PROJECT, not per key or per user (Google's rate-limit docs), so
            // every reader of the app draws on one shared allowance and the
            // ceiling arrives sooner than the numbers suggest.
            model: google("gemini-3.5-flash"),
            system: SYSTEM_PROMPT,
            messages,
            temperature: 0.7,
            onError: ({ error }) => {
                console.error("[/api/chat] streamText error:", error);
                failure = error;
            },
        });

        // NOT toTextStreamResponse(). It ends the stream silently when the
        // model errors, so a quota refusal reached the app as a 200 with an
        // empty body, and the app's only possible reading of that was "No
        // response received. Please try again." — which describes nothing and
        // is what an outage looked like from the outside.
        //
        // Written out by hand instead so a failure that produced no text can
        // say what happened. Anything already streamed is left alone: half an
        // answer plus an explanation beats half an answer plus silence.
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                let wrote = false;
                try {
                    for await (const chunk of result.textStream) {
                        if (chunk.length > 0) wrote = true;
                        controller.enqueue(encoder.encode(chunk));
                    }
                } catch (err) {
                    console.error("[/api/chat] stream aborted:", err);
                    failure = failure ?? err;
                }
                if (!wrote) {
                    controller.enqueue(encoder.encode(explain(failure)));
                }
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
            },
        });
    } catch (err: any) {
        return new Response(err?.message ?? "Failed to generate a response.", { status: 500 });
    }
}

/**
 * What to say when the model produced nothing.
 *
 * Plain text on purpose: the app renders this stream straight into the chat
 * bubble, so whatever is written here is what the reader sees. It names the
 * likely cause without naming a provider, a quota or an environment variable,
 * none of which mean anything to somebody asking about their budget.
 */
function explain(failure: unknown): string {
    const text = String(
        (failure as { message?: string } | null)?.message ?? failure ?? ""
    ).toLowerCase();

    // Google returns 429 RESOURCE_EXHAUSTED when the project's shared free-tier
    // allowance is spent. It is the most common way this endpoint fails and the
    // only one where waiting genuinely helps.
    if (
        text.includes("429") ||
        text.includes("resource_exhausted") ||
        text.includes("quota") ||
        text.includes("rate limit")
    ) {
        return "FinnaBot is handling a lot of questions right now and has reached its limit for the moment. Try again in a minute.";
    }
    if (text.includes("api key") || text.includes("permission") || text.includes("401") || text.includes("403")) {
        return "FinnaBot is not available right now. This is our end, not yours, and we can see it.";
    }
    return "FinnaBot could not answer that just now. Try asking again.";
}
