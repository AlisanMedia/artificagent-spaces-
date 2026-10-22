import { DeterministicPlanningAdapter } from "@/adapters/fake/planning-adapter";
import { SyntheticPropertyCatalog } from "@/adapters/fake/property-catalog";
import { preparePreview } from "@/application/prepare-preview";
import type { PreviewRequest, WorkspaceScope } from "@/domain/types";

// Stateless, read-only composition. Never substitute a live adapter in Phase 1.
export const localCatalog = new SyntheticPropertyCatalog();
const localPlanner = new DeterministicPlanningAdapter();
export function prepareLocalPreview(scope: WorkspaceScope, request: PreviewRequest) {
  return preparePreview(scope, request, localCatalog, localPlanner);
}
