import type { Config } from "tailwindcss"
import { sharedPreset } from "@finnacalc/shared/tailwind-preset"

/*
 * The marketing site renders the same brand as the app: colours, radii and
 * fonts all come from the shared preset (the iOS app's Theme tokens). What
 * this file adds is only what the landing page needs on top.
 */
const config: Config = {
    presets: [sharedPreset as Config],
    darkMode: ["class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            keyframes: {
                "fade-up": {
                    from: { opacity: "0", transform: "translateY(8px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
            },
            animation: {
                "fade-up": "fade-up 0.4s ease-out both",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

export default config
