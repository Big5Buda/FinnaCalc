import { afterEach, beforeEach, expect, it, vi } from "vitest"
const access=vi.hoisted(()=>vi.fn())
vi.mock("../paid-feature-access",()=>({paidFeatureError:access}))
import { personalChatContext } from "../personal-chat-context"
const OWNER="35245322-f950-4f2a-a980-80a17bd134ab",OTHER="11111111-1111-4111-8111-111111111111"
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("FINNACALC_DEVELOPER_AI_USER_IDS",OWNER);access.mockResolvedValue(new Response("denied",{status:403}))})
afterEach(()=>vi.unstubAllEnvs())
it("verified developer can use BOTH context domains without manufacturing a purchase",async()=>{
 const r=await personalChatContext({requested:["budgeting","investing"],budget:"OWN_BUDGET",portfolio:"OWN_HOLDINGS"},OWNER)
 expect(r).toContain("OWN_BUDGET");expect(r).toContain("OWN_HOLDINGS");expect(access).not.toHaveBeenCalled()
})
it("free preview remains restrictive even for an allowlisted developer",async()=>{
 const r=await personalChatContext({requested:["budgeting","investing"],locked:["budgeting","investing"],budget:"PRIVATE_B",portfolio:"PRIVATE_P"},OWNER)
 expect(r).not.toContain("PRIVATE_");expect(r).toContain("upgrading");expect(access).not.toHaveBeenCalled()
})
it("another account or signed-out request receives no developer permission",async()=>{
 for(const user of [OTHER,null]) {
  const r=await personalChatContext({requested:["budgeting","investing"],budget:"PRIVATE_B",portfolio:"PRIVATE_P"},user)
  expect(r).not.toContain("PRIVATE_");expect(access).toHaveBeenCalledWith(user,"budgeting")
 }
})
it("client developer/Pro assertions are rejected and cannot impersonate the allowlisted user",async()=>{
 const r=await personalChatContext({requested:["budgeting"],budget:"PRIVATE_B",developer:true,userId:OWNER,plan:"pro"},OTHER)
 expect(r).toBeInstanceOf(Response);expect((r as Response).status).toBe(400)
})
it.each(["", "*", "@example.com", "developer",'['+OWNER+']'])("invalid allowlist cannot grant: %s",async value=>{
 vi.stubEnv("FINNACALC_DEVELOPER_AI_USER_IDS",value)
 const r=await personalChatContext({requested:["budgeting"],budget:"PRIVATE_B"},OWNER)
 expect(r).not.toContain("PRIVATE_B");expect(access).toHaveBeenCalled()
})
