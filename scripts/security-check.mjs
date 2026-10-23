import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const next = join(path, entry.name);
    return entry.isDirectory() ? walk(next) : [next];
  }));
  return files.flat();
}
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
for (const [name, version] of Object.entries(dependencies)) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) failures.push("Dependency is not exact-pinned: " + name);
}
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
if (lock.lockfileVersion !== 3) failures.push("Expected npm lockfile version 3");
for (const [path, item] of Object.entries(lock.packages)) {
  if (path && (!item.integrity || !/^https:\/\/registry\.npmjs\.org\//.test(item.resolved ?? ""))) {
    failures.push("Missing integrity or non-registry dependency: " + path);
  }
}
const files = await walk(join(root, "src"));
for (const file of files) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = await readFile(file, "utf8");
  const path = relative(root, file).replaceAll("\\", "/");
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(source) && path !== "src/features/platform/client.ts") failures.push("Network primitive outside reviewed same-origin boundary: " + path);
  if (/\b(?:eval|Function)\s*\(|dangerouslySetInnerHTML|service_role|NEXT_PUBLIC_.*(?:KEY|SECRET|TOKEN)/.test(source)) failures.push("Unsafe content, execution or secret surface: " + path);
  if (/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}/.test(source)) failures.push("Potential credential: " + path);
  if (source.includes('"use client"') && /from\s+["'](?:node:|@\/server\/|@electric-sql\/|jose["'])/.test(source)) failures.push("Private server dependency in browser module: " + path);
  if (/\b(?:execSync|eval)\s*\(|(?<![.\w])exec\s*\(|shell:\s*true/.test(source)) failures.push("Shell or arbitrary code execution: " + path);
  if (source.includes('from "node:child_process"') && !["src/server/media.ts", "src/server/video-ingestion.ts", "src/server/video-quality.ts"].includes(path)) failures.push("Unexpected child process surface: " + path);
  if (path.startsWith("src/domain/") && /from\s+["'](?:react|next|@\/(?:features|components|fixtures|adapters|application|composition))/.test(source)) failures.push("Domain layer imports outward: " + path);
  if (path.startsWith("src/application/") && /from\s+["'](?:react|next|@\/(?:features|components|fixtures|adapters|composition))/.test(source)) failures.push("Application layer imports an implementation: " + path);
  if (path.startsWith("src/features/") && /from\s+["']@\/adapters\//.test(source)) failures.push("Feature bypasses composition boundary: " + path);
}
const client = await readFile(join(root, "src/features/platform/client.ts"), "utf8");
if (!client.includes('fetch("/api/spaces" + path') || !client.includes('credentials: "same-origin"')) failures.push("Client boundary must be same-origin and session bound");
const route = await readFile(join(root, "src/app/api/spaces/[...segments]/route.ts"), "utf8");
if (!route.includes("verifyLocalRequest(request)") || !route.includes('"BLOCKED_EXTERNAL_APPROVAL"')) failures.push("Local/API enablement gates missing");
const http = await readFile(join(root, "src/server/http.ts"), "utf8");
if (!http.includes("origin") || !http.includes("localhost") || !http.includes("HttpOnly")) failures.push("Loopback, origin or HttpOnly policy missing");
const nextConfig = await readFile(join(root, "next.config.ts"), "utf8");
for (const required of ["connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "payment=()", "remotePatterns: []"]) {
  if (!nextConfig.includes(required)) failures.push("Missing local-only browser policy: " + required);
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASS: pinned dependencies, lock integrity, same-origin browser API, private server/layer boundaries, no arbitrary shell/code, loopback/session and browser policies.");
  console.log("Static guardrails only; this is not a penetration test or an authentication/RLS guarantee.");
}
