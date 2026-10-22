import { z } from "zod";
import type { Scene } from "@/domain/platform";
import { invariant, PlatformError } from "@/domain/platform";
import type { PropertyVoiceProvider } from "@/contracts/platform-ports";

export const ELEVENLABS_CONTRACT = Object.freeze({
  checkedAt: "2026-10-22",
  sdk: "@elevenlabs/react@1.19.1",
  source: "https://api.elevenlabs.io/openapi.json",
  openApiSha256:
    "61de2e1f86c1fbaade757b37aad529207f6b829a968d7fce10049dc21decb860",
  method: "GET",
  signedPath: "/v1/convai/conversation/get-signed-url",
  deprecatedPath: "/v1/convai/conversation/get_signed_url",
  requiredSecretName: "ELEVENLABS_API_KEY",
  enabled: false,
  region: "UNVERIFIED",
  pricing: "UNVERIFIED",
  workspaceMutationExecuted: false,
});
export const SignedCredential = z
  .object({
    signed_url: z.url().refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "wss:" &&
        u.hostname === "api.elevenlabs.io" &&
        u.pathname.startsWith("/v1/convai/conversation")
      );
    }),
  })
  .strict();
export function prepareSignedRequest(input: unknown) {
  const value = z
    .object({
      dedicatedSpacesAgentId: z.string().regex(/^agent_[a-zA-Z0-9]+$/),
      purpose: z.literal("spaces-property-guide"),
      includeConversationId: z.literal(true),
    })
    .strict()
    .parse(input);
  return {
    method: "GET",
    origin: "https://api.elevenlabs.io",
    path: ELEVENLABS_CONTRACT.signedPath,
    query: {
      agent_id: value.dedicatedSpacesAgentId,
      include_conversation_id: true,
    },
    secretHeaderName: "xi-api-key",
    enabled: false,
    disclosure:
      "Yalnız istek sözleşmesi. Kaynak oluşturulmaz; mevcut ArtificAgent web agent'ı değiştirilmez.",
  };
}
export function propertyVariables(
  scene: Scene,
  propertyTitle: string,
  brandName: string,
  currentRoom: string,
) {
  invariant(
    scene.rooms.some((r) => r.id === currentRoom && r.truth === "E2"),
    "UNKNOWN_ROOM_CONTEXT",
    403,
  );
  return {
    property_title: propertyTitle.slice(0, 120),
    language: "tr",
    brand_display_name: brandName.slice(0, 120),
    approved_summary: scene.facts
      .filter((f) => f.truth === "E2" && !f.staged)
      .map((f) => `${f.label}: ${f.value}`)
      .join("; ")
      .slice(0, 1000),
    current_room_label: scene.rooms.find((r) => r.id === currentRoom)!.label,
    published_revision: scene.revision,
  };
}
/** No credential issuance/transport exists in the enabled runtime. Authorization and budget must precede it. */
export class ElevenLabsDisabledProvider implements PropertyVoiceProvider {
  readonly kind = "elevenlabs-disabled" as const;
  async createSession(
    context: Parameters<PropertyVoiceProvider["createSession"]>[0],
  ): Promise<never> {
    invariant(
      context.visitorConsent &&
        context.approvedScene.organizationId === context.organizationId &&
        context.approvedScene.propertyId === context.propertyId &&
        context.approvedScene.revision === context.revision,
      "VOICE_SCOPE_MISMATCH",
      403,
    );
    throw new PlatformError("BLOCKED_EXTERNAL_APPROVAL", 403);
  }
}
