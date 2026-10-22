import test from "node:test";
import assert from "node:assert/strict";
import { createPublicSummary } from "../../scripts/ci-summary.mjs";

function evidence() {
  const metric = { total: 1, covered: 1, pct: 100 };
  return {
    unit: { success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 },
    e2e: { stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 } },
    audit: { metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } },
    licenses: [{ license: "MIT" }], secrets: [],
    coverage: { total: { lines: metric, statements: metric, functions: metric, branches: metric } },
    headSha: "a".repeat(40), checkedSha: "b".repeat(40), runId: "123",
  };
}

test("untrusted test names, logs, links and package metadata never enter the public artifact", () => {
  const input = evidence();
  input.unit.testResults = [{ name: "PRIVATE BUSINESS TEXT", message: "PRIVATE BUSINESS TEXT" }];
  input.e2e.attachments = [{ path: "PRIVATE BUSINESS TEXT" }];
  input.licenses[0].author = "PRIVATE BUSINESS TEXT";
  const summary = createPublicSummary(input);
  assert.equal(JSON.stringify(summary).includes("PRIVATE BUSINESS TEXT"), false);
  assert.deepEqual(Object.keys(summary), ["schemaVersion", "headSha", "checkedSha", "runId", "unit", "browser", "secrets", "vulnerabilities", "licenses", "coreCoverage"]);
});
test("skipped or pending unit tests fail closed", () => {
  const input = evidence(); input.unit.numPendingTests = 1;
  assert.throws(() => createPublicSummary(input), /Unit evidence/);
});
test("skipped, failed and flaky browser results each fail closed", () => {
  for (const key of ["skipped", "unexpected", "flaky"]) {
    const input = evidence(); input.e2e.stats[key] = 1;
    assert.throws(() => createPublicSummary(input), /Browser evidence/);
  }
});
test("secret findings prevent a successful artifact", () => {
  const input = evidence(); input.secrets = [{ RuleID: "example" }];
  assert.throws(() => createPublicSummary(input), /Secret scan/);
});
test("unknown or unreviewed license strings cannot be published", () => {
  const input = evidence(); input.licenses = [{ license: "UNKNOWN" }];
  assert.throws(() => createPublicSummary(input), /Unreviewed license/);
});
test("high severity findings prevent success", () => {
  const input = evidence(); input.audit.metadata.vulnerabilities.high = 1;
  assert.throws(() => createPublicSummary(input), /severity gate/);
});
test("missing counts and arbitrary identity strings fail closed", () => {
  const missing = evidence(); delete missing.unit.numPassedTests;
  assert.throws(() => createPublicSummary(missing), /Invalid evidence count/);
  const input = evidence(); input.headSha = "PRIVATE BUSINESS TEXT";
  assert.throws(() => createPublicSummary(input), /Invalid evidence revision/);
});
