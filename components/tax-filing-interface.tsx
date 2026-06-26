/**
 * Re-export shim. The legacy stub wizard has been replaced by the adaptive,
 * IRS-accurate tax engine. The original file path + default export + `{ onBack }`
 * prop contract are preserved so `app/taxes/page.tsx` is unchanged.
 *
 * Implementation: components/tax-engine/ui/TaxInterview.tsx
 */
export { default } from "@/components/tax-engine/ui/TaxInterview"
