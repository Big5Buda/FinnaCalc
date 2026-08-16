import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/**
 * Vitest config for FinnaCalc.
 *
 * The tax engine is pure TypeScript with no DOM dependency, so the default
 * environment is `node`. The `@/` path alias mirrors tsconfig.json so engine
 * imports (`@/components/tax-engine/...`) resolve identically in tests.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})
