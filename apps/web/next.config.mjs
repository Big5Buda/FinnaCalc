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

/** @type {import('next').NextConfig} */
const nextConfig = {
    // The shared package ships TypeScript source rather than a build step.
    transpilePackages: ["@finnacalc/shared"],
    eslint: { ignoreDuringBuilds: true },
    images: { unoptimized: true },

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
