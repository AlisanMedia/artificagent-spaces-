import { z } from "zod";

export const UX_PROTOCOL = "spaces-ux-5.3.0" as const;
export const PARTICIPANT_SLOTS = ["P01", "P02", "P03", "P04", "P05"] as const;
export const UX_TASKS = [
  {
    id: "upload",
    title: "Yüklemeye başlayın",
    instruction:
      "Yeni bir mülk için fotoğraf eklemeye nereden başlayacağınızı bulun. Dosya seçiciyi açın ve iptal edin; sonraki görev için stüdyo boş kalsın. Gerçek dosya seçmeyin.",
    targetSeconds: 30,
  },
  {
    id: "example",
    title: "Örnek mülkü seçin",
    instruction: "Kendi dosyanız yerine hazır bir örnek mülkle devam edin.",
    targetSeconds: 60,
  },
  {
    id: "style",
    title: "Bir video tarzı seçin",
    instruction:
      "Mülkünüz için uygun bulduğunuz anlatım tarzını ve video yönünü seçin.",
    targetSeconds: 60,
  },
  {
    id: "video",
    title: "Videoyu izleyin",
    instruction:
      "Örnek video önizlemesini açın ve oynatın. Video gerçekten başlayana kadar gözlemleyin.",
    targetSeconds: 90,
  },
  {
    id: "tour",
    title: "3D mülkü gezin",
    instruction:
      "Serbest 3D turu açın, yürüyün veya bakışınızı değiştirin; başka bir odaya gidin ve günün zamanını değiştirin.",
    targetSeconds: 180,
  },
  {
    id: "understanding",
    title: "Gördüğünüz sonucu açıklayın",
    instruction:
      "Önizlemenin ne yaptığını kendi anlayışınıza göre değerlendirme formunda belirtin. Moderatör bu soruda açıklama veya ipucu vermesin.",
    targetSeconds: 60,
  },
] as const;
const taskIds = [
  "upload",
  "example",
  "style",
  "video",
  "tour",
  "understanding",
] as const;
export const UX_ISSUES = [
  "CONTROL_NOT_FOUND",
  "UNCLEAR_COPY",
  "MEDIA_NOT_PLAYING",
  "NAVIGATION_DIFFICULT",
  "ACCESSIBILITY",
  "LOADING_OR_ERROR",
  "CAPABILITY_MISUNDERSTANDING",
] as const;
export const UX_OUTCOMES = [
  "SUCCESS_UNASSISTED",
  "SUCCESS_ASSISTED",
  "FAILED",
  "NOT_ATTEMPTED",
] as const;
const TaskResponse = z
  .object({
    taskId: z.enum(taskIds),
    outcome: z.enum(UX_OUTCOMES).nullable(),
    elapsedSeconds: z.number().int().min(0).max(3600).nullable(),
    ease: z.number().int().min(1).max(5).nullable(),
    issues: z
      .array(z.enum(UX_ISSUES))
      .max(4)
      .refine((v) => new Set(v).size === v.length),
  })
  .strict();
export const EvaluationRecord = z
  .object({
    schemaVersion: z.literal(1),
    protocolVersion: z.literal(UX_PROTOCOL),
    participantCode: z.enum(PARTICIPANT_SLOTS),
    recordKind: z.enum([
      "UNASSIGNED",
      "SYNTHETIC_REHEARSAL",
      "INDEPENDENT_PROFESSIONAL",
    ]),
    sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
    sourceDirty: z.boolean(),
    device: z.enum(["NOT_REPORTED", "DESKTOP", "MOBILE", "TABLET"]),
    browser: z.enum(["NOT_REPORTED", "CHROMIUM", "SAFARI", "OTHER"]),
    deviceEvidence: z.literal("SELF_REPORTED_NOT_VERIFIED"),
    consent: z.boolean(),
    professionalConfirmed: z.boolean(),
    independenceConfirmed: z.boolean(),
    completion: z.enum(["DRAFT", "COMPLETED"]),
    tasks: z.array(TaskResponse).length(6),
    understanding: z
      .enum(["PREGENERATED_SAMPLE", "NEW_VIDEO_FROM_MY_FILES", "UNSURE"])
      .nullable(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.tasks.some((t, i) => t.taskId !== taskIds[i]))
      ctx.addIssue({ code: "custom", message: "TASK_ORDER_OR_DUPLICATE" });
    if (r.completion === "COMPLETED") {
      if (
        !r.consent ||
        r.recordKind === "UNASSIGNED" ||
        r.tasks.some((t) => t.outcome === null) ||
        r.understanding === null
      )
        ctx.addIssue({ code: "custom", message: "INCOMPLETE_EVALUATION" });
      if (
        r.recordKind === "INDEPENDENT_PROFESSIONAL" &&
        (!r.professionalConfirmed || !r.independenceConfirmed || r.sourceDirty)
      )
        ctx.addIssue({
          code: "custom",
          message: "INDEPENDENCE_OR_SOURCE_NOT_ATTESTED",
        });
    }
  });
export type Evaluation = z.infer<typeof EvaluationRecord>;
export type TaskResult = Evaluation["tasks"][number];
export function emptyEvaluation(
  sourceHead: string,
  sourceDirty = false,
  participantCode: Evaluation["participantCode"] = "P01",
): Evaluation {
  return EvaluationRecord.parse({
    schemaVersion: 1,
    protocolVersion: UX_PROTOCOL,
    participantCode,
    recordKind: "UNASSIGNED",
    sourceHead,
    sourceDirty,
    device: "NOT_REPORTED",
    browser: "NOT_REPORTED",
    deviceEvidence: "SELF_REPORTED_NOT_VERIFIED",
    consent: false,
    professionalConfirmed: false,
    independenceConfirmed: false,
    completion: "DRAFT",
    tasks: taskIds.map((taskId) => ({
      taskId,
      outcome: null,
      elapsedSeconds: null,
      ease: null,
      issues: [],
    })),
    understanding: null,
  });
}
export function exportEvaluation(input: unknown): string {
  const record = EvaluationRecord.parse(input);
  if (!record.consent) throw new Error("EVALUATION_CONSENT_REQUIRED");
  if (record.completion !== "COMPLETED")
    throw new Error("EVALUATION_NOT_COMPLETE");
  return JSON.stringify(record, null, 2) + "\n";
}
/** No network, identity lookup or automatic claim that five JSON files represent five real humans. */
export function summarizeEvaluations(input: unknown[], sourceHead: string) {
  z.string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(sourceHead);
  if (input.length > 5) throw new Error("FIVE_PARTICIPANT_LIMIT");
  const records = input.map((v) => EvaluationRecord.parse(v));
  if (new Set(records.map((r) => r.participantCode)).size !== records.length)
    throw new Error("DUPLICATE_PARTICIPANT_SLOT");
  if (records.some((r) => r.sourceHead !== sourceHead))
    throw new Error("EVALUATION_SOURCE_MISMATCH");
  const eligible = records.filter(
    (r) =>
      r.completion === "COMPLETED" &&
      r.consent &&
      r.recordKind === "INDEPENDENT_PROFESSIONAL" &&
      r.professionalConfirmed &&
      r.independenceConfirmed &&
      !r.sourceDirty,
  );
  const n = eligible.length;
  const tasks = UX_TASKS.map((task, index) => {
    const results = eligible.map((r) => r.tasks[index]!);
    const unaided = results.filter(
      (r) => r.outcome === "SUCCESS_UNASSISTED",
    ).length;
    const timely = results.filter(
      (r) =>
        r.outcome === "SUCCESS_UNASSISTED" &&
        r.elapsedSeconds !== null &&
        r.elapsedSeconds <= task.targetSeconds,
    ).length;
    return {
      taskId: task.id,
      observed: n,
      unassisted: n ? unaided : null,
      withinTargetUnassisted: n ? timely : null,
      targetSeconds: task.targetSeconds,
      thresholdPass: n === 5 ? unaided >= 4 && timely >= 4 : null,
    };
  });
  const understood = eligible.filter(
    (r) => r.understanding === "PREGENERATED_SAMPLE",
  ).length;
  const criticalMisunderstandings = eligible.filter(
    (r) => r.understanding !== "PREGENERATED_SAMPLE",
  ).length;
  const thresholdsPass =
    n === 5
      ? tasks.every((t) => t.thresholdPass === true) && understood === 5
      : null;
  return {
    schemaVersion: 1,
    protocolVersion: UX_PROTOCOL,
    sourceHead,
    plannedSlots: 5,
    receivedRecords: records.length,
    eligibleSelfReportedRecords: n,
    independentlyVerifiedParticipants: null,
    syntheticRecordsExcluded: records.filter(
      (r) => r.recordKind === "SYNTHETIC_REHEARSAL",
    ).length,
    status:
      n === 0
        ? "NOT_RUN"
        : n < 5
          ? "INCOMPLETE"
          : thresholdsPass
            ? "READY_FOR_MODERATOR_REVIEW"
            : "NEEDS_CHANGES",
    tasks,
    correctUnderstanding: n ? understood : null,
    criticalMisunderstandings: n ? criticalMisunderstandings : null,
    thresholdsPass,
    independentHumanAcceptance: "NOT_VERIFIED",
    realDeviceSafari: "NOT_VERIFIED",
    releaseDecision: "NOT_AUTOMATICALLY_APPROVED",
    externalSpendMicroUsd: 0,
  } as const;
}
