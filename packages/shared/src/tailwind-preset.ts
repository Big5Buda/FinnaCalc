import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"

/**
 * The shared Tailwind preset: the FinnaCalc design tokens (the iOS app's
 * Theme.swift values) plus the colour, radius and font mappings that read them.
 *
 * Both apps extend this rather than restating the palette, so the marketing
 * site on the root domain and the application on its subdomain are the same
 * brand by construction. Tokens are injected as base styles instead of being
 * imported as CSS across package boundaries, which Next's pipeline resolves
 * inconsistently.
 *
 * Channels are space-separated RGB so Tailwind's `/alpha` modifiers work
 * (`bg-primary/10`). Light is the default; `.dark` on <html> swaps the values.
 */

const LIGHT: Record<string, string> = {
    "--background": "255 255 255",
    "--surface-sunken": "248 250 252",
    "--card": "255 255 255",
    "--card-foreground": "2 8 23",
    "--popover": "255 255 255",
    "--popover-foreground": "2 8 23",
    "--foreground": "2 8 23",
    "--text-body": "51 65 85",
    "--muted-foreground": "100 116 139",
    "--primary": "37 99 235",
    "--primary-foreground": "248 250 252",
    "--brand-blue": "0 94 255",
    "--brand-hover": "29 78 216",
    "--brand-press": "30 64 175",
    "--secondary": "241 245 249",
    "--secondary-foreground": "2 8 23",
    "--muted": "241 245 249",
    "--accent": "241 245 249",
    "--accent-foreground": "2 8 23",
    "--destructive": "220 38 38",
    "--destructive-foreground": "255 255 255",
    "--positive": "22 163 74",
    "--negative": "220 38 38",
    "--caution": "245 158 11",
    "--accent-purple": "147 51 234",
    "--accent-orange": "234 88 12",
    "--primary-soft": "232 241 254",
    "--border": "226 232 240",
    "--border-strong": "203 213 225",
    "--input": "226 232 240",
    "--ring": "37 99 235",
    "--radius": "0.75rem",
}

const DARK: Record<string, string> = {
    "--background": "0 0 0",
    "--surface-sunken": "0 0 0",
    "--card": "15 23 42",
    "--card-foreground": "248 250 252",
    "--popover": "15 23 42",
    "--popover-foreground": "248 250 252",
    "--foreground": "248 250 252",
    "--text-body": "203 213 225",
    "--muted-foreground": "148 163 184",
    "--primary": "59 130 246",
    "--primary-foreground": "2 8 23",
    "--brand-blue": "46 125 255",
    "--brand-hover": "37 99 235",
    "--brand-press": "29 78 216",
    "--secondary": "30 41 59",
    "--secondary-foreground": "248 250 252",
    "--muted": "30 41 59",
    "--accent": "30 41 59",
    "--accent-foreground": "248 250 252",
    "--destructive": "239 68 68",
    "--destructive-foreground": "255 255 255",
    "--positive": "74 222 128",
    "--negative": "239 68 68",
    "--caution": "245 158 11",
    "--accent-purple": "192 132 252",
    "--accent-orange": "251 146 60",
    "--primary-soft": "24 38 58",
    "--border": "30 41 59",
    "--border-strong": "51 65 85",
    "--input": "30 41 59",
    "--ring": "59 130 246",
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
        // Figures are tabular and semibold everywhere, matching Theme.figure.
        ".figure": { fontVariantNumeric: "tabular-nums", fontWeight: "600" },
    })
})

export const sharedPreset: Partial<Config> = {
    darkMode: ["class"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-ibm-plex-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
                mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
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
                sm: "8px",
                md: "10px",
                lg: "12px",
                xl: "16px",
                "2xl": "20px",
                card: "22px",
            },
        },
    },
    plugins: [tokensPlugin],
}

export default sharedPreset
