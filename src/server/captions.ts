import sharp from "sharp";
import type { CaptionLayout } from "@/domain/video-quality";
import { invariant } from "@/domain/platform";
const escapeMarkup = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
/** Rasterized allowlisted text. Actual bitmap extent, no approximate character-width claims. */
export async function renderCaption(
  text: string,
  width: number,
  height: number,
) {
  invariant(
    text.length > 0 &&
      text.length <= 300 &&
      width >= 360 &&
      width <= 1920 &&
      height >= 360 &&
      height <= 1920,
    "INVALID_CAPTION",
  );
  const margin = Math.ceil(width * 0.05),
    padding = Math.ceil(Math.min(width, height) * 0.025),
    fontPixels = Math.max(16, Math.round(Math.min(width, height) * 0.045));
  const rendered = await sharp({
    text: {
      text: `<span foreground="#ffffff">${escapeMarkup(text)}</span>`,
      font: `DejaVu Sans ${fontPixels}`,
      fontfile: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      dpi: 72,
      width: width - 2 * margin - 2 * padding,
      wrap: "word-char",
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  const boxWidth = rendered.info.width + 2 * padding,
    boxHeight = rendered.info.height + 2 * padding;
  invariant(
    boxWidth <= width - 2 * margin && boxHeight <= height * 0.3,
    "CAPTION_LAYOUT_LIMIT",
  );
  const bitmap = await sharp({
    create: {
      width: boxWidth,
      height: boxHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: rendered.data, left: padding, top: padding }])
    .png()
    .toBuffer();
  const layout: CaptionLayout = {
    x: margin,
    y: height - Math.ceil(height * 0.1) - boxHeight,
    width: boxWidth,
    height: boxHeight,
    fontPixels,
    contrastRatio: 21,
    rasterized: true,
  };
  return { bitmap, layout };
}
