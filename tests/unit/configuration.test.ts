import { describe, expect, it } from "vitest";
import { parseConfiguration } from "@/domain/configuration";
import { defaultConfiguration, getMode, isGenerationMode, MODE_DEFINITIONS } from "@/domain/modes";

describe("configuration boundary", () => {
  it.each(MODE_DEFINITIONS)("accepts the complete default $id configuration", ({ id }) => {
    const configuration = defaultConfiguration(id);
    expect(parseConfiguration(configuration)).toEqual({ ok: true, value: configuration });
    expect(getMode(id).id).toBe(id);
  });

  it.each([null, undefined, "", [], 1, false, { mode: "unknown" }])("rejects non-configurations: %j", (input) => {
    expect(parseConfiguration(input)).toMatchObject({ ok: false, error: { code: "INVALID_CONFIGURATION" } });
  });

  it.each([
    { ...defaultConfiguration("pov"), durationSeconds: -1 },
    { ...defaultConfiguration("pov"), durationSeconds: 120 },
    { ...defaultConfiguration("pov"), aspectRatio: "4:3" },
    { ...defaultConfiguration("pov"), cameraPace: "fast" },
    { ...defaultConfiguration("cinematic"), style: "invent-new-rooms" },
    { ...defaultConfiguration("cinematic"), captions: "true" },
    { ...defaultConfiguration("hybrid"), povSharePercent: 0 },
    { ...defaultConfiguration("hybrid"), povSharePercent: 100 },
    { ...defaultConfiguration("interactive-3d"), quality: "unlimited" },
    { ...defaultConfiguration("interactive-3d"), daypart: "night" },
  ])("rejects unsupported values: %j", (input) => {
    expect(parseConfiguration(input).ok).toBe(false);
  });

  it.each([
    { ...defaultConfiguration("pov"), hands: true },
    { ...defaultConfiguration("cinematic"), providerApiKey: "not-a-key" },
    { ...defaultConfiguration("interactive-3d"), durationSeconds: 60 },
  ])("does not silently accept extra settings: %j", (input) => {
    expect(parseConfiguration(input)).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_SETTING" } });
  });

  it.each([
    { mode: "pov", durationSeconds: 60, aspectRatio: "9:16", cameraPace: "balanced" },
    { mode: "cinematic", durationSeconds: 60, aspectRatio: "9:16", style: "soft", captions: false },
    { mode: "hybrid", durationSeconds: 60, aspectRatio: "9:16", povSharePercent: 25 },
    { mode: "hybrid", durationSeconds: 30, aspectRatio: "16:9", povSharePercent: 75 },
    { mode: "interactive-3d", quality: "detailed", daypart: "dusk" },
  ])("accepts supported non-default settings: %j", (input) => {
    expect(parseConfiguration(input)).toEqual({ ok: true, value: input });
  });

  it("does not coerce model-like or arbitrary strings to a mode", () => {
    expect(isGenerationMode("pov")).toBe(true);
    expect(isGenerationMode("GPT-6")).toBe(false);
    expect(isGenerationMode(undefined)).toBe(false);
  });
});
