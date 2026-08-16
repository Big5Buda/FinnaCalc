/**
 * Shared between the marketing site (apps/web) and the application
 * (apps/app): the design tokens, the number formatting, the calculator math
 * and the plan catalog.
 *
 * Anything both apps state to a visitor lives here, so the landing page can't
 * quote a payment the app would compute differently, or a price the app
 * doesn't charge.
 */
export * from "./format"
export * from "./calculators"
export * from "./plans"
export * from "./storage"
