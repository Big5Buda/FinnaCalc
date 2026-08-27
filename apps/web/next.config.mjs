/**
 * Marketing site config.
 *
 * The API proxy below is load-bearing: every installed copy of the iOS app
 * calls https://www.finnacalc.com/api/… (see APIConfig.baseURL in
 * Core/Networking/APIClient.swift), and those routes now live in apps/app on
 * the subdomain. Without this rewrite, the moment www starts serving this site
 * every API call from every shipped build 404s — quotes, budgets, chat,
 * billing, brokerage, all of it — and no App Store release can fix the copies
 * already installed.
 *
 * So www keeps answering /api/* by forwarding it to the app origin. A future
 * iOS build should point at app.finnacalc.com directly, but this has to keep
 * working for as long as old builds are in the wild.
 *
 * NOTE: rewrites are resolved when the site is BUILT, not per request, so
 * NEXT_PUBLIC_APP_ORIGIN has to be present in the build environment. Changing
 * it afterwards does nothing until the site is rebuilt — which is easy to
 * mistake for the proxy being broken.
 */

const PRODUCTION_DEFAULT = "https://app.finnacalc.com"
const DEVELOPMENT_DEFAULT = "http://localhost:3001"

/**
 * The same normalisation as lib/app-url.ts, restated because a config file
 * can't import the app's TypeScript. Kept deliberately identical: a blank or
 * protocol-less value here would produce an invalid rewrite destination, which
 * fails the build the same way #100 did.
 */
function appOrigin() {
    const raw = typeof process.env.NEXT_PUBLIC_APP_ORIGIN === "string"
        ? process.env.NEXT_PUBLIC_APP_ORIGIN.trim()
        : ""
    const fallback = process.env.NODE_ENV === "production" ? PRODUCTION_DEFAULT : DEVELOPMENT_DEFAULT
    if (raw === "") return fallback

    const withProtocol = /^https?:\/\//i.test(raw)
        ? raw
        : `${/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(raw) ? "http" : "https"}://${raw}`

    try {
        const url = new URL(withProtocol)
        return url.hostname ? url.origin : fallback
    } catch {
        return fallback
    }
}

/**
 * Paths that used to be served by www and are now on the app origin.
 *
 * Two waves of moves stranded these:
 *
 *   1. The 2024 site had a page per calculator at /loan-calculator and friends.
 *      #52 removed the whole web frontend for the mobile pivot and they've
 *      404'd ever since. When the calculators came back they came back under
 *      /calculators/<slug>, so the old URLs never found their way home.
 *   2. #99 split the monorepo and moved every application route to
 *      app.finnacalc.com. From that deploy onward, www/budgeting, www/investing
 *      and the rest 404 too — including anything a reader had bookmarked the
 *      week before.
 *
 * `permanent` is a real decision rather than a default. The application routes
 * live on the subdomain by design and are never coming back to www, so they get
 * a 308. The company pages are marked temporary: www is the marketing site and
 * may well want its own /about or /privacy later, and a 308 that browsers have
 * already cached is very hard to take back.
 *
 * /advising has no destination — that service no longer exists — so it stays a
 * 404. Redirecting it somewhere plausible would be worse than the 404.
 */
const CALCULATOR_SLUGS = {
    "break-even-calculator": "break-even",
    "cash-flow-calculator": "cash-flow",
    "emergency-fund-calculator": "emergency-fund",
    "employee-contractor-calculator": "employee-contractor",
    "loan-calculator": "loan",
    "pricing-calculator": "pricing",
    "profit-margin-calculator": "profit-margin",
    "roi-calculator": "roi",
    "startup-cost-calculator": "startup-cost",
}

/**
 * Account-shaped paths that only make sense signed in; these forward to the
 * app. The five product sections (calculators, budgeting, investing, taxes,
 * education) are deliberately NOT here any more — this site serves its own
 * pages for them, with the calculators fully working and un-gated.
 */
const APPLICATION_PATHS = ["account", "auth", "billing", "sign-in", "sign-up"]

/** Also on the subdomain today, but www has a fair claim to them later. */
const COMPANY_PATHS = ["about", "plans", "privacy", "terms"]

function movedRoutes(origin) {
    return [
        // The 2024 per-calculator pages, now served by this site un-gated.
        ...Object.entries(CALCULATOR_SLUGS).map(([from, slug]) => ({
            source: `/${from}`,
            destination: `/calculators/${slug}`,
            permanent: true,
        })),
        // /tax-calculator was a full return estimator, not one of the small
        // calculators, so it lands on the taxes section rather than in the list.
        { source: "/tax-calculator", destination: "/taxes", permanent: true },
        // /premium became /plans when billing moved to Stripe.
        { source: "/premium", destination: `${origin}/plans`, permanent: true },
        // /investing/safe-investments ranked three hand-picked instruments as
        // the "safest", with app-assigned risk grades and unsourced average
        // returns. /investing/cash-options is its successor: same subject,
        // described by instrument class with nothing named or ranked.
        { source: "/investing/safe-investments", destination: "/investing/cash-options", permanent: true },

        // Both the section index and everything under it.
        ...APPLICATION_PATHS.flatMap((path) => [
            { source: `/${path}`, destination: `${origin}/${path}`, permanent: true },
            { source: `/${path}/:rest*`, destination: `${origin}/${path}/:rest*`, permanent: true },
        ]),
        ...COMPANY_PATHS.flatMap((path) => [
            { source: `/${path}`, destination: `${origin}/${path}`, permanent: false },
            { source: `/${path}/:rest*`, destination: `${origin}/${path}/:rest*`, permanent: false },
        ]),
    ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    // The shared package ships TypeScript source rather than a build step.
    transpilePackages: ["@finnacalc/shared"],
    eslint: { ignoreDuringBuilds: true },
    images: { unoptimized: true },

    /**
     * Next evaluates redirects BEFORE beforeFiles rewrites, so nothing here may
     * match /api/* or it would shadow the iOS lifeline proxy below. Nothing
     * does — but that's the constraint to check before adding a rule.
     *
     * Destinations are absolute and resolved at BUILD time, exactly like the
     * rewrite: same NEXT_PUBLIC_APP_ORIGIN, same need to rebuild after changing
     * it.
     */
    async redirects() {
        return movedRoutes(appOrigin())
    },

    async rewrites() {
        const origin = appOrigin()
        return {
            // beforeFiles: this must win before anything else on the site tries
            // to answer /api, and before the 404 does.
            beforeFiles: [
                {
                    source: "/api/:path*",
                    destination: `${origin}/api/:path*`,
                },
            ],
        }
    },
}

export default nextConfig
