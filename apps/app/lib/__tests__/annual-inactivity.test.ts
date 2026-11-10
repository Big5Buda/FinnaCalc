import { beforeEach, describe, expect, it, vi } from "vitest"
import { inactivityPlan, dormant } from "../connection-inactivity-policy"
import { runAnnualCleanup, type CleanupIO, type CleanupTarget } from "../annual-inactivity-runner"
const target:CleanupTarget={key:"bank:a",kind:"bank",identity:{itemId:"a"}}
describe("verified inactivity policy",()=>{
 it("retains unknown, mixed-monthly, and developer access",()=>{
  expect(inactivityPlan([],false,false)).toBe("retain")
  expect(inactivityPlan([{tier:"pro",interval:null}],true,false)).toBe("retain")
  expect(inactivityPlan([{tier:"plus",interval:"annual"},{tier:"trader",interval:"monthly"}],true,false)).toBe("monthly")
  expect(inactivityPlan([],true,true)).toBe("retain")
 })
 it("annual plan is account-wide, ignores add-ons, and leaves verified free distinct",()=>{
  expect(inactivityPlan([{tier:"plus",interval:"annual"}],true,false)).toBe("annual")
  expect(inactivityPlan([{tier:"bank_addon",interval:"monthly"}],true,false)).toBe("free")
  expect(inactivityPlan([],true,false)).toBe("free")
 })
 it("requires a known timestamp and includes the exact 45/60-day boundary",()=>{
  const now=Date.parse("2027-02-01T12:00:00Z")
  for(const days of [45,60]) {
   expect(dormant(new Date(now-days*86400000).toISOString(),days,now)).toBe(true)
   expect(dormant(new Date(now-days*86400000+1).toISOString(),days,now)).toBe(false)
   expect(dormant(null,days,now)).toBe(false);expect(dormant("invalid",days,now)).toBe(false)
  }
 })
})
let io:CleanupIO
beforeEach(()=>{
 io={plan:vi.fn().mockResolvedValue("annual"),claim:vi.fn().mockResolvedValue({receipt:"r",token:"t"}),
 targets:vi.fn().mockResolvedValue([target]),canRemove:vi.fn().mockResolvedValue(true),confirmed:vi.fn().mockResolvedValue(false),
 removeVendor:vi.fn().mockResolvedValue(undefined),record:vi.fn().mockResolvedValue(undefined),removeLocal:vi.fn().mockResolvedValue(undefined),
 markLocal:vi.fn().mockResolvedValue(undefined),finish:vi.fn().mockResolvedValue(undefined)}
})
it.each(["free","monthly","retain"])("never claims or removes a %s account",async plan=>{
 vi.mocked(io.plan).mockResolvedValue(plan as any);await runAnnualCleanup("u","cut",io)
 expect(io.claim).not.toHaveBeenCalled();expect(io.removeVendor).not.toHaveBeenCalled()
})
it("preserves the order vendor -> durable confirmation -> credential cleanup -> completion",async()=>{
 await runAnnualCleanup("u","cut",io)
 const order=[io.removeVendor,io.record,io.removeLocal,io.markLocal,io.finish].map(f=>vi.mocked(f).mock.invocationCallOrder[0])
 expect(order).toEqual([...order].sort((a,b)=>a-b));expect(io.finish).toHaveBeenCalledWith({receipt:"r",token:"t"},false)
})
it("failed vendor removal retains credentials and records no disconnection",async()=>{
 vi.mocked(io.removeVendor).mockRejectedValue(new Error("offline"));await runAnnualCleanup("u","cut",io)
 expect(io.record).not.toHaveBeenCalled();expect(io.removeLocal).not.toHaveBeenCalled();expect(io.finish).toHaveBeenCalledWith({receipt:"r",token:"t"},true)
})
it("failed durable confirmation retains credentials for an idempotent retry",async()=>{
 vi.mocked(io.record).mockRejectedValue(new Error("db"));await runAnnualCleanup("u","cut",io)
 expect(io.removeLocal).not.toHaveBeenCalled();expect(io.finish).toHaveBeenCalledWith({receipt:"r",token:"t"},true)
})
it("user returns after selection or another cron holds the claim: no deletion",async()=>{
 vi.mocked(io.canRemove).mockResolvedValue(false);await runAnnualCleanup("u","cut",io);expect(io.removeVendor).not.toHaveBeenCalled()
 vi.mocked(io.claim).mockResolvedValue(null);await runAnnualCleanup("u","cut",io);expect(io.removeVendor).not.toHaveBeenCalled()
})
it("billing changes after claiming retain the connection",async()=>{
 vi.mocked(io.plan).mockResolvedValueOnce("annual").mockResolvedValue("monthly");await runAnnualCleanup("u","cut",io)
 expect(io.removeVendor).not.toHaveBeenCalled()
})
it("confirmed retry only repairs local state, without another vendor call",async()=>{
 vi.mocked(io.confirmed).mockResolvedValue(true);await runAnnualCleanup("u","cut",io)
 expect(io.removeVendor).not.toHaveBeenCalled();expect(io.record).not.toHaveBeenCalled();expect(io.removeLocal).toHaveBeenCalled()
})
it("partial failure proceeds only with other individually confirmed removals",async()=>{
 vi.mocked(io.targets).mockResolvedValue([target,{key:"broker:b",kind:"brokerage",identity:{userId:"b",clientId:"owner"}}])
 vi.mocked(io.removeVendor).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined)
 await runAnnualCleanup("u","cut",io);expect(io.record).toHaveBeenCalledTimes(1);expect(io.removeLocal).toHaveBeenCalledTimes(1)
 expect(io.finish).toHaveBeenCalledWith({receipt:"r",token:"t"},true)
})
