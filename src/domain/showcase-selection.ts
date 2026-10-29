import type { SampleAsset } from "./showcase";
/** Pure presentation integrity check; this never authorizes access to private sources. */
export function matchedComparison(
  before: SampleAsset,
  after: SampleAsset,
  source: SampleAsset,
) {
  return (
    before.type === "image" &&
    after.type === "image" &&
    before.propertyId === source.propertyId &&
    after.propertyId === source.propertyId &&
    before.cameraId === source.cameraId &&
    after.cameraId === source.cameraId &&
    before.sourceHash === source.sha256 &&
    after.sourceHash === source.sha256 &&
    before.width === after.width &&
    before.height === after.height &&
    before.sha256 !== after.sha256
  );
}
