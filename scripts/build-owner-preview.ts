/** Isolated static allowlist. Does not copy/build Next API, auth, DB, runtime data or credentials. */
import { build } from "esbuild";
import { validateGoldenSource } from "../src/domain/golden-property";
import { verifyStudioAssets } from "./verify-studio-assets";
import { UX_PROTOCOL, UX_TASKS } from "../src/domain/usability-evaluation";
import {
  readFile,
  writeFile,
  mkdir,
  cp,
  readdir,
  mkdtemp,
  lstat,
} from "node:fs/promises";
import { join, basename, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = process.cwd(),
  base = join(root, ".spaces-local/preview-v5");
await mkdir(base, { recursive: true, mode: 0o700 });
const dir = await mkdtemp(join(base, "build-")),
  output = join(dir, ".vercel/output"),
  assets = join(output, "static/assets");
await mkdir(assets, { recursive: true });
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty =
  execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--untracked-files=normal",
      "--",
      "src",
      "fixtures/golden-v5",
      "public/golden-v5",
      "public/spaces-examples",
      "public/studio-assets-v52",
      "scripts/verify-studio-assets.ts",
      "scripts/build-owner-preview.ts",
      "package.json",
      "package-lock.json",
    ],
    {
      encoding: "utf8",
    },
  ).trim().length > 0;
const sceneSource = await readFile("fixtures/golden-v5/source.json");
validateGoldenSource(JSON.parse(sceneSource.toString()));
const goldenRecord = JSON.parse(
  await readFile("public/golden-v5/evidence.json", "utf8"),
) as { sourceSha256: string };
if (
  createHash("sha256").update(sceneSource).digest("hex") !==
  goldenRecord.sourceSha256
)
  throw Error("STATIC_SCENE_SOURCE_DRIFT");
await verifyStudioAssets(root);
const result = await build({
  entryPoints: ["src/preview/entry.tsx", "src/preview/evaluation-entry.tsx"],
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "linked",
  external: ["/studio-assets-v52/*"],
  entryNames: "studio-[hash]",
  chunkNames: "chunk-[hash]",
  outdir: assets,
  metafile: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    SPACES_PREVIEW_BUILD_ID: JSON.stringify(
      sourceHead + (dirty ? " · yerel değişiklikler" : ""),
    ),
  },
  logLevel: "warning",
});
for (const input of Object.keys(result.metafile.inputs))
  if (
    /(?:src\/server\/|@electric-sql\/|node_modules\/jose\/|node_modules\/next\/)/.test(
      input,
    )
  )
    throw Error("PRIVATE_SERVER_IMPORT_IN_PREVIEW");
const entry = Object.entries(result.metafile.outputs).find(
  ([, v]) => v.entryPoint === "src/preview/entry.tsx" && v.cssBundle,
);
if (!entry) throw Error("PREVIEW_ENTRY_MISSING");
const css = entry[1].cssBundle!;
for (const folder of ["golden-v5", "spaces-examples"]) {
  const src = join(root, "public", folder);
  const names = await readdir(src);
  const golden = JSON.parse(
    await readFile(join(root, "public/golden-v5/evidence.json"), "utf8"),
  ) as { files: { file: string; sha256: string }[] };
  const allowed =
    folder === "golden-v5"
      ? [...golden.files.map((f) => f.file), "evidence.json"]
      : ["natural.mp4", "cinematic.mp4", "hybrid.mp4", "interior.svg"];
  if (
    names.length !== allowed.length ||
    names.some((n) => !allowed.includes(n))
  )
    throw Error("UNREVIEWED_STATIC_FILE");
  if ((await lstat(src)).isSymbolicLink()) throw Error("STATIC_SYMLINK_DENIED");
  for (const file of names) {
    if (!/^[a-z0-9-]+\.(png|svg|glb|mp4|json)$/.test(file))
      throw Error("STATIC_ASSET_ALLOWLIST");
    if (!(await lstat(join(src, file))).isFile())
      throw Error("STATIC_FILE_ONLY");
    const expected = golden.files.find(
      (f) => folder === "golden-v5" && f.file === file,
    )?.sha256;
    if (
      expected &&
      createHash("sha256")
        .update(await readFile(join(src, file)))
        .digest("hex") !== expected
    )
      throw Error("STATIC_SOURCE_HASH_DRIFT");
  }
  await cp(src, join(output, "static", folder), { recursive: true });
}
await cp("public/studio-assets-v52", join(output, "static/studio-assets-v52"), {
  recursive: true,
});
await cp("src/app/icon.svg", join(output, "static/icon.svg"));
const eagerImports = entry[1].imports
  .filter((i) => i.kind === "import-statement" && !i.external)
  .map((i) => `<link rel="modulepreload" href="/assets/${basename(i.path)}">`)
  .join("");
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>ArtificAgent Spaces — Sentetik ürün önizlemesi</title><link rel="icon" href="/icon.svg"><link rel="stylesheet" href="/assets/${basename(css)}">${eagerImports}<link rel="preload" as="font" type="font/woff2" crossorigin href="/studio-assets-v52/manrope-latin-wght-normal.woff2"><link rel="preload" as="font" type="font/woff2" crossorigin href="/studio-assets-v52/manrope-latin-ext-wght-normal.woff2"></head><body><div id="root"></div><script type="module" src="/assets/${basename(entry[0])}"></script></body></html>`;
await writeFile(join(output, "static/index.html"), html);
await mkdir(join(output, "static/spaces"));
await writeFile(join(output, "static/spaces/index.html"), html);
const evaluationEntry = Object.entries(result.metafile.outputs).find(
  ([, v]) => v.entryPoint === "src/preview/evaluation-entry.tsx" && v.cssBundle,
);
if (!evaluationEntry?.[1].cssBundle) throw Error("EVALUATION_ENTRY_MISSING");
await mkdir(join(output, "static/evaluation"));
const evaluationImports = evaluationEntry[1].imports
  .filter((i) => i.kind === "import-statement" && !i.external)
  .map((i) => `<link rel="modulepreload" href="/assets/${basename(i.path)}">`)
  .join("");
let evaluationHtml = html
  .replaceAll(
    `/assets/${basename(entry[0])}`,
    `/assets/${basename(evaluationEntry[0])}`,
  )
  .replace(
    `/assets/${basename(css)}`,
    `/assets/${basename(evaluationEntry[1].cssBundle)}`,
  )
  .replace(
    "Sentetik ürün önizlemesi</title>",
    "Kullanım değerlendirmesi</title>",
  );
evaluationHtml = eagerImports
  ? evaluationHtml.replace(eagerImports, evaluationImports)
  : evaluationHtml.replace("</head>", evaluationImports + "</head>");
await writeFile(join(output, "static/evaluation/index.html"), evaluationHtml);
await writeFile(
  join(output, "static/evaluation/protocol.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      version: UX_PROTOCOL,
      tasks: UX_TASKS,
      plannedIndependentProfessionals: 5,
      genuineParticipants: null,
      acceptance: "NOT_RUN",
      customerDataCollection: false,
      uploads: false,
      submissionEndpoint: null,
    },
    null,
    2,
  ),
);
await writeFile(
  join(output, "static/robots.txt"),
  "User-agent: *\nDisallow: /\n",
);
await writeFile(
  join(output, "static/404.html"),
  '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Önizleme sınırı</title><p>Bu önizlemede uygulama API, özel tur, test kimliği ve yönetim ekranı yayınlanmaz.</p><a href="/spaces/">Stüdyoya dön</a></html>',
);
const headers = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "public, max-age=0, must-revalidate",
};
await writeFile(
  join(output, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/(.*)", headers, continue: true },
        {
          src: "/(.*)",
          methods: ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "CONNECT"],
          status: 405,
          dest: "/404.html",
        },
        {
          src: "/(?:api(?:/.*)?|spaces/manage(?:/.*)?|tour(?:/.*)?|\\.env.*|\\.git.*|\\.spaces-local.*)",
          status: 404,
          dest: "/404.html",
        },
        { handle: "filesystem" },
        { src: "/.*", status: 404, dest: "/404.html" },
      ],
    },
    null,
    2,
  ),
);
const files: { path: string; bytes: number; sha256: string }[] = [];
async function walk(path: string) {
  const entries = (await readdir(path, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const p = join(path, entry.name);
    if (entry.isDirectory()) await walk(p);
    else {
      const b = await readFile(p);
      files.push({
        path: relative(join(output, "static"), p),
        bytes: b.length,
        sha256: createHash("sha256").update(b).digest("hex"),
      });
    }
  }
}
await walk(join(output, "static"));
const configurationSha256 = createHash("sha256")
  .update(await readFile(join(output, "config.json")))
  .digest("hex");
if (files.reduce((n, f) => n + f.bytes, 0) > 16_000_000)
  throw Error("STATIC_PREVIEW_SIZE_LIMIT");
const manifest = {
  sourceHead,
  sourceDirty: dirty,
  buildSha256: createHash("sha256")
    .update(JSON.stringify({ files, configurationSha256 }))
    .digest("hex"),
  configurationSha256,
  buildHashScope:
    "config.json and static files, excluding self-describing build-manifest.json",
  files,
  serverFunctions: 0,
  privilegedApis: false,
  customerUploadTransport: false,
  liveProviders: false,
  paidInferenceMicroUsd: 0,
  deployed: false,
};
await writeFile(
  join(output, "static/build-manifest.json"),
  JSON.stringify(manifest, null, 2),
);
await writeFile(join(base, "latest-build.txt"), dir);
console.log(
  JSON.stringify({
    result: "STATIC_PREVIEW_READY_LOCAL",
    dir,
    sourceHead,
    sourceDirty: dirty,
    buildSha256: manifest.buildSha256,
    files: files.length,
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    serverFunctions: 0,
    deployed: false,
  }),
);
