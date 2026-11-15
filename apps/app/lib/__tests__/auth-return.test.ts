import { expect,it } from "vitest"
import { safeAuthReturn } from "../auth-return"
it.each(["/investing","/investing/portfolio","/budgeting?month=2026-11","/education/investing#lessons"])("retains local destination %s",path=>expect(safeAuthReturn(path)).toBe(path))
it.each([null,"","https://evil.example","//evil.example","/\\evil.example","/%2f%2fevil.example","/%5cevil.example","javascript:alert(1)","/\n/evil.example","/%0aevil","/sign-in","/auth/callback","/foo/../sign-in"])("rejects external, malformed or looping destination %s",path=>expect(safeAuthReturn(path)).toBe("/"))
