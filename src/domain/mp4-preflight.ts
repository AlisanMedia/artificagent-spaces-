/** Bounded ISO-BMFF hints only. No decoder, authorization, or claim of format acceptance. */
export interface Mp4Hints {
  codec: "h264" | "unsupported" | "unknown";
  color: "hdr" | "unknown";
  highBitDepth: boolean;
  width: number | null;
  height: number | null;
}
export function mp4Hints(bytes: Uint8Array): Mp4Hints {
  const hints: Mp4Hints = {
    codec: "unknown",
    color: "unknown",
    highBitDepth: false,
    width: null,
    height: null,
  };
  if (bytes.byteLength > 20_971_520) return hints;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  let count = 0;
  function boxes(start: number, end: number, depth: number): void {
    if (depth > 8) return;
    for (let offset = start; offset + 8 <= end && ++count <= 2048; ) {
      let size = view.getUint32(offset),
        header = 8;
      const type = text(offset + 4, 4);
      if (size === 1) {
        if (offset + 16 > end) return;
        const big = view.getBigUint64(offset + 8);
        if (big > BigInt(end - offset)) return;
        size = Number(big);
        header = 16;
      }
      if (size === 0) size = end - offset;
      if (size < header || offset + size > end) return;
      const payload = offset + header,
        stop = offset + size;
      if (["moov", "trak", "mdia", "minf", "stbl"].includes(type))
        boxes(payload, stop, depth + 1);
      if (type === "stsd" && payload + 8 <= stop)
        boxes(payload + 8, stop, depth + 1);
      if (["avc1", "avc3", "hvc1", "hev1", "vp09", "av01"].includes(type)) {
        hints.codec =
          type === "avc1" || type === "avc3" ? "h264" : "unsupported";
        if (offset + 86 <= stop) {
          hints.width = view.getUint16(offset + 32);
          hints.height = view.getUint16(offset + 34);
          boxes(offset + 86, stop, depth + 1);
        }
      }
      if (
        type === "avcC" &&
        payload + 2 <= stop &&
        [110, 122, 244].includes(view.getUint8(payload + 1))
      )
        hints.highBitDepth = true;
      if (
        type === "colr" &&
        payload + 10 <= stop &&
        text(payload, 4) === "nclx" &&
        (view.getUint16(payload + 4) === 9 ||
          [16, 18].includes(view.getUint16(payload + 6)))
      )
        hints.color = "hdr";
      offset = stop;
    }
  }
  boxes(0, bytes.length, 0);
  return hints;
}
