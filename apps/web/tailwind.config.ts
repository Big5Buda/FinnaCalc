import type { Config } from "tailwindcss"

/*
 * The marketing site's own theme — deliberately NOT the shared preset.
 *
 * packages/shared carries the app's Paper & Cobalt tokens, which mirror the iOS
 * app's Theme.swift. The public site runs the warm-light system measured off
 * wealthsimple.com (see CLAUDE.md); extending the shared preset here would drag
 * IBM Plex and the app palette into a site that must not have them.
 *
 * Colour values live in app/globals.css as CSS variables. This file only names
 * them.
 */
const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                // Brand moments: the hero line, the manifesto, the footer
                // wordmark. Serves the Tiempos role until the licence lands.
                serif: ["var(--font-serif)", "Lucida", "Georgia", "serif"],
                // Everything else — product headlines included. Serves The
                // Future role until the licence lands.
                sans: ["var(--font-sans)", "system-ui", "Helvetica Neue", "sans-serif"],
            },
            colors: {
                // The names the design system is written in.
                paper: "rgb(var(--paper) / <alpha-value>)",
                chip: "rgb(var(--chip) / <alpha-value>)",
                ink: {
                    DEFAULT: "rgb(var(--ink) / <alpha-value>)",
                    soft: "rgb(var(--ink-soft) / <alpha-value>)",
                    muted: "rgb(var(--ink-muted) / <alpha-value>)",
                },
                line: {
                    DEFAULT: "rgb(var(--line) / <alpha-value>)",
                    strong: "rgb(var(--line-strong) / <alpha-value>)",
                },
                celery: "rgb(var(--celery) / <alpha-value>)",
                terracotta: "rgb(var(--terracotta) / <alpha-value>)",
                section: {
                    budgeting: "rgb(var(--sec-budgeting) / <alpha-value>)",
                    investing: "rgb(var(--sec-investing) / <alpha-value>)",
                    taxes: "rgb(var(--sec-taxes) / <alpha-value>)",
                    education: "rgb(var(--sec-education) / <alpha-value>)",
                },

                // shadcn aliases over the same variables.
                background: "rgb(var(--background) / <alpha-value>)",
                foreground: "rgb(var(--foreground) / <alpha-value>)",
                card: {
                    DEFAULT: "rgb(var(--card) / <alpha-value>)",
                    foreground: "rgb(var(--card-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "rgb(var(--popover) / <alpha-value>)",
                    foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
                },
                primary: {
                    DEFAULT: "rgb(var(--primary) / <alpha-value>)",
                    foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
                    foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "rgb(var(--muted) / <alpha-value>)",
                    foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "rgb(var(--accent) / <alpha-value>)",
                    foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
                    foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
                },
                border: "rgb(var(--border) / <alpha-value>)",
                input: "rgb(var(--input) / <alpha-value>)",
                ring: "rgb(var(--ring) / <alpha-value>)",
            },
            borderRadius: {
                // Their scale: small 4, normal 12, large 24, pill effectively ∞.
                sm: "0.25rem",
                md: "0.75rem",
                lg: "1.5rem",
                pill: "100rem",
            },
            transitionTimingFunction: {
                // The one easing the whole site runs on.
                ws: "cubic-bezier(0.241, 0.969, 0.635, 0.997)",
            },
            maxWidth: {
                // Their container.
                site: "1264px",
            },
        },
    },
    plugins: [],
}

export default config
