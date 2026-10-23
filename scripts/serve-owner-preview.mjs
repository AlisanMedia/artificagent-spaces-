/** Serves only the static allowlist on loopback. Never mounts application API or filesystem roots. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
export async function previewServer(buildRoot, port = 3100) {
  const root = resolve(buildRoot, ".vercel/output/static"),
    config = JSON.parse(
      await readFile(join(buildRoot, ".vercel/output/config.json"), "utf8"),
    );
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".glb": "model/gltf-binary",
    ".json": "application/json",
    ".txt": "text/plain",
  };
  const server = createServer(async (req, res) => {
    for (const [k, v] of Object.entries(config.routes[0].headers))
      res.setHeader(k, v);
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://127.0.0.1").pathname,
      );
      if (
        /^\/(?:api(?:\/|$)|spaces\/manage(?:\/|$)|tour(?:\/|$)|\.env|\.git|\.spaces-local)/.test(
          path,
        )
      )
        throw Error("BLOCKED_ROUTE");
      let file = resolve(root, "." + path);
      if (file !== root && !file.startsWith(root + "/"))
        throw Error("OUTSIDE_STATIC_ROOT");
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const b = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
      });
      res.end(req.method === "HEAD" ? undefined : b);
    } catch {
      res
        .writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
        .end(await readFile(join(root, "404.html")));
    }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return server;
}
if (process.argv[1]?.endsWith("serve-owner-preview.mjs")) {
  const build = (
    await readFile(".spaces-local/preview-v5/latest-build.txt", "utf8")
  ).trim();
  await previewServer(build);
  console.log("Static synthetic preview only: http://127.0.0.1:3100/spaces/");
}
