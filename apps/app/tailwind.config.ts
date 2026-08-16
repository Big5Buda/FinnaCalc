import type { Config } from "tailwindcss";
import { sharedPreset } from "@finnacalc/shared/tailwind-preset";

/*
 * Colours, radii and fonts come from the shared preset (the iOS app's Theme
 * tokens), so this app and the marketing site can't drift apart. What stays
 * here is what only this app uses: its content globs, keyframes and plugins.
 */
const config: Config = {
	presets: [sharedPreset as Config],
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
		"*.{js,ts,jsx,tsx,mdx}"
	],
	theme: {
		extend: {
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-up': {
					from: { opacity: '0', transform: 'translateY(6px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-up': 'fade-up 0.25s ease-out both'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
};
export default config;
