import type { JobView } from "../contracts/platform-ui";
export const CUSTOMER_JOB_LABELS: Readonly<Record<JobView["state"], string>> =
  Object.freeze({
    queued: "İşlem bekliyor",
    processing: "Oluşturuluyor",
    "awaiting-review": "İnceleme bekliyor",
    approved: "Hazır",
    rejected: "İşlem yapılamadı",
    failed: "Başarısız",
    cancelled: "İşlem yapılamadı",
    "unknown-submission": "Sonuç doğrulanamadı",
  });
export function canRequestFinal(
  job: Pick<JobView, "state" | "revision" | "output">,
  currentRevision: number,
) {
  return (
    job.state === "approved" &&
    job.revision === currentRevision &&
    job.output !== null
  );
}
