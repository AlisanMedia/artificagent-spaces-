import type { BrandTheme, PlatformRole, Scene } from "@/domain/platform";
import type { GuideReply, OutputEvidence } from "./platform-ports";

export interface ActorView {
  userId: string;
  organizationId: string;
  role: PlatformRole;
}
export interface Bootstrap {
  actor: ActorView | null;
  identities: {
    id: string;
    label: string;
    organizationId: string;
    role: PlatformRole;
  }[];
  mode: "LOCAL_SYNTHETIC";
  externalSpendMicroUsd: 0;
}
export interface PropertyView {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  revision: number;
  archived: boolean;
  manifest: Scene;
}
export interface AssetView {
  id: string;
  kind: string;
  status: string;
  bytes: number;
  width: number;
  height: number;
  clean_hash: string;
}
export interface JobView {
  id: string;
  property_id: string;
  revision: number;
  state:
    | "queued"
    | "processing"
    | "awaiting-review"
    | "approved"
    | "rejected"
    | "failed"
    | "cancelled"
    | "unknown-submission";
  command: { mode: string; aspectRatio: string; durationSeconds: number };
  output: OutputEvidence | null;
  error_code: string | null;
  created_by: string;
  attempt: number;
}
export interface PublicBrand extends BrandTheme {
  accentText: string;
  domainStatus: string;
  externalDomainVerified: false;
}
export interface WorkspaceView {
  actor: ActorView;
  properties: Omit<PropertyView, "manifest">[];
  jobs: JobView[];
  brand: PublicBrand;
  accounts: { available: number; reserved: number; currency: string }[];
}
export interface AnalyticsView {
  totalEvents: number;
  consentedSessions: number;
  lowSample: boolean;
  uniquePeople: string;
  conversionRate: number | null;
  steps: { key: string; label: string; count: number }[];
  dwellSeconds: Record<string, number>;
  voiceStarts: number;
  voiceEnds: number;
  attribution: string;
  realSalesClosed: null;
}
export interface TourView {
  publicationId: string;
  propertyId: string;
  title: string;
  scene: Scene;
  output: OutputEvidence;
  expiresAt: string;
  brand: PublicBrand;
  localOnly: true;
}
export interface VoiceSessionView {
  id: string;
  token: string;
  nextSequence: number;
  expiresAt: number;
  provider: string;
  disclosure: string;
  intro: GuideReply;
}
export interface GuideTurn extends GuideReply {
  sequence: number;
  nextSequence: number;
}
export interface PartnerView {
  assignedChildren: {
    childOrganizationId: string;
    properties: number;
    jobs: number;
    engagementEvents: number | null;
    suppressedForLowDenominator: boolean;
    rawMediaAccess: false;
    privateLeadsAccess: false;
    resellerCommission: string;
  }[];
  disclosure: string;
}
