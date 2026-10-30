import { readdir, readFile } from "node:fs/promises";
import { join, resolve, relative, basename } from "node:path";

const buildRoot = resolve(".next");
const runtimeRoot = resolve(
  process.env["SPACES_LOCAL_DATA_DIR"] ?? ".spaces-local",
);
let manifests = 0;
let privateReferences = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith(".nft.json")) {
      manifests++;
      const trace = JSON.parse(await readFile(path, "utf8"));
      if (!Array.isArray(trace.files))
        throw new Error("BUILD_TRACE_FILES_REQUIRED");
      for (const file of trace.files) {
        const absolute = resolve(directory, file);
        const insideRuntime = relative(runtimeRoot, absolute);
        if (
          (!insideRuntime.startsWith("..") && !insideRuntime.startsWith("/")) ||
          file.split("/").includes(".spaces-local") ||
          (/^\.env(?:\.|$)/.test(basename(file)) &&
            basename(file) !== ".env.example")
        )
          privateReferences++;
      }
    }
  }
}
await walk(buildRoot);
if (manifests === 0 || privateReferences > 0) {
  throw new Error(
    `PRIVATE_RUNTIME_BUILD_TRACE_DENIED: ${privateReferences} private references in ${manifests} manifests`,
  );
}
console.log(
  `PASS: ${manifests} actual Next.js traces; zero private runtime or secret-env references. No deployment performed.`,
);
