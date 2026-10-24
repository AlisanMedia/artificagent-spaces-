import { describe, it, expect } from "vitest";
import {
  emptyEvaluation,
  EvaluationRecord,
  exportEvaluation,
  PARTICIPANT_SLOTS,
  summarizeEvaluations,
  UX_TASKS,
  type Evaluation,
} from "@/domain/usability-evaluation";
const head = "a".repeat(40);
// These are synthetic test inputs exercising self-attestation rules, not actual human feedback.
function completed(code: Evaluation["participantCode"] = "P01"): Evaluation {
  const r = emptyEvaluation(head, false, code);
  return {
    ...r,
    recordKind: "INDEPENDENT_PROFESSIONAL",
    professionalConfirmed: true,
    independenceConfirmed: true,
    consent: true,
    completion: "COMPLETED",
    understanding: "PREGENERATED_SAMPLE",
    tasks: r.tasks.map((t) => ({
      ...t,
      outcome: "SUCCESS_UNASSISTED",
      elapsedSeconds: 5,
      ease: 4,
    })),
  };
}
const cohort = () => PARTICIPANT_SLOTS.map((s) => completed(s));
describe("future professional usability evaluation, private and evidence bound", () => {
  it("prepares five distinct empty slots with no invented timings, feedback or success", () => {
    const rows = PARTICIPANT_SLOTS.map((p) => emptyEvaluation(head, false, p));
    expect(new Set(rows.map((r) => r.participantCode)).size).toBe(5);
    expect(
      rows.every((r) =>
        r.tasks.every(
          (t) =>
            t.outcome === null && t.elapsedSeconds === null && t.ease === null,
        ),
      ),
    ).toBe(true);
    expect(summarizeEvaluations(rows, head)).toMatchObject({
      status: "NOT_RUN",
      eligibleSelfReportedRecords: 0,
      independentlyVerifiedParticipants: null,
      thresholdsPass: null,
      correctUnderstanding: null,
    });
  });
  it("does not report zero feedback as a failed study or an acceptance percentage", () => {
    const s = summarizeEvaluations([], head);
    expect(s.status).toBe("NOT_RUN");
    expect(
      s.tasks.every((t) => t.unassisted === null && t.thresholdPass === null),
    ).toBe(true);
  });
  it("rejects extra PII, filenames, contact fields and injected source scope", () => {
    for (const field of ["name", "email", "notes", "filename", "tenantId"])
      expect(
        EvaluationRecord.safeParse({ ...completed(), [field]: "not-collected" })
          .success,
      ).toBe(false);
    expect(
      EvaluationRecord.safeParse({
        ...completed(),
        participantCode: "not-a-slot",
      }).success,
    ).toBe(false);
  });
  it("requires consent and completeness before local export", () => {
    expect(() => exportEvaluation(emptyEvaluation(head))).toThrow(
      "EVALUATION_CONSENT_REQUIRED",
    );
    expect(() =>
      exportEvaluation({ ...emptyEvaluation(head), consent: true }),
    ).toThrow("EVALUATION_NOT_COMPLETE");
    expect(() =>
      exportEvaluation({ ...completed(), understanding: null }),
    ).toThrow();
    expect(JSON.parse(exportEvaluation(completed()))).toMatchObject({
      participantCode: "P01",
      consent: true,
      completion: "COMPLETED",
    });
  });
  it("requires an assigned cohort and all task outcomes for completion", () => {
    expect(
      EvaluationRecord.safeParse({ ...completed(), recordKind: "UNASSIGNED" })
        .success,
    ).toBe(false);
    const r = completed();
    r.tasks[0]!.outcome = null;
    expect(EvaluationRecord.safeParse(r).success).toBe(false);
  });
  it("requires current clean source and explicit independence/professional attestation", () => {
    for (const patch of [
      { professionalConfirmed: false },
      { independenceConfirmed: false },
      { sourceDirty: true },
    ])
      expect(
        EvaluationRecord.safeParse({ ...completed(), ...patch }).success,
      ).toBe(false);
    expect(() => summarizeEvaluations([completed()], "b".repeat(40))).toThrow(
      "EVALUATION_SOURCE_MISMATCH",
    );
    expect(() => summarizeEvaluations([], "not-a-sha")).toThrow();
  });
  it("rejects task reordering, duplicates, invalid duration, rating and duplicate issue codes", () => {
    const r = completed();
    [r.tasks[0], r.tasks[1]] = [r.tasks[1]!, r.tasks[0]!];
    expect(EvaluationRecord.safeParse(r).success).toBe(false);
    for (const patch of [
      { elapsedSeconds: -1 },
      { elapsedSeconds: 3601 },
      { elapsedSeconds: 1.5 },
      { ease: 0 },
      { issues: ["UNCLEAR_COPY", "UNCLEAR_COPY"] },
    ]) {
      const row = completed();
      Object.assign(row.tasks[0]!, patch);
      expect(EvaluationRecord.safeParse(row).success).toBe(false);
    }
  });
  it("rejects duplicate slots and oversized cohorts instead of silently replacing results", () => {
    expect(() =>
      summarizeEvaluations([completed(), completed()], head),
    ).toThrow("DUPLICATE_PARTICIPANT_SLOT");
    expect(() =>
      summarizeEvaluations([...cohort(), completed()], head),
    ).toThrow("FIVE_PARTICIPANT_LIMIT");
  });
  it("excludes completed synthetic rehearsals from all real-cohort calculations", () => {
    const rows = cohort().map((r) => ({
      ...r,
      recordKind: "SYNTHETIC_REHEARSAL",
      sourceDirty: true,
    }));
    expect(summarizeEvaluations(rows, head)).toMatchObject({
      status: "NOT_RUN",
      syntheticRecordsExcluded: 5,
      eligibleSelfReportedRecords: 0,
      thresholdsPass: null,
      independentHumanAcceptance: "NOT_VERIFIED",
    });
  });
  it("keeps four self-reported professionals incomplete with no extrapolated success", () => {
    expect(summarizeEvaluations(cohort().slice(0, 4), head)).toMatchObject({
      status: "INCOMPLETE",
      eligibleSelfReportedRecords: 4,
      thresholdsPass: null,
    });
  });
  it("five positive self-reports still require independent moderator review and never verify Safari", () => {
    const s = summarizeEvaluations(cohort(), head);
    expect(s).toMatchObject({
      status: "READY_FOR_MODERATOR_REVIEW",
      thresholdsPass: true,
      independentlyVerifiedParticipants: null,
      independentHumanAcceptance: "NOT_VERIFIED",
      realDeviceSafari: "NOT_VERIFIED",
      releaseDecision: "NOT_AUTOMATICALLY_APPROVED",
    });
    expect(
      s.tasks.every(
        (t) => t.unassisted === 5 && t.withinTargetUnassisted === 5,
      ),
    ).toBe(true);
  });
  it("critical sample-vs-generation misunderstanding overrides otherwise favorable results", () => {
    for (const answer of ["NEW_VIDEO_FROM_MY_FILES", "UNSURE"] as const) {
      const rows = cohort();
      rows[0]!.understanding = answer;
      expect(summarizeEvaluations(rows, head)).toMatchObject({
        status: "NEEDS_CHANGES",
        thresholdsPass: false,
        criticalMisunderstandings: 1,
      });
    }
  });
  it("unknown timings and assisted/failed tasks cannot pass the predeclared threshold", () => {
    const rows = cohort();
    rows[0]!.tasks[0]!.elapsedSeconds = null;
    rows[1]!.tasks[0]!.elapsedSeconds = UX_TASKS[0].targetSeconds + 1;
    expect(summarizeEvaluations(rows, head).thresholdsPass).toBe(false);
    rows[0]!.tasks[1]!.outcome = "SUCCESS_ASSISTED";
    rows[1]!.tasks[1]!.outcome = "FAILED";
    expect(summarizeEvaluations(rows, head).tasks[1]!.thresholdPass).toBe(
      false,
    );
  });
});
