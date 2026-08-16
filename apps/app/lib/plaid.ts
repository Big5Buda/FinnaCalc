import { Configuration, PlaidApi, PlaidEnvironments } from "plaid"

/**
 * Server-side Plaid client.
 *
 * Required environment variables:
 *   PLAID_CLIENT_ID  – from the Plaid dashboard
 *   PLAID_SECRET     – the secret for the chosen environment
 *   PLAID_ENV        – "sandbox" (default) or "production"
 *
 * In Sandbox, connect with username `user_good` / password `pass_good`
 * and pick an institution that supports Investments (e.g. "First Platypus Bank").
 */

export const PLAID_ENV = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments

export function isPlaidConfigured() {
    return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
}

let cached: PlaidApi | null = null

export function getPlaidClient(): PlaidApi {
    if (cached) return cached
    const configuration = new Configuration({
        basePath: PlaidEnvironments[PLAID_ENV] ?? PlaidEnvironments.sandbox,
        baseOptions: {
            headers: {
                "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
                "PLAID-SECRET": process.env.PLAID_SECRET,
            },
        },
    })
    cached = new PlaidApi(configuration)
    return cached
}
