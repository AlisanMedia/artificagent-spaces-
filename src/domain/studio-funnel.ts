import { z } from "zod";
export const FUNNEL_NAMES = [
  "studio_entered",
  "picker_opened",
  "selection_supported",
  "selection_unsupported",
  "rights_accepted",
  "upload_succeeded",
  "upload_failed",
  "style_selected",
  "quote_returned",
  "job_started",
  "preview_opened",
  "review_pending",
  "approval_observed",
  "download_completed",
] as const;
export const StudioFunnelEvent = z
  .object({
    name: z.enum(FUNNEL_NAMES),
    media: z.enum(["photo", "video", "unsupported"]).optional(),
  })
  .strict();
/** Ephemeral, opt-in synthetic UX observations. No identity, filename, property, cookie, network or sales truth. */
export class StudioFunnel {
  private enabled = false;
  private count = 0;
  private counts: Partial<Record<(typeof FUNNEL_NAMES)[number], number>> = {};
  consent(enabled: boolean) {
    this.enabled = enabled;
    this.clear();
    if (enabled) this.record({ name: "studio_entered" });
  }
  clear() {
    this.count = 0;
    this.counts = {};
  }
  record(input: unknown) {
    const event = StudioFunnelEvent.parse(input);
    if (!this.enabled || this.count >= 512) return false;
    this.count++;
    this.counts[event.name] = (this.counts[event.name] ?? 0) + 1;
    return true;
  }
  snapshot() {
    return {
      version: "synthetic-studio-funnel-v4",
      enabled: this.enabled,
      total: this.count,
      counts: { ...this.counts },
      persistent: false,
      networkRequests: 0,
      purpose: "OPT_IN_LOCAL_SYNTHETIC_UX_DEBUG_ONLY",
      conversionUplift: null,
    };
  }
}
