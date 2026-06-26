import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are FinnaBot, a friendly and knowledgeable AI assistant for FinnaCalc, a financial calculators and personal finance planning website.

Help users with:
- Personal finance (budgeting, saving, emergency funds, debt payoff)
- Small business finance (break-even, startup costs, pricing, cash flow)
- Investing basics (stocks, bonds, ROI, risk)
- Taxes (general concepts, not specific legal/tax advice)
- Using FinnaCalc's calculators

Keep answers concise, practical, and actionable. When relevant, point users to a calculator on the site (e.g., "Try the Loan Calculator at /loan-calculator"). Always clarify that you are not a licensed financial or tax advisor and users should consult a professional for personalized advice.`;

export async function POST(req: Request) {
    let body: { messages?: any[] };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "messages is required." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const result = streamText({
        model: google("gemini-2.0-flash"),
        system: SYSTEM_PROMPT,
        messages,
        temperature: 0.7,
    });

    return result.toDataStreamResponse();
}
