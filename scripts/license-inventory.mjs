import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const entries = [];
for (const [path, record] of Object.entries(lock.packages)) {
  if (!path) continue;
  try {
    const manifest = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
    entries.push({ name: manifest.name, version: record.version, license: typeof manifest.license === "string" ? manifest.license : manifest.license?.type ?? "UNKNOWN", path });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/dependency-licenses.json", JSON.stringify(entries, null, 2) + "\n");
const counts = {};
for (const item of entries) counts[item.license] = (counts[item.license] ?? 0) + 1;
console.log(JSON.stringify({ installedPackages: entries.length, licenses: counts, unknown: entries.filter((item) => item.license === "UNKNOWN").map((item) => item.name) }, null, 2));
