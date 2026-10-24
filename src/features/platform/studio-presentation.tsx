import { Check, ArrowUpRight, Play } from "lucide-react";
import { VIDEO_STYLES } from "@/domain/video-styles";

export type VideoStyleId = (typeof VIDEO_STYLES)[number]["id"];
export function StudioWordmark() {
  return (
    <span className="studio-wordmark">
      <svg viewBox="0 0 32 36" fill="none" aria-hidden="true">
        <path
          d="M5 31V5h22v26M11 31V11h10v20M2 31h28"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span>
        <strong>ArtificAgent</strong>{" "}
        <span className="studio-wordmark-sub">SPACES</span>
      </span>
    </span>
  );
}

export function StudioSteps({
  step,
  onStep,
  canAdvance = false,
  disabled = false,
}: {
  step: number;
  onStep: (step: number) => void;
  canAdvance?: boolean;
  disabled?: boolean;
}) {
  return (
    <ol className="studio-steps" aria-label="İçerik oluşturma adımları">
      {["Medya", "Tarz", "Önizleme"].map((label, i) => (
        <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
          <button
            type="button"
            disabled={disabled || (i > 0 && !canAdvance)}
            onClick={() => onStep(i + 1)}
          >
            <span aria-hidden="true">
              {step > i + 1 ? (
                <Check size={13} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Real, rights-cleared video-frame posters. A style choice is not an active AI model. */
export function StudioStyleCards({
  value,
  onSelect,
  examples = "golden",
  disabled = false,
}: {
  value: string;
  onSelect: (mode: VideoStyleId) => void;
  examples?: "golden" | "illustration";
  disabled?: boolean;
}) {
  return (
    <fieldset className="studio-styles">
      <legend className="sr-only">Video tarzı</legend>
      {VIDEO_STYLES.map((s, i) => (
        <article
          className={`studio-style studio-style-${s.id} ${value === s.id ? "is-selected" : ""}`}
          key={s.id}
        >
          <label>
            <input
              type="radio"
              name="video-style"
              value={s.id}
              checked={value === s.id}
              onChange={() => onSelect(s.id)}
              disabled={disabled}
            />
            <span className="studio-style-image">
              <img
                src={`/studio-assets-v52/${examples === "golden" ? s.id + "-landscape" : "style-" + s.id}.webp`}
                width={640}
                height={360}
                loading="lazy"
                alt=""
              />
              <span className="studio-image-note">Sentetik örnek kare</span>
              <span className="studio-style-number" aria-hidden="true">
                0{i + 1}
              </span>
              {value === s.id && (
                <span className="studio-style-check" aria-hidden="true">
                  <Check size={18} />
                </span>
              )}
            </span>
            <span className="studio-style-copy">
              <strong>
                {s.label}
                <ArrowUpRight size={18} aria-hidden="true" />
              </strong>
              <span>{s.description}</span>
            </span>
          </label>
          {examples === "illustration" && (
            <details className="studio-style-preview">
              <summary>
                <Play size={13} aria-hidden="true" />
                Örnek videoyu izle
              </summary>
              <video
                controls
                playsInline
                preload="none"
                poster={`/studio-assets-v52/style-${s.id}.webp`}
                src={`/spaces-examples/${s.id === "pov" ? "natural" : s.id}.mp4`}
                aria-label={`${s.label} yerel örneği`}
              />
            </details>
          )}
        </article>
      ))}
    </fieldset>
  );
}
