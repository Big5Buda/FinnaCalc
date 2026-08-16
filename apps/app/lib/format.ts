/**
 * Number formatting now lives in @finnacalc/shared so the marketing site and
 * the app format the same figure the same way. Re-exported here because the
 * app imports it from "@/lib/format" in dozens of places.
 */
export * from "@finnacalc/shared/format"
