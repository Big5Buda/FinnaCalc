import Link from "next/link"
import { loginUrl } from "@/lib/app-url"
import { Pill } from "@/components/site"

/**
 * The 404. Worth having explicitly: app paths moved to the subdomain, so the
 * likeliest way to land here is an old link the middleware didn't match, and
 * a dead end with no route onward is the wrong answer to that.
 */
export default function NotFound() {
    return (
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 pb-24 pt-40 text-center">
            <p className="figure text-sm font-medium text-ink-muted">404</p>
            <h1 className="headline-serif text-[clamp(2.25rem,5vw,3.5rem)] text-ink">
                That page isn&rsquo;t here.
            </h1>
            <p className="max-w-md text-lg text-ink-soft">
                It may have moved to the app, where your budget, portfolio and calculators live.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
                <Pill href="/">Back to the homepage</Pill>
                <Pill href={loginUrl()} tone="outline">
                    Log in
                </Pill>
            </div>
        </section>
    )
}
