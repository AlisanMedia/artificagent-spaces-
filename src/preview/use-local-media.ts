import { useEffect, useRef, useState } from "react";
import { preflightSelection } from "../features/platform/media-preflight";
import { MEDIA_CAPABILITIES } from "../domain/media-capabilities";

export interface LocalMedia {
  id: string;
  label: string;
  url: string | null;
  kind: "image" | "video";
  message: string;
}
/** In-memory, browser-only files. No storage, request, telemetry, ingestion approval or job. */
export function useLocalMedia() {
  const [media, setMedia] = useState<LocalMedia[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const current = useRef<LocalMedia[]>([]),
    owned = useRef(new Set<string>()),
    active = useRef(true),
    working = useRef(false);
  useEffect(() => {
    active.current = true;
    const urls = owned.current;
    return () => {
      active.current = false;
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
    };
  }, []);
  function commit(next: LocalMedia[]) {
    current.current = next;
    setMedia(next);
  }
  function release(m: LocalMedia | undefined) {
    if (m?.url && owned.current.delete(m.url)) URL.revokeObjectURL(m.url);
  }
  async function select(input: File[], replaceId?: string | null) {
    if (working.current || !input.length) return;
    if (replaceId && !current.current.some((m) => m.id === replaceId)) {
      setNotice(
        "Değiştirilecek dosya artık seçili değil. Yeniden ekleyebilirsin.",
      );
      return;
    }
    const files = replaceId ? input.slice(0, 1) : input;
    if (
      current.current.length + files.length - (replaceId ? 1 : 0) >
      MEDIA_CAPABILITIES.maxSelection
    ) {
      setNotice(
        "Bir seçimde en fazla 12 dosya ekleyebilirsin. Önce bir dosyayı kaldır.",
      );
      return;
    }
    working.current = true;
    setBusy(true);
    setNotice("");
    const entries: LocalMedia[] = [];
    try {
      for (const f of files) {
        const advice = await preflightSelection(f);
        let problem = advice.supported ? null : advice.message;
        if (!problem && f.type.startsWith("image/")) {
          const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
          const magic =
            f.type === "image/jpeg"
              ? b[0] === 255 && b[1] === 216 && b[2] === 255
              : f.type === "image/png"
                ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
                : String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
                  String.fromCharCode(...b.slice(8, 12)) === "WEBP";
          if (!magic)
            problem =
              "Dosyanın içeriği seçilen biçimle uyuşmuyor. Başka bir kopya seç.";
        }
        if (!active.current) break;
        const url = problem ? null : URL.createObjectURL(f);
        if (url) owned.current.add(url);
        entries.push({
          id: crypto.randomUUID(),
          label: f.name.slice(0, 100),
          url,
          kind: f.type.startsWith("video/") ? "video" : "image",
          message: problem ?? "Yalnız bu tarayıcıda · sunucuya gönderilmedi",
        });
      }
      if (active.current) {
        if (replaceId && entries[0]?.url) {
          release(current.current.find((m) => m.id === replaceId));
          commit(
            current.current.map((m) => (m.id === replaceId ? entries[0]! : m)),
          );
        } else if (replaceId) {
          setNotice("Değiştirme tamamlanamadı; önceki dosyan korunuyor.");
          commit([...current.current, ...entries].slice(0, 12));
        } else commit([...current.current, ...entries]);
      } else for (const e of entries) release(e);
    } catch {
      for (const e of entries) release(e);
      if (active.current)
        setNotice(
          "Dosya açılamadı. Seçtiklerin korunuyor; başka bir kopya seç.",
        );
    } finally {
      working.current = false;
      if (active.current) setBusy(false);
    }
  }
  function remove(id: string) {
    const next = current.current.filter((m) => m.id !== id);
    release(current.current.find((m) => m.id === id));
    commit(next);
    return next.length;
  }
  function reorder(id: string) {
    const i = current.current.findIndex((m) => m.id === id);
    if (i < 1) return;
    const next = [...current.current];
    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    commit(next);
  }
  function markUnreadable(id: string) {
    const item = current.current.find((m) => m.id === id);
    if (!item?.url) return;
    release(item);
    commit(
      current.current.map((m) =>
        m.id === id
          ? {
              ...m,
              url: null,
              message: "Bu dosya tarayıcıda açılamadı. Başka bir kopya seç.",
            }
          : m,
      ),
    );
  }
  function examples(items: LocalMedia[]) {
    if (working.current || current.current.length) return false;
    commit(items);
    setNotice("");
    return true;
  }
  return {
    media,
    busy,
    notice,
    setNotice,
    select,
    remove,
    reorder,
    markUnreadable,
    examples,
  };
}
