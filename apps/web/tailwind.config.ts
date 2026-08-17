import type { Config } from "tailwindcss"

/*
 * The marketing site's own theme — deliberately NOT the shared preset.
 *
 * packages/shared carries the app's Paper & Cobalt tokens, which mirror the iOS
 * app's Theme.swift. The public site runs its own dark system (see CLAUDE.md);
 * extending the shared preset here would drag light-mode values and IBM Plex
 * into a site that must not have them.
 *
 * Colour values live in app/globals.css as CSS variables. This file only names
 * them.
 */
const config: Config = {
    darkMode: ["class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                // Display and hero headlines only.
                display: ["var(--font-fraunces)", "Georgia", "serif"],
                // Everything else a person reads as prose or interface.
                sans: ["var(--font-bricolage)", "ui-sans-serif", "sans-serif"],
                // Numbers. Never prose.
                mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
            },
            colors: {
                // Brand names — how the design system is written down.
                canvas: "rgb(var(--background) / <alpha-value>)",
                surface: {
                    DEFAULT: "rgb(var(--surface) / <alpha-value>)",
                    elevated: "rgb(var(--surface-elevated) / <alpha-value>)",
                },
                mint: "rgb(var(--accent-mint) / <alpha-value>)",
                vermilion: "rgb(var(--accent-vermilion) / <alpha-value>)",
                ink: {
                    DEFAULT: "rgb(var(--ink) / <alpha-value>)",
                    muted: "rgb(var(--ink-muted) / <alpha-value>)",
                },
                line: {
                    DEFAULT: "rgb(var(--border-subtle) / <alpha-value>)",
                    strong: "rgb(var(--line-strong) / <alpha-value>)",
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
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                card: "22px",
            },
        },
    },
    plugins: [],
}

export default config
