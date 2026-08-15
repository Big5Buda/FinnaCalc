import type { Config } from "tailwindcss";

/*
 * Colors resolve from the CSS custom properties in app/globals.css, which are
 * the iOS app's Theme tokens (Core/DesignSystem/Theme.swift). Channels are
 * space-separated RGB so `/alpha` modifiers keep working.
 */
const config: Config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"*.{js,ts,jsx,tsx,mdx}"
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ['var(--font-ibm-plex-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
			},
			colors: {
				background: 'rgb(var(--background) / <alpha-value>)',
				sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
				foreground: 'rgb(var(--foreground) / <alpha-value>)',
				body: 'rgb(var(--text-body) / <alpha-value>)',
				card: {
					DEFAULT: 'rgb(var(--card) / <alpha-value>)',
					foreground: 'rgb(var(--card-foreground) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
					foreground: 'rgb(var(--popover-foreground) / <alpha-value>)'
				},
				primary: {
					DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
					foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
					hover: 'rgb(var(--brand-hover) / <alpha-value>)',
					press: 'rgb(var(--brand-press) / <alpha-value>)',
					soft: 'rgb(var(--primary-soft) / <alpha-value>)'
				},
				brand: 'rgb(var(--brand-blue) / <alpha-value>)',
				secondary: {
					DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
					foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
					foreground: 'rgb(var(--muted-foreground) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
					foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
					purple: 'rgb(var(--accent-purple) / <alpha-value>)',
					orange: 'rgb(var(--accent-orange) / <alpha-value>)'
				},
				destructive: {
					DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
					foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)'
				},
				positive: 'rgb(var(--positive) / <alpha-value>)',
				negative: 'rgb(var(--negative) / <alpha-value>)',
				caution: 'rgb(var(--caution) / <alpha-value>)',
				border: {
					DEFAULT: 'rgb(var(--border) / <alpha-value>)',
					strong: 'rgb(var(--border-strong) / <alpha-value>)'
				},
				input: 'rgb(var(--input) / <alpha-value>)',
				ring: 'rgb(var(--ring) / <alpha-value>)'
			},
			borderRadius: {
				// Theme.Radius — sm 8, md 10, lg 12, xl 16, 2xl 20; the big Home
				// cards use 22 (rounded-card).
				sm: '8px',
				md: '10px',
				lg: '12px',
				xl: '16px',
				'2xl': '20px',
				card: '22px'
			},
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
