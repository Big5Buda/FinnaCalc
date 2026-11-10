import {beforeEach,expect,it,vi} from "vitest"
const m=vi.hoisted(()=>({rpc:vi.fn(),update:vi.fn(),legacy:vi.fn()}))
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({rpc:m.rpc,from:()=>({update:(...a:any[])=>{m.update(...a);return{eq:m.legacy}}})})}))
import { connectionLinkGuard,touchConnectionActivity } from "../connection-activity"
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://test.invalid");vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","fixture");m.legacy.mockResolvedValue({error:null});m.rpc.mockResolvedValue({data:false,error:null})})
it("records real use but never manufactures policy acknowledgment",async()=>{await touchConnectionActivity("owner");expect(m.rpc).toHaveBeenCalledWith("touch_app_activity",{p_user_id:"owner",p_annual_policy:false});expect(m.update).toHaveBeenCalledTimes(2)})
it("explicit new disclosure acknowledgment is stamped only for the verified owner",async()=>{await touchConnectionActivity("owner",true);expect(m.rpc).toHaveBeenCalledWith("touch_app_activity",{p_user_id:"owner",p_annual_policy:true})})
it("blocks new linking during an active cleanup",async()=>{m.rpc.mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:true,error:null});expect((await connectionLinkGuard("owner"))?.status).toBe(409)})
it("unavailable storage prevents new vendor portals",async()=>{m.rpc.mockResolvedValue({error:{code:"offline"}});expect((await connectionLinkGuard("owner"))?.status).toBe(503)})
it("pre-migration linking retains legacy behavior while annual pruning is disabled",async()=>{m.rpc.mockResolvedValue({error:{code:"PGRST202"}});expect(await connectionLinkGuard("owner")).toBeNull()})
