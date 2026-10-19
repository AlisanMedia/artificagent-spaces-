import type { PlanningAdapter, PropertyCatalog } from "@/contracts/ports";
import { parseConfiguration } from "@/domain/configuration";
import type { PreviewPlan, PreviewRequest, Result, WorkspaceScope } from "@/domain/types";

export function preparePreview(
  scope: WorkspaceScope,
  request: PreviewRequest,
  catalog: PropertyCatalog,
  adapter: PlanningAdapter,
): Result<PreviewPlan> {
  if (request.organizationId !== scope.organizationId) {
    return { ok: false, error: { code: "TENANT_SCOPE_MISMATCH", message: "Bu taslak seçili çalışma alanına ait değil." } };
  }
  const property = catalog.get(scope, request.propertyId);
  if (!property) return { ok: false, error: { code: "PROPERTY_NOT_AVAILABLE", message: "Mülk bu örnek çalışma alanında bulunamadı." } };
  const configuration = parseConfiguration(request.configuration);
  if (!configuration.ok) return configuration;
  if (request.sourceAssetIds.length === 0 || new Set(request.sourceAssetIds).size !== request.sourceAssetIds.length ||
    request.sourceAssetIds.some((id) => !property.media.some((asset) =>
      asset.id === id && asset.organizationId === scope.organizationId && asset.source === "synthetic")) ||
    !property.media.some((asset) => asset.kind === "illustration" && request.sourceAssetIds.includes(asset.id))) {
    return { ok: false, error: { code: "SOURCE_NOT_AVAILABLE", message: "Lütfen yalnız bu mülke ait örnek görselleri kullanın." } };
  }
  if (configuration.value.mode === "interactive-3d" &&
    (property.evidenceClass !== "spatial-verified" ||
      !property.media.some((asset) => asset.kind === "floor-plan" && request.sourceAssetIds.includes(asset.id)))) {
    return { ok: false, error: { code: "INSUFFICIENT_EVIDENCE", message: "Interactive 3D planı için örnek ölçülü plan gerekli. Atrium Loft veya Avlu Evi’ni seçin." } };
  }
  if (!adapter.supportedModes.includes(configuration.value.mode)) {
    return { ok: false, error: { code: "UNSUPPORTED_SETTING", message: "Bu yerel adaptör seçilen modu desteklemiyor." } };
  }
  return { ok: true, value: adapter.plan({ ...request, configuration: configuration.value }, property) };
}
