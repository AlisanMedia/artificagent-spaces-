// Read-only verification; this script cannot change repository rules or permissions.
const base = "https://api.github.com/repos/AlisanMedia/artificagent-spaces-";
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env["GITHUB_TOKEN"] ? { Authorization: "Bearer " + process.env["GITHUB_TOKEN"] } : {}) };
async function get(path) { const response = await fetch(base + path, { headers }); if (!response.ok) throw new Error(`Governance read failed: HTTP ${response.status}`); return response.json(); }
const [repo, ruleset] = await Promise.all([get(""), get("/rulesets/25460908")]);
function requireRule(condition, name) { if (!condition) throw new Error("Governance mismatch: " + name); }
requireRule(repo.full_name === "AlisanMedia/artificagent-spaces-" && repo.visibility === "public", "exact public target");
requireRule(repo.allow_merge_commit, "merge commit available");
requireRule(ruleset.enforcement === "active" && ruleset.conditions.ref_name.include.includes("refs/heads/main"), "active main target");
requireRule(ruleset.bypass_actors.length === 0, "empty bypass list");
const rule = (type) => ruleset.rules.find((entry) => entry.type === type);
const pr = rule("pull_request")?.parameters, status = rule("required_status_checks")?.parameters;
requireRule(pr?.required_approving_review_count >= 1 && pr.dismiss_stale_reviews_on_push && pr.required_review_thread_resolution, "independent/stale/conversation review");
requireRule(pr.allowed_merge_methods?.length === 1 && pr.allowed_merge_methods[0] === "merge", "merge-only history");
requireRule(rule("deletion") && rule("non_fast_forward"), "no deletion/force push");
requireRule(status?.strict_required_status_checks_policy && status.required_status_checks.some((check) => check.context === "Foundation acceptance" && check.integration_id === 15368), "strict Foundation acceptance from GitHub Actions");
console.log(JSON.stringify({ repository: repo.full_name, rulesetId: ruleset.id, enforcement: ruleset.enforcement, requiredCheck: "Foundation acceptance", integrationId: 15368, bypassActors: 0, result: "PASS" }));
