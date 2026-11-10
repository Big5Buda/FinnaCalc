import { afterEach,beforeEach,expect,it,vi } from "vitest"
import { NextRequest } from "next/server"
const m=vi.hoisted(()=>({plan:vi.fn(),paid:vi.fn(),remove:vi.fn(),forget:vi.fn(),row:{user_id:"u",st_user_id:"vendor",client_id:"owner",last_seen_at:"2020-01-01T00:00:00Z",has_investing:true} as any}))
vi.mock("@/lib/connection-inactivity",()=>({verifiedInactivityPlan:m.plan,annualCleanupIO:{},repairConfirmedCleanup:vi.fn()}))
vi.mock("@/lib/paid-feature-access",()=>({paidFeatureError:m.paid}))
vi.mock("@/lib/snaptrade",()=>({isSnapTradeConfigured:true,getSnapTrade:()=>({authentication:{deleteSnapTradeUser:m.remove}})}))
vi.mock("@/lib/snaptrade-session",()=>({deleteSession:m.forget}))
vi.mock("@/lib/connection-activity",()=>({missingActivityMigration:()=>false,activityAdmin:()=>({from:()=>({select:()=>({lte:()=>({limit:async()=>({data:[m.row],error:null})}),eq:()=>({maybeSingle:async()=>({data:m.row,error:null})})})})})}))
import { GET } from "../../app/api/cron/prune-connections/route"
const req=()=>GET(new NextRequest("https://test.invalid/api/cron/prune-connections",{headers:{Authorization:"Bearer fixture"}}))
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("CRON_SECRET","fixture");vi.stubEnv("FINNACALC_ANNUAL_INACTIVITY_CLEANUP_ENABLED","false");m.plan.mockResolvedValue("free");m.paid.mockResolvedValue(new Response("no",{status:403}));m.remove.mockResolvedValue({});m.forget.mockResolvedValue(undefined);m.row.last_seen_at="2020-01-01T00:00:00Z"})
afterEach(()=>vi.unstubAllEnvs())
it.each(["annual","retain"])("never subjects %s accounts to the 45-day free rule",async plan=>{m.plan.mockResolvedValue(plan);await req();expect(m.remove).not.toHaveBeenCalled()})
it("server-verified free overrides a stale/forged client paid hint",async()=>{expect((await(await req()).json()).freeRemoved).toBe(1);expect(m.remove).toHaveBeenCalledWith({userId:"vendor"});expect(m.forget).toHaveBeenCalledWith("u",{userId:"vendor",clientId:"owner"})})
it("monthly investing access is retained",async()=>{m.plan.mockResolvedValue("monthly");m.paid.mockResolvedValue(null);await req();expect(m.remove).not.toHaveBeenCalled()})
it("unknown monthly feature verification is retained",async()=>{m.plan.mockResolvedValue("monthly");m.paid.mockResolvedValue(new Response("offline",{status:503}));await req();expect(m.remove).not.toHaveBeenCalled()})
it("recent app activity prevents free removal",async()=>{m.row.last_seen_at=new Date().toISOString();await req();expect(m.remove).not.toHaveBeenCalled()})
it("vendor failure keeps the credential",async()=>{m.remove.mockRejectedValue(new Error("offline"));await req();expect(m.forget).not.toHaveBeenCalled()})
it("requires cron authorization",async()=>{const res=await GET(new NextRequest("https://test.invalid"));expect(res.status).toBe(401);expect(m.plan).not.toHaveBeenCalled()})
