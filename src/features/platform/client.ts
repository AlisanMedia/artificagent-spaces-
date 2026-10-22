"use client";

/** The browser can reach only the same-origin, loopback-only application boundary. */
export async function localRequest(path: string, init: RequestInit = {}) {
  if (!/^\/[a-z0-9/_?=&.%-]+$/i.test(path))
    throw new Error("INVALID_LOCAL_PATH");
  const response = await fetch("/api/spaces" + path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...init.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "LOCAL_REQUEST_FAILED";
    throw new Error(code);
  }
  return response;
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await localRequest(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  return response.json() as Promise<T>;
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const modeLabels = {
  pov: "POV keşif",
  cinematic: "Sinematik",
  hybrid: "Hibrit",
  "interactive-3d": "Serbest 3D",
} as const;
export const stateLabels: Record<string, string> = {
  queued: "Sırada",
  processing: "İşleniyor",
  "awaiting-review": "Bağımsız inceleme bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  failed: "Başarısız",
  cancelled: "İptal",
  "unknown-submission": "Gönderim belirsiz · durduruldu",
};
