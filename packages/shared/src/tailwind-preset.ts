import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"

/**
 * The web application's Tailwind preset — the warm-light system measured off
 * wealthsimple.com, matching the marketing site so the walk from finnacalc.com
 * to app.finnacalc.com is one continuous product.
 *
 * This replaced the Paper & Cobalt palette (the iOS app's Theme.swift values)
 * in August 2026 at the user's direction. The iPhone app deliberately keeps its
 * blue theme, so web and phone now read as siblings rather than twins; see
 * CLAUDE.md. `apps/app` is this preset's only consumer — `apps/web` defines the
 * same tokens directly in its own config.
 *
 * Semantic names are kept (`primary`, `card`, `muted`) so ~35 existing screens
 * inherit the new system without touching their markup. What changed is what
 * each name resolves to.
 *
 * Channels are space-separated RGB so Tailwind's `/alpha` modifiers work
 * (`bg-primary/10`). Light is the default; `.dark` on <html> swaps the values.
 */

const LIGHT: Record<string, string> = {
    "--background": "245 243 239",      // #F5F3EF cream — the page
    "--surface-sunken": "241 240 240",  // #F1F0F0 a well below the page
    "--card": "252 252 252",            // #FCFCFC warm white — every surface
    "--card-foreground": "28 27 27",
    "--popover": "252 252 252",
    "--popover-foreground": "28 27 27",
    "--foreground": "28 27 27",         // #1C1B1B warm black, never #000
    "--text-body": "73 70 69",          // #494645
    "--muted-foreground": "104 102 100",// #686664
    "--primary": "28 27 27",            // the ink pill CTA
    "--primary-foreground": "252 252 252",
    "--brand-blue": "28 27 27",
    "--brand-hover": "73 70 69",
    "--brand-press": "50 48 47",
    "--secondary": "241 240 240",
    "--secondary-foreground": "28 27 27",
    "--muted": "241 240 240",
    "--accent": "241 240 240",
    "--accent-foreground": "28 27 27",
    "--destructive": "164 61 18",       // terracotta
    "--destructive-foreground": "252 252 252",
    "--positive": "72 102 53",          // celery
    "--negative": "164 61 18",
    "--caution": "238 227 177",
    "--accent-purple": "95 89 116",     // the section hues, kept for charts
    "--accent-orange": "86 76 71",
    "--primary-soft": "241 240 240",
    "--border": "228 226 225",          // #E4E2E1
    "--border-strong": "201 198 196",   // #C9C6C4
    "--input": "228 226 225",
    "--ring": "28 27 27",
    "--radius": "0.75rem",
}

const DARK: Record<string, string> = {
    "--background": "28 27 27",
    "--surface-sunken": "20 19 19",
    "--card": "50 48 47",
    "--card-foreground": "252 252 252",
    "--popover": "50 48 47",
    "--popover-foreground": "252 252 252",
    "--foreground": "252 252 252",
    "--text-body": "201 198 196",
    "--muted-foreground": "175 170 167",
    "--primary": "252 252 252",
    "--primary-foreground": "28 27 27",
    "--brand-blue": "252 252 252",
    "--brand-hover": "228 226 225",
    "--brand-press": "201 198 196",
    "--secondary": "73 70 69",
    "--secondary-foreground": "252 252 252",
    "--muted": "73 70 69",
    "--accent": "73 70 69",
    "--accent-foreground": "252 252 252",
    "--destructive": "255 138 113",
    "--destructive-foreground": "28 27 27",
    "--positive": "153 179 131",
    "--negative": "255 138 113",
    "--caution": "238 227 177",
    "--accent-purple": "179 171 188",
    "--accent-orange": "201 198 196",
    "--primary-soft": "73 70 69",
    "--border": "73 70 69",
    "--border-strong": "104 102 100",
    "--input": "73 70 69",
    "--ring": "252 252 252",
}

export const tokensPlugin = plugin(({ addBase }) => {
    addBase({
        ":root": LIGHT,
        ".dark": DARK,
        "*": { borderColor: "rgb(var(--border))" },
        body: {
            backgroundColor: "rgb(var(--background))",
            color: "rgb(var(--foreground))",
            WebkitFontSmoothing: "antialiased",
        },
        // Figures are tabular so columns of money line up; weight comes from
        // the element, not the class, since this system carries no mono face.
        ".figure": { fontVariantNumeric: "tabular-nums" },
    })
})

export const sharedPreset: Partial<Config> = {
    darkMode: ["class"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)", "system-ui", "Helvetica Neue", "sans-serif"],
                serif: ["var(--font-serif)", "Lucida", "Georgia", "serif"],
                // Figures are tabular in the body face now; there is no mono
                // face in this system (see .figure below).
                mono: ["var(--font-sans)", "system-ui", "sans-serif"],
            },
            colors: {
                background: "rgb(var(--background) / <alpha-value>)",
                sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
                foreground: "rgb(var(--foreground) / <alpha-value>)",
                body: "rgb(var(--text-body) / <alpha-value>)",
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
                    hover: "rgb(var(--brand-hover) / <alpha-value>)",
                    press: "rgb(var(--brand-press) / <alpha-value>)",
                    soft: "rgb(var(--primary-soft) / <alpha-value>)",
                },
                brand: "rgb(var(--brand-blue) / <alpha-value>)",
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
                    purple: "rgb(var(--accent-purple) / <alpha-value>)",
                    orange: "rgb(var(--accent-orange) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
                    foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
                },
                positive: "rgb(var(--positive) / <alpha-value>)",
                negative: "rgb(var(--negative) / <alpha-value>)",
                caution: "rgb(var(--caution) / <alpha-value>)",
                border: {
                    DEFAULT: "rgb(var(--border) / <alpha-value>)",
                    strong: "rgb(var(--border-strong) / <alpha-value>)",
                },
                input: "rgb(var(--input) / <alpha-value>)",
                ring: "rgb(var(--ring) / <alpha-value>)",
            },
            borderRadius: {
                sm: "4px",
                md: "12px",
                lg: "16px",
                xl: "20px",
                "2xl": "24px",
                card: "24px",
                pill: "100rem",
            },
        },
    },
    plugins: [tokensPlugin],
}

export default sharedPreset
