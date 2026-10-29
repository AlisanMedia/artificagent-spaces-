"use client";
import { useState } from "react";
import type { PropertyVideoStyle } from "../../domain/real-estate-styles";
import { PROPERTY_STYLE_CARDS } from "../../domain/real-estate-styles";
import { sampleAsset, videoSample } from "./media";
export function VideoExample({
  style,
  compact = false,
  disclose = true,
}: {
  style: PropertyVideoStyle;
  compact?: boolean;
  disclose?: boolean;
}) {
  const sample = videoSample(style),
    [failed, setFailed] = useState(false);
  const source = sample && sampleAsset(sample.sourceId),
    video = sample && sampleAsset(sample.outputId),
    poster = sample && sampleAsset(sample.posterId);
  if (!sample || !source || !video || !poster || failed)
    return (
      <p role="alert">
        Bu tarzın örnek medyası açılamıyor. Başka bir tarz seçebilir veya daha
        sonra yeniden deneyebilirsin.
      </p>
    );
  return (
    <div className={`sc-video-example ${compact ? "is-compact" : ""}`}>
      {!compact && (
        <figure>
          <img
            src={source.url}
            width={source.width!}
            height={source.height!}
            alt={sample.alt}
            loading="lazy"
            onError={() => setFailed(true)}
          />
          <figcaption>
            {style === "exterior"
              ? "Özgün sentetik cephe çalışması"
              : "Örnek mülk · salon"}{" "}
            / kaynak fotoğraf
          </figcaption>
        </figure>
      )}
      <figure>
        <video
          key={video.id}
          controls
          playsInline
          preload="none"
          poster={poster.url}
          src={video.url}
          onError={() => setFailed(true)}
          aria-label={`${PROPERTY_STYLE_CARDS.find((s) => s.id === style)?.label} hazır sentetik örnek videosu`}
          width={video.width!}
          height={video.height!}
        />
        <figcaption>
          {video.width} × {video.height} · {video.durationSeconds} sn · H.264
          MP4 · sessiz
        </figcaption>
      </figure>
      {disclose && <p className="sc-disclosure">{sample.disclosure}</p>}
    </div>
  );
}
