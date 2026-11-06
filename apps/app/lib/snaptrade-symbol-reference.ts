import { getSnapTrade, snapTradeKeyNamespace } from "./snaptrade"

const SYMBOLS = ["AAPL", "SPY"] as const
const TTL = 60 * 60 * 1000
export type PublicSymbolReference = { symbol: "AAPL" | "SPY"; currency: string; type: "cs" | "et";
    exchange: string; mic: string | null }
// SDK instances are cached by verified server credential identity for the life
// of this deployment. WeakMap keys never appear in logs or response data. Only
// public fixed-symbol metadata is cached, never user/account/readiness data.
const cache = new WeakMap<object, { expires: number; value: Promise<PublicSymbolReference[] | null> }>()

export async function publicSymbolReference(clientId: string): Promise<PublicSymbolReference[] | null> {
    try {
        snapTradeKeyNamespace(clientId) // Reject missing/conflicting/unowned slots.
        const client = getSnapTrade({ clientId })
        const now = Date.now(), existing = cache.get(client)
        if (existing && existing.expires > now) return await existing.value
        const value = Promise.all(SYMBOLS.map(async symbol => {
            const { data } = await client.referenceData.getSymbolsByTicker({ query: symbol }, { timeout: 3000 })
            if (data?.symbol !== symbol || !/^[A-Z]{3}$/.test(data.currency?.code ?? "")
                || !["cs", "et"].includes(data.type?.code ?? "")
                || !/^[A-Z0-9]{2,12}$/.test(data.exchange?.code ?? "")
                || (data.exchange?.mic_code != null && !/^[A-Z0-9]{4}$/.test(data.exchange.mic_code)))
                throw new Error("Public reference metadata unavailable")
            return { symbol, currency: data.currency!.code!, type: data.type!.code! as "cs" | "et",
                exchange: data.exchange!.code!, mic: data.exchange!.mic_code ?? null }
        })).catch(() => null)
        // Coalesce concurrent opens and cache failed reads too: no repeated
        // billed lookups or private calls when reference service is unavailable.
        cache.set(client, { expires: now + TTL, value })
        return await value
    } catch { return null }
}
