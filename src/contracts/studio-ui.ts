import type {
  PropertyVideoStyle,
  StudioProduct,
} from "@/domain/real-estate-styles";
export interface StudioPlanView {
  product: StudioProduct;
  styleId: PropertyVideoStyle;
  propertyId: string;
  revision: number;
  fingerprint: string;
  availablePhotos: number;
  neededPhotos: number;
  requestedDurationSeconds: number;
  suggestedDurationSeconds: number;
  sufficientSources: boolean;
  localSourceAssetIds: string[];
  liveEnabled: false;
  plannedResolution: "1080p";
  currentLocalResolution: "640×360" | "360×640";
  futurePriceMicroUsd: null;
  actualExternalCostMicroUsd: 0;
  requiresIndependentReview: true;
  blockers: string[];
}
