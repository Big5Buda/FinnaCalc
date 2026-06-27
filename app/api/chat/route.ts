import { streamText } from "ai";
import { google } from "@ai-sdk/google";

const SYSTEM_PROMPT = `You are FinnaBot, a friendly and knowledgeable AI assistant for FinnaCalc, a financial calculators and personal finance planning website.

Help users with:
- Personal finance (budgeting, saving, emergency funds, debt payoff)
- Small business finance (break-even, startup costs, pricing, cash flow)
- Investing basics (stocks, bonds, ROI, risk)
- Taxes (general concepts, not specific legal/tax advice)
- Using FinnaCalc's calculators

Keep answers concise, practical, and actionable. When relevant, point users to a calculator on the site (e.g., "Try the Loan Calculator at /loan-calculator"). Always clarify that you are not a licensed financial or tax advisor and users should consult a professional for personalized advice.`;

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
