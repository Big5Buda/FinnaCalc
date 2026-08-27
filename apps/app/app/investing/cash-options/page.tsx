import type { Metadata } from "next"
import Link from "next/link"
import { Landmark } from "lucide-react"
import { Card, CardContent, Notice, SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

export const metadata: Metadata = {
    title: "Where cash sits",
    description:
        "The places money can sit when it is not buying securities: what each one is, who stands behind it, and when you can get it back.",
}

/**
 * Replaces /investing/safe-investments, which was retired rather than moved.
 *
 * The old page named three instruments, called them the safest, gave each a
 * risk grade the app invented and an average return with no source or date,
 * under the heading "Top safest investments with consistent returns". The
 * selection was the advice: no notice underneath changes which three things
 * the app chose to put on screen.
 *
 * This page is built to be the thing that page pretended to be, under rules
 * that keep it descriptive:
 *
 *   1. INSTRUMENT CLASSES, NEVER PRODUCTS. No ticker, no issuer, no bank, no
 *      fund is named. There is nothing here to pick, so there is nothing here
 *      being picked for the reader.
 *   2. NO RATES AND NO RETURNS. Every yield on this page would be stale within
 *      a week, unsourced, and read as a forecast. What is stated instead is
 *      how each rate is SET, which does not expire.
 *   3. NO RANKING AND NO ORDER OF MERIT. The options run from most liquid to
 *      longest term, which is a property, not a preference.
 *   4. TERM STRUCTURE, NOT SUITABILITY. "Money you need in six months belongs
 *      in X" is advice about this reader. "A CD is locked for its term and
 *      leaving early costs a penalty the bank sets" is a fact about a CD. The
 *      access table states the mechanics and lets the reader map their own
 *      timeline; the page never asks what theirs is.
 *
 * Everything factual here is statutory or structural — insurance limits and
 * their per-category basis, what SIPC does and does not cover, Treasury terms
 * and their state-tax treatment, the fact that a money market FUND is not a
 * deposit. Those do not move with the market. If a figure on this page ever
 * needs a date next to it, it does not belong on this page.
 */
export default function CashOptionsPage() {
    return (
        <>
            <PageBar
                title={
                    <span className="flex items-center gap-2">
                        <Link href="/investing" className="text-muted-foreground hover:text-foreground">
                            Investing
                        </Link>
                        <span className="text-border-strong">/</span>
                        Where cash sits
                    </span>
                }
            />
            <PageBody className="flex w-full max-w-4xl flex-col gap-6">
                <header className="flex flex-col gap-2">
                    <p className="text-base text-foreground">
                        Money that is not buying securities still has to sit somewhere. These are the
                        common places it sits, what each one actually is, who stands behind it, and when
                        you can get it back.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        This page names no bank, fund or issuer and quotes no rate. It describes how each
                        kind of account or security works so you can compare the ones you find. Which of
                        them suits you is not a question FinnaCalc answers.
                    </p>
                </header>

                <section className="flex flex-col gap-3">
                    <SectionLabel>The options</SectionLabel>
                    <p className="text-sm text-muted-foreground">
                        Ordered from the one you can reach fastest to the one that ties money up longest.
                        That is a property of each, not a ranking.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        {OPTIONS.map((option, index) => (
                            <div
                                key={option.name}
                                className={index > 0 ? "border-t border-border p-4" : "p-4"}
                            >
                                <p className="text-sm font-semibold text-foreground">{option.name}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{option.what}</p>
                                <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                                    <Fact label="Backed by" value={option.backing} />
                                    <Fact label="Rate is set by" value={option.rate} />
                                    <Fact label="Getting at it" value={option.access} />
                                    <Fact label="Worth knowing" value={option.catch} />
                                </dl>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <SectionLabel>What insurance actually covers</SectionLabel>
                    <p className="text-sm text-muted-foreground">
                        Three different schemes get called &ldquo;insured&rdquo; and they protect against
                        different things. Only the first two are deposit insurance.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {INSURANCE.map((scheme) => (
                            <Card key={scheme.name}>
                                <CardContent className="flex flex-col gap-2 pt-5">
                                    <p className="text-sm font-semibold text-foreground">{scheme.name}</p>
                                    <p className="figure text-sm text-foreground">{scheme.limit}</p>
                                    <p className="text-xs text-muted-foreground">{scheme.covers}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Notice tone="info">
                        <span className="flex items-start gap-2">
                            <Landmark className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                All three limits are per person, per institution, and{" "}
                                <strong>per ownership category</strong> — an individual account and a
                                joint account at the same bank are insured separately. Balances above a
                                limit are not covered, and no scheme of any kind covers an investment
                                that simply falls in value.
                            </span>
                        </span>
                    </Notice>
                </section>

                <section className="flex flex-col gap-3">
                    <SectionLabel>Terms and access</SectionLabel>
                    <p className="text-sm text-muted-foreground">
                        The practical difference between these is when you can have the money back and
                        what leaving early costs. Match that against your own timeline — the page does
                        not know it.
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-border bg-card">
                        <table className="w-full min-w-[34rem] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="p-3 text-xs font-semibold text-muted-foreground">
                                        Option
                                    </th>
                                    <th className="p-3 text-xs font-semibold text-muted-foreground">
                                        Term
                                    </th>
                                    <th className="p-3 text-xs font-semibold text-muted-foreground">
                                        Leaving early
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ACCESS.map((row) => (
                                    <tr key={row.option} className="border-b border-border last:border-0">
                                        <td className="p-3 text-sm text-foreground">{row.option}</td>
                                        <td className="p-3 text-sm text-muted-foreground">{row.term}</td>
                                        <td className="p-3 text-sm text-muted-foreground">{row.exit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <Notice tone="caution">
                    Rates on every option here move, and they move at different speeds — a savings rate
                    can change any day, a CD or a Treasury fixes yours at purchase. Nothing on this page
                    is a recommendation to use any of these, and none of it is a forecast. Check the
                    current terms with the bank, credit union, fund or issuer before you commit money.
                </Notice>
            </PageBody>
        </>
    )
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd className="text-xs text-foreground">{value}</dd>
        </div>
    )
}

/**
 * Classes, not products. Each entry describes a structure anyone can verify
 * against the provider's own disclosures — no rate, no issuer, no ranking.
 */
const OPTIONS = [
    {
        name: "Savings and high-yield savings accounts",
        what: "A deposit account at a bank or credit union. High-yield is a marketing label, not a separate product type; the account works the same way.",
        backing: "FDIC or NCUA insurance, within the limits below",
        rate: "The bank, which can change it at any time without your agreement",
        access: "No fixed term — withdraw whenever, though some accounts cap the number of transfers per month",
        catch: "A rate quoted when you open the account is not a rate you keep",
    },
    {
        name: "Money market deposit accounts",
        what: "Also a bank deposit account, usually with a tiered rate and cheque or debit access. Despite the name, this is not a money market fund.",
        backing: "FDIC or NCUA insurance, within the limits below",
        rate: "The bank, often stepped by balance so the headline tier needs a large balance",
        access: "No fixed term, with transaction limits more often than a plain savings account",
        catch: "The similar name to a money market fund hides a real difference: this one is a deposit and that one is not",
    },
    {
        name: "Certificates of deposit",
        what: "A deposit you agree to leave for a fixed term, in exchange for a rate fixed for that term.",
        backing: "FDIC or NCUA insurance, within the limits below",
        rate: "Fixed when you buy it, for the length of the term",
        access: "Locked for the term — commonly a few months to five years",
        catch: "Taking the money out early costs a penalty the bank sets, often some months of interest",
    },
    {
        name: "Money market funds",
        what: "A mutual fund holding short-term debt, run under the SEC's Rule 2a-7. A security you buy, not money you deposit.",
        backing: "Nothing insures it. It is not a deposit and carries no FDIC or NCUA cover",
        rate: "The fund's holdings, net of its expense ratio; it changes continuously",
        access: "Sell any business day, though funds may apply liquidity fees in stressed conditions",
        catch: "The share price is designed to hold steady but is not guaranteed to, and a fund has broken it before",
    },
    {
        name: "Treasury bills, notes and bonds",
        what: "Debt issued by the US government, bought at auction or on the secondary market. Bills mature in a year or less, notes in two to ten years, bonds in twenty or thirty.",
        backing: "The full faith and credit of the US government — not deposit insurance, and no dollar cap",
        rate: "Set at auction and fixed for what you bought; the price of an existing one moves with rates",
        access: "Hold to maturity for the stated amount, or sell earlier at whatever the market pays that day",
        catch: "Interest is exempt from state and local income tax, though not federal. Selling before maturity can return less than you paid",
    },
]

/**
 * Statutory limits and what each scheme is actually for. SIPC is here because
 * it is routinely mistaken for deposit insurance and covers something else
 * entirely.
 */
const INSURANCE = [
    {
        name: "FDIC",
        limit: "$250,000",
        covers: "Deposits at an insured bank, per depositor, per bank, per ownership category. Pays out if the bank fails.",
    },
    {
        name: "NCUA",
        limit: "$250,000",
        covers: "The credit union equivalent, through the NCUSIF, on the same per-owner and per-category basis.",
    },
    {
        name: "SIPC",
        limit: "$500,000",
        covers: "Not deposit insurance. Replaces securities and cash missing if a brokerage fails, including up to $250,000 cash. It never covers a loss in value.",
    },
]

const ACCESS = [
    {
        option: "Savings / high-yield savings",
        term: "None",
        exit: "Nothing to leave — the rate can change instead",
    },
    {
        option: "Money market deposit account",
        term: "None",
        exit: "Nothing to leave; watch for per-month transaction limits",
    },
    {
        option: "Certificate of deposit",
        term: "Fixed, months to years",
        exit: "An early-withdrawal penalty set by the bank",
    },
    {
        option: "Money market fund",
        term: "None",
        exit: "Sell any business day; liquidity fees are possible under stress",
    },
    {
        option: "Treasury bill",
        term: "Four weeks to a year",
        exit: "Sell on the secondary market at that day's price",
    },
    {
        option: "Treasury note or bond",
        term: "Two to thirty years",
        exit: "Sell on the secondary market — the price moves with rates and can be below what you paid",
    },
]
