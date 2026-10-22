import { describe,it,expect } from "vitest";
import { planShots } from "@/domain/shots";
import { measuredFixture,emptyManifest } from "@/server/seed";
describe("eye-level evidence-bound shot planning",()=>{
  it("never substitutes a camera filming a walking person for true first-person intent",()=>{const plan=planShots(measuredFixture("studio","p",2,"plan","user"),"pov",16);expect(plan.shots).toHaveLength(3);expect(plan.shots.every((s)=>s.style==="first-person"&&s.eyeHeightMeters===1.65&&s.hands==="DISABLED_EXPERIMENTAL")).toBe(true);expect(plan.shots[0]!.firstPersonPrompt).toContain("viewer is the person looking");expect(plan.shots.reduce((sum,s)=>sum+s.seconds,0)).toBe(16);expect(plan.actualProviderGeneratedVideo).toBe(false);});
  it("plans cinematic and mixed timelines without changing property features",()=>{const s=measuredFixture("studio","p",2,"plan","user");expect(planShots(s,"cinematic",4).shots.map((x)=>x.style)).toEqual(["cinematic"]);expect(planShots(s,"hybrid",16).shots.map((x)=>x.style)).toEqual(["first-person","cinematic","first-person"]);expect(planShots(s,"pov",8).shots).toHaveLength(2);});
  it("blocks invented unknown rooms and unsupported adjacency",()=>{expect(()=>planShots(emptyManifest("studio","p",1),"pov",4)).toThrow("VERIFIED_ROOMS_REQUIRED");const s=measuredFixture("studio","p",2,"plan","user");s.doors=[];expect(()=>planShots(s,"hybrid",8)).toThrow("NO_VERIFIED_ROUTE");});
});
