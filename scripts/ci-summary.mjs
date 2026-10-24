import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// These are reviewed inventory labels, not a legal approval of distribution.
const LICENSE_LABELS = new Set([
  "0BSD", "Apache-2.0", "(Apache-2.0 AND BSD-3-Clause)", "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
  "BSD-2-Clause", "BSD-3-Clause", "BlueOak-1.0.0", "CC-BY-4.0",
  "CC0-1.0", "ISC", "LGPL-3.0-or-later", "MIT", "MIT-0", "MPL-2.0",
]);

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid evidence count.");
  return value;
}

function sha(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value)) throw new Error("Invalid evidence revision.");
  return value;
}

export function createPublicSummary({ unit, e2e, preview, audit, licenses, secrets, coverage, headSha, checkedSha, runId }) {
  const unitTotal = count(unit.numTotalTests);
  const unitPassed = count(unit.numPassedTests);
  const unitFailed = count(unit.numFailedTests);
  const unitSkipped = count(unit.numPendingTests);
  const unitTodo = count(unit.numTodoTests);
  if (!unit.success || unitTotal === 0 || unitPassed !== unitTotal || unitFailed || unitSkipped || unitTodo) {
    throw new Error("Unit evidence is incomplete, failed, or skipped.");
  }
  const browser = Object.fromEntries(["expected", "skipped", "unexpected", "flaky"].map((key) => [key, count(e2e.stats[key])]));
  if (!browser.expected || browser.skipped || browser.unexpected || browser.flaky) {
    throw new Error("Browser evidence is incomplete, failed, skipped, or flaky.");
  }
  let previewBrowser;
  if (preview !== undefined) {
    if (!preview?.stats) throw new Error("Preview evidence is missing.");
    previewBrowser = Object.fromEntries(["expected", "skipped", "unexpected", "flaky"].map((key) => [key, count(preview.stats[key])]));
    if (!previewBrowser.expected || previewBrowser.skipped || previewBrowser.unexpected || previewBrowser.flaky)
      throw new Error("Preview evidence is incomplete, failed, skipped, or flaky.");
  }
  if (!Array.isArray(secrets) || secrets.length) throw new Error("Secret scan evidence is not clean.");
  const vulnerabilities = Object.fromEntries(["info", "low", "moderate", "high", "critical", "total"].map((key) => [key, count(audit.metadata.vulnerabilities[key])]));
  if (vulnerabilities.high || vulnerabilities.critical) throw new Error("Dependency audit exceeded the high severity gate.");
  if (!Array.isArray(licenses) || !licenses.length) throw new Error("License evidence is missing.");
  const licenseCounts = {};
  for (const item of licenses) {
    if (!LICENSE_LABELS.has(item.license)) throw new Error("Unreviewed license label in evidence.");
    licenseCounts[item.license] = (licenseCounts[item.license] ?? 0) + 1;
  }
  const coreCoverage = Object.fromEntries(["lines", "statements", "functions", "branches"].map((key) => {
    const metric = coverage.total[key];
    if (typeof metric.pct !== "number" || !Number.isFinite(metric.pct) || metric.pct < 0 || metric.pct > 100) throw new Error("Invalid coverage evidence.");
    return [key, { total: count(metric.total), covered: count(metric.covered), pct: metric.pct }];
  }));
  if (typeof runId !== "string" || !/^(local|[0-9]+)$/.test(runId)) throw new Error("Invalid run identity.");
  // Deliberate allowlist: no test names, source, logs, URLs, screenshots or traces.
  return {
    schemaVersion: previewBrowser ? 2 : 1, headSha: sha(headSha), checkedSha: sha(checkedSha), runId,
    unit: { total: unitTotal, passed: unitPassed, failed: unitFailed, skipped: unitSkipped, todo: unitTodo },
    browser, secrets: { findings: 0 }, vulnerabilities,
    licenses: { installed: licenses.length, unknown: 0, labels: licenseCounts }, coreCoverage,
    ...(previewBrowser ? { previewBrowser } : {}),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const json = async (path) => JSON.parse(await readFile(path, "utf8"));
  const [unit, e2e, audit, licenses, secrets, coverage, preview] = await Promise.all([
    json("artifacts/governance/unit.json"), json("test-results/e2e-results.json"),
    json("artifacts/governance/audit.json"), json("artifacts/dependency-licenses.json"),
    json("artifacts/governance/secrets.json"), json("coverage/coverage-summary.json"),
    json("test-results/preview/results.json"),
  ]);
  const summary = createPublicSummary({
    unit, e2e, preview, audit, licenses, secrets, coverage,
    headSha: process.env["CI_REVIEW_HEAD"], checkedSha: process.env["GITHUB_SHA"],
    runId: process.env["GITHUB_RUN_ID"] ?? "local",
  });
  await writeFile("artifacts/governance/public-ci-summary.json", JSON.stringify(summary, null, 2) + "\n");
  console.log("PASS: aggregate evidence only; no skipped/flaky tests or unreviewed artifact fields.");
}
