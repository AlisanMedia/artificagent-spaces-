import { z } from "zod";
import { PlatformError, invariant } from "@/domain/platform";

export function verifyLocalRequest(request: Request) {
  const url = new URL(request.url);
  invariant(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "LOCAL_ONLY_HOST",
    403,
  );
  // Next may normalize request.url to localhost; validate the actual HTTP Host as well.
  // Forwarded-* headers are deliberately ignored. Arbitrary hosts fail before any session/data access.
  const host = request.headers.get("host") ?? url.host;
  invariant(
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host),
    "LOCAL_ONLY_HOST",
    403,
  );
  const canonicalOrigin = new URL(url.protocol + "//" + host).origin;
  if (!["GET", "HEAD"].includes(request.method))
    invariant(
      request.headers.get("origin") === canonicalOrigin,
      "ORIGIN_DENIED",
      403,
    );
}
export async function limitedBody(request: Request, maxBytes: number) {
  invariant(
    Number(request.headers.get("content-length") ?? 0) <= maxBytes,
    "BODY_TOO_LARGE",
    413,
  );
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      invariant(total <= maxBytes, "BODY_TOO_LARGE", 413);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse(
      new TextDecoder().decode(await limitedBody(request, 65_536)),
    ) as unknown;
  } catch (error) {
    if (error instanceof PlatformError) throw error;
    throw new PlatformError("INVALID_JSON");
  }
}
export function cookie(request: Request, name: string) {
  const entry = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return undefined;
  }
}
export function responseJson(data: unknown, status = 200, setCookie?: string) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(setCookie ? { "Set-Cookie": setCookie } : {}),
    },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof PlatformError)
    return responseJson({ error: error.code }, error.status);
  if (error instanceof z.ZodError)
    return responseJson(
      {
        error: "INVALID_INPUT",
        fields: error.issues.map((i) => i.path.join(".")),
      },
      400,
    );
  return responseJson({ error: "LOCAL_OPERATION_FAILED" }, 500);
}
export const sessionCookie = (name: string, value: string, maxAge = 3600) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
