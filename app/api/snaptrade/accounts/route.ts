import { NextRequest, NextResponse } from "next/server"
import { clearLegacySnapTradeCookie, getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

export interface BrokerageAccount {
    id: string
    name: string
    institution: string
    number: string
    totalValue: number | null
    /** Available cash in the account's currency (buying power for the order ticket). */
    cash: number | null
    currency: string
}

export interface BrokeragePosition {
    accountId: string
    symbol: string
    description: string
    units: number
    price: number | null
    marketValue: number | null
    openPnl: number | null
}

function round2(n: number) {
    return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ configured: false, accounts: [], positions: [] })
    }

    // Brokerage data requires a signed-in FinnaCalc user — credentials live
    // server-side keyed to the Supabase user (lib/snaptrade-session.ts).
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to view your brokerage." }, { status: 401 })
    }
    try {
        const session = await loadSession(appUserId)
        if (!session) {
            const res = NextResponse.json({ configured: true, connected: false, accounts: [], positions: [] })
            clearLegacySnapTradeCookie(res)
            return res
        }
        const st = getSnapTrade()

        // getAllUserHoldings is deprecated and returns HTTP 410 Gone ("this
        // endpoint is no longer available for your account") for every account
        // created after 2026-04-25. Replaced by listUserAccounts plus a
        // per-account getUserHoldings fetch (the account-specific endpoint).
        const { data: accountData } = await st.accountInformation.listUserAccounts({
            userId: session.userId,
            userSecret: session.userSecret,
        })
        const accountList = Array.isArray(accountData) ? accountData : []

        // Positions and cash balances come from the per-account holdings
        // endpoint. Fetch all accounts in parallel; a single failing account
        // shouldn't blank the rest.
        const holdingsByAccount = await Promise.all(
            accountList.map(async (a: any) => {
                try {
                    const { data } = await st.accountInformation.getUserHoldings({
                        accountId: a.id,
                        userId: session.userId,
                        userSecret: session.userSecret,
                    })
                    return {
                        accountId: a.id ?? "",
                        positions: data?.positions ?? [],
                        balances: data?.balances ?? [],
                    }
                } catch {
                    return { accountId: a.id ?? "", positions: [], balances: [] }
                }
            })
        )

        // Available cash in the account's own currency — the order ticket's
        // "buying power" line. Multi-currency accounts may hold several cash
        // balances; take the one matching the account currency.
        const cashByAccount = new Map<string, number | null>(
            holdingsByAccount.map(({ accountId, balances }) => {
                const accountCurrency = accountList.find((a: any) => a.id === accountId)?.balance?.total
                    ?.currency
                const match = (balances as any[]).find(
                    (b: any) => b?.currency?.code === accountCurrency || accountCurrency == null
                )
                const cash = match?.cash ?? (balances as any[])[0]?.cash ?? null
                return [accountId, cash != null ? round2(cash) : null]
            })
        )

        const accounts: BrokerageAccount[] = accountList.map((a: any) => ({
            id: a.id ?? "",
            name: a.name ?? "Account",
            institution: a.institution_name ?? "Brokerage",
            number: a.number ?? "",
            totalValue: a.balance?.total?.amount != null ? round2(a.balance.total.amount) : null,
            cash: cashByAccount.get(a.id ?? "") ?? null,
            currency: a.balance?.total?.currency ?? "USD",
        }))

        const positions: BrokeragePosition[] = holdingsByAccount.flatMap(({ accountId, positions: accountPositions }) =>
            (accountPositions ?? []).map((p: any) => {
                const units = p.units ?? 0
                const price = p.price ?? null
                return {
                    accountId,
                    symbol:
                        p.symbol?.symbol?.symbol ??
                        p.symbol?.symbol?.raw_symbol ??
                        p.symbol?.description ??
                        "—",
                    description: p.symbol?.symbol?.description ?? p.symbol?.description ?? "",
                    units,
                    price: price != null ? round2(price) : null,
                    marketValue: price != null ? round2(units * price) : null,
                    openPnl: p.open_pnl != null ? round2(p.open_pnl) : null,
                }
            })
        )

        const currency = accounts[0]?.currency ?? "USD"
        const totalValue = round2(accounts.reduce((s, a) => s + (a.totalValue ?? 0), 0))

        const res = NextResponse.json({
            configured: true,
            connected: accounts.length > 0,
            accounts,
            positions,
            totalValue,
            currency,
        })
        clearLegacySnapTradeCookie(res)
        return res
    } catch (err: any) {
        const res = NextResponse.json(
            { configured: true, connected: false, accounts: [], positions: [], error: snapTradeErrorMessage(err, "Failed to load brokerage accounts.") },
            { status: 500 }
        )
        clearLegacySnapTradeCookie(res)
        return res
    }
}
