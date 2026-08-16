import Link from "next/link"
import { appUrl } from "@/lib/app-url"
import { Button } from "@/components/ui"

/**
 * The 404. Worth having explicitly: app paths moved to the subdomain, so the
 * likeliest way to land here is an old link the middleware didn't match, and
 * a dead end with no route onward is the wrong answer to that.
 */
export default function NotFound() {
    return (
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">404</p>
            <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
                That page isn&rsquo;t here.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
                It may have moved to the app, where your budget, portfolio and calculators live.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
                <Link href="/">
                    <Button>Back to the homepage</Button>
                </Link>
                <a href={appUrl("/")}>
                    <Button variant="outline">Open the app</Button>
                </a>
            </div>
        </section>
    )
}
