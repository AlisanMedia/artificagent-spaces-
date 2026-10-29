"use client";
import { useId, useState } from "react";
import { matchedComparison } from "../domain/showcase-selection";
import type { SampleAsset } from "../domain/showcase";

/** A real linked image transformation, never a fabricated video/3D comparison. Native range handles touch and keys. */
export function BeforeAfterSlider({
  before,
  after,
  source,
  disclosure,
}: {
  before: SampleAsset;
  after: SampleAsset;
  source: SampleAsset;
  disclosure: string;
}) {
  const [position, setPosition] = useState(50),
    [failed, setFailed] = useState(false),
    id = useId();
  if (!matchedComparison(before, after, source) || failed)
    return (
      <p role="alert">
        Bu karşılaştırmanın kaynakları doğrulanamadı. Örnek gösterilemiyor.
      </p>
    );
  return (
    <figure className="sc-comparison">
      <div
        className="sc-comparison-frame"
        style={{ aspectRatio: `${before.width} / ${before.height}` }}
      >
        <img
          src={before.url}
          width={before.width!}
          height={before.height!}
          alt="Örnek mülk salonu, kaynak görüntünün değişmeyen kadrajı"
          loading="lazy"
          onError={() => setFailed(true)}
        />
        <img
          className="sc-after-image"
          src={after.url}
          width={after.width!}
          height={after.height!}
          alt="Aynı kaynak ve kadraj; dosyaya uygulanan yerel ton ve netlik düzenlemesi"
          loading="lazy"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          onError={() => setFailed(true)}
        />
        <span className="sc-image-label sc-label-before">Önce</span>
        <span className="sc-image-label sc-label-after">Sonra</span>
        <span
          className="sc-comparison-line"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <span>↔</span>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="Önce ve sonra karşılaştırması"
          aria-valuetext={`Sonra görüntüsü yüzde ${position}`}
          aria-describedby={id}
        />
      </div>
      <figcaption id={id}>
        {disclosure}{" "}
        <span>Kaydır veya ok tuşlarını kullan. Home: önce, End: sonra.</span>
      </figcaption>
    </figure>
  );
}
