import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"

/**
 * The web application's Tailwind preset: the iOS app's Theme.swift palette,
 * token for token, so the website and the phone read as the same product.
 *
 * For a month this carried a warm ink-and-cream system measured off
 * wealthsimple.com. The owner asked for the app's colours back: the blue
 * that had been the brand since the first commit, white pages in light mode,
 * slate in dark. The ink system also made `primary` black in light mode and
 * WHITE in dark, which is how FinnaBot's blue button came to render as a
 * white disc.
 *
 * Every value below is a hex from Core/DesignSystem/Theme.swift in the iOS
 * repo, written as space-separated RGB so Tailwind's `/alpha` modifiers work
 * (`bg-primary/10`). Semantic names are unchanged, so no screen had to be
 * touched. Light is the default; `.dark` on <html> swaps the values.
 */

const LIGHT: Record<string, string> = {
    "--background": "255 255 255",      // white: surface-page
    "--surface-sunken": "248 250 252",  // slate50
    "--card": "255 255 255",            // white: surface-card
    "--card-foreground": "2 8 23",      // ink #020817
    "--popover": "255 255 255",
    "--popover-foreground": "2 8 23",
    "--foreground": "2 8 23",           // text-strong
    "--text-body": "51 65 85",          // slate700
    "--muted-foreground": "100 116 139",// slate500
    "--primary": "37 99 235",           // blue600: the brand
    "--primary-foreground": "248 250 252",
    "--brand-blue": "37 99 235",
    "--brand-hover": "29 78 216",       // blue700
    "--brand-press": "30 64 175",       // blue800
    "--secondary": "241 245 249",       // slate100: surface-muted
    "--secondary-foreground": "2 8 23",
    "--muted": "241 245 249",
    "--accent": "241 245 249",
    "--accent-foreground": "2 8 23",
    "--destructive": "220 38 38",       // red600
    "--destructive-foreground": "248 250 252",
    "--positive": "22 163 74",          // green600
    "--negative": "220 38 38",
    "--caution": "245 158 11",          // amber500
    "--accent-purple": "112 72 232",    // the section hues, kept for charts
    "--accent-orange": "240 140 0",
    "--primary-soft": "219 234 254",    // blue100
    "--border": "226 232 240",          // slate200
    "--border-strong": "203 213 225",   // slate300
    "--input": "226 232 240",
    "--ring": "37 99 235",
    "--radius": "0.75rem",
}

const DARK: Record<string, string> = {
    "--background": "0 0 0",            // black: surface-page
    "--surface-sunken": "0 0 0",
    "--card": "15 23 42",               // slate900
    "--card-foreground": "248 250 252", // slate50
    "--popover": "15 23 42",
    "--popover-foreground": "248 250 252",
    "--foreground": "248 250 252",
    "--text-body": "203 213 225",       // slate300
    "--muted-foreground": "148 163 184",// slate400
    "--primary": "59 130 246",          // blue500
    "--primary-foreground": "2 8 23",
    "--brand-blue": "59 130 246",
    "--brand-hover": "37 99 235",       // blue600
    "--brand-press": "29 78 216",       // blue700
    "--secondary": "30 41 59",          // slate800
    "--secondary-foreground": "248 250 252",
    "--muted": "30 41 59",
    "--accent": "30 41 59",
    "--accent-foreground": "248 250 252",
    "--destructive": "239 68 68",       // red500
    "--destructive-foreground": "2 8 23",
    "--positive": "34 197 94",          // green500
    "--negative": "239 68 68",
    "--caution": "245 158 11",
    "--accent-purple": "167 139 250",
    "--accent-orange": "251 146 60",
    "--primary-soft": "30 58 138",      // blue900
    "--border": "30 41 59",             // slate800
    "--border-strong": "51 65 85",      // slate700
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
