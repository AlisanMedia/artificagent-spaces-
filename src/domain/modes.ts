import type { GenerationConfiguration, GenerationMode } from "./types";

export const MODE_DEFINITIONS = [
  { id: "pov", name: "POV", label: "İçerideymiş gibi.", description: "Göz hizasında, sakin bir keşif. Mekânı doğal bir akışla anlatın.", detail: "Birinci şahıs keşif", number: "01", output: "Video planı" },
  { id: "cinematic", name: "Cinematic", label: "Her kare, bir hikâye.", description: "Özenli kadrajlar ve sinematik bir ritimle ilk izlenimi güçlendirin.", detail: "Sinematik sunum", number: "02", output: "Video planı" },
  { id: "hybrid", name: "Hybrid", label: "İki bakış, tek akış.", description: "Keşfin doğallığını sinematik çekimlerle aynı hikâyede buluşturun.", detail: "POV + sinematik", number: "03", output: "Video planı" },
  { id: "interactive-3d", name: "Interactive 3D", label: "Keşif sizin elinizde.", description: "Gezilebilir bir sahnenin oda, ışık ve görünüm planını hazırlayın.", detail: "Serbest keşif tasarımı", number: "04", output: "Sahne planı" },
] as const satisfies readonly {
  id: GenerationMode; name: string; label: string; description: string;
  detail: string; number: string; output: string;
}[];

export function getMode(mode: GenerationMode) {
  return MODE_DEFINITIONS.find((item) => item.id === mode)!;
}

export function isGenerationMode(value: unknown): value is GenerationMode {
  return MODE_DEFINITIONS.some((item) => item.id === value);
}

export function defaultConfiguration(mode: GenerationMode): GenerationConfiguration {
  switch (mode) {
    case "pov": return { mode, durationSeconds: 30, aspectRatio: "16:9", cameraPace: "calm" };
    case "cinematic": return { mode, durationSeconds: 30, aspectRatio: "16:9", style: "editorial", captions: true };
    case "hybrid": return { mode, durationSeconds: 30, aspectRatio: "16:9", povSharePercent: 50 };
    case "interactive-3d": return { mode, quality: "balanced", daypart: "day" };
  }
}
