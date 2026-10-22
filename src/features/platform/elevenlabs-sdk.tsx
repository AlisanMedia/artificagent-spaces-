"use client";

import { useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  type ClientTools,
  type HookOptions,
} from "@elevenlabs/react";

/** Typechecked SDK integration, deliberately not mounted by any route.
 * Server credential route returns 403. CSP blocks external connections.
 * Activation requires a separate authorized PR, DPA/region/budget and a NEW Spaces resource.
 */
export function ElevenLabsSdkPreview({
  clientTools,
  variables,
}: {
  clientTools: ClientTools;
  variables: Record<string, string | number | boolean>;
}) {
  return (
    <ConversationProvider clientTools={clientTools}>
      <DisabledControls variables={variables} />
    </ConversationProvider>
  );
}
function DisabledControls({
  variables,
}: {
  variables: Record<string, string | number | boolean>;
}) {
  const controls = useConversationControls(),
    { status } = useConversationStatus();
  const [error, setError] = useState("");
  function prepareOnly() {
    // Compile-time evidence of the pinned SDK's private WebSocket semantics. No fabricated signed credential.
    const shape: Pick<HookOptions, "connectionType" | "dynamicVariables"> = {
      connectionType: "websocket",
      dynamicVariables: variables,
    };
    if (shape.connectionType === "websocket")
      setError(
        "BLOCKED_EXTERNAL_APPROVAL: imzalı kimlik bilgisi alınmadı; canlı oturum açılmadı.",
      );
  }
  return (
    <section aria-label="Kapalı ElevenLabs SDK bağlantısı">
      <p>ElevenLabs SDK: {status}; canlı bağlantı kapalı.</p>
      <button onClick={prepareOnly}>
        Kapalı bağlantı sözleşmesini denetle
      </button>
      <button onClick={() => controls.endSession()}>
        Yerel SDK durumunu bitir
      </button>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
