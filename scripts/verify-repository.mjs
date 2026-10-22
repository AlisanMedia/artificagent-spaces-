import { pathToFileURL } from "node:url";
const target = "AlisanMedia/artificagent-spaces-";
export function verifyGovernance(repo, ruleset, effective, mode = "full") {
  const assert = (condition, name) => { if (!condition) throw new Error("Governance mismatch: " + name); };
  assert(["full", "ci-visible"].includes(mode), "verification mode");
  assert(repo.full_name === target && repo.visibility === "public", "exact public target");
  assert(ruleset.id === 25460908 && ruleset.enforcement === "active" && ruleset.conditions?.ref_name?.include.includes("refs/heads/main"), "active main target");
  const applied = effective.filter((entry) => entry.ruleset_id === 25460908 && entry.ruleset_source === target);
  const rule = (type) => applied.find((entry) => entry.type === type);
  const pr = rule("pull_request")?.parameters, status = rule("required_status_checks")?.parameters;
  assert(pr?.required_approving_review_count >= 1 && pr.dismiss_stale_reviews_on_push && pr.required_review_thread_resolution, "effective independent/stale/conversation review");
  assert(pr.allowed_merge_methods?.length === 1 && pr.allowed_merge_methods[0] === "merge", "effective merge-only history");
  assert(rule("deletion") && rule("non_fast_forward"), "effective deletion/force-push ban");
  assert(status?.strict_required_status_checks_policy && status.required_status_checks.some((check) => check.context === "Foundation acceptance" && check.integration_id === 15368), "effective strict Foundation acceptance / GitHub Actions");
  // GitHub masks these fields for read-only workflow tokens. Missing is UNKNOWN, never false or PASS.
  const mergeVisibility = typeof repo.allow_merge_commit === "boolean";
  const bypassVisibility = Array.isArray(ruleset.bypass_actors);
  if (mergeVisibility) assert(repo.allow_merge_commit === true, "merge commit available");
  if (bypassVisibility) assert(ruleset.bypass_actors.length === 0, "empty bypass list");
  if (mode === "full") assert(mergeVisibility && bypassVisibility, "full pre-merge metadata visibility required");
  return { repository: target, rulesetId: 25460908, mode, effectiveMainRules: "VERIFIED", requiredCheck: "Foundation acceptance", integrationId: 15368, mergeCommitAvailable: mergeVisibility ? true : "NOT_VISIBLE_TO_READ_TOKEN", bypassActors: bypassVisibility ? 0 : "NOT_VISIBLE_TO_READ_TOKEN", result: mergeVisibility && bypassVisibility ? "FULLY_VERIFIED" : "PARTIAL_READ_ONLY", fullPreMergeVerificationRequired: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = "https://api.github.com/repos/" + target;
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env["GITHUB_TOKEN"] ? { Authorization: "Bearer " + process.env["GITHUB_TOKEN"] } : {}) };
  async function get(path) { const response = await fetch(base + path, { headers }); if (!response.ok) throw new Error("Governance read failed: HTTP " + response.status); return response.json(); }
  const [repo, ruleset, effective] = await Promise.all([get(""), get("/rulesets/25460908"), get("/rules/branches/main")]);
  console.log(JSON.stringify(verifyGovernance(repo, ruleset, effective, process.argv.includes("--ci-visible") ? "ci-visible" : "full")));
}
