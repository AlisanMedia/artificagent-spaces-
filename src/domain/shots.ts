import { invariant, routeToRoom, validateScene, type Scene } from "./platform";

export interface PlannedShot { id: string; roomId: string; seconds: number; style: "first-person" | "cinematic"; eyeHeightMeters: 1.65; look: "forward" | "glance-left" | "glance-right" | "material-detail"; cameraRoute: [number,number][]; evidenceIds: string[]; firstPersonPrompt: string; hands: "DISABLED_EXPERIMENTAL"; physicallyCalibratedLighting: false }
/** Evidence-bound planning is separate from actual video rendering. No unknown room is filled in. */
export function planShots(input: Scene, mode: "pov" | "cinematic" | "hybrid", durationSeconds: 4 | 8 | 16) {
  const scene=validateScene(input), rooms=scene.rooms.filter((r)=>r.truth==="E2");invariant(rooms.length>0,"VERIFIED_ROOMS_REQUIRED");
  const chosen=rooms.slice(0,Math.min(3,durationSeconds/4)),shots:PlannedShot[]=[];
  for(let i=0;i<chosen.length;i++){
    const room=chosen[i]!,previous=chosen[Math.max(0,i-1)]!,style=mode==="cinematic"||mode==="hybrid"&&i%2===1?"cinematic":"first-person";
    shots.push({id:`shot-${i+1}`,roomId:room.id,seconds:durationSeconds/chosen.length,style,eyeHeightMeters:1.65,look:i%2===0?"forward":"glance-right",cameraRoute:routeToRoom(scene,previous.id,room.id),evidenceIds:room.evidenceIds,firstPersonPrompt:style==="first-person"?"First-person eye-level view at 1.65 m: viewer is the person looking. No other person walking in front of camera. No invented doors, rooms, windows or views.":"Composed real-estate camera shot, maintain verified room, material and light continuity.",hands:"DISABLED_EXPERIMENTAL",physicallyCalibratedLighting:false});
  }
  return {schemaVersion:1 as const,mode,manifestRevision:scene.revision,shots,continuity:{roomIds:chosen.map((r)=>r.id),daypart:"noon",staging:"NO_UNVERIFIED_FURNITURE",unknownRegions:scene.unknownRegions},planningOnly:true as const,actualProviderGeneratedVideo:false as const};
}

export type ShotPlan = ReturnType<typeof planShots>;
