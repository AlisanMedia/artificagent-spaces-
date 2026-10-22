import test from "node:test";
import assert from "node:assert/strict";
import { verifyGovernance } from "../../scripts/verify-repository.mjs";
function fixture() {
  const target = "AlisanMedia/artificagent-spaces-";
  return {
    repo: { full_name: target, visibility: "public", allow_merge_commit: true },
    ruleset: { id: 25460908, enforcement: "active", bypass_actors: [], conditions: { ref_name: { include: ["refs/heads/main"] } } },
    effective: [
      { type: "deletion" }, { type: "non_fast_forward" },
      { type: "pull_request", parameters: { required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, required_review_thread_resolution: true, allowed_merge_methods: ["merge"] } },
      { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: "Foundation acceptance", integration_id: 15368 }] } }
    ].map((rule) => ({ ...rule, ruleset_id: 25460908, ruleset_source: target }))
  };
}
test("full pre-merge verification requires visible true merge setting and an empty bypass list", () => { const f=fixture(); assert.equal(verifyGovernance(f.repo,f.ruleset,f.effective).result,"FULLY_VERIFIED"); });
test("read-only masked metadata is explicitly partial and cannot pass the full merge gate", () => { const f=fixture();delete f.repo.allow_merge_commit;delete f.ruleset.bypass_actors;const result=verifyGovernance(f.repo,f.ruleset,f.effective,"ci-visible");assert.equal(result.result,"PARTIAL_READ_ONLY");assert.equal(result.bypassActors,"NOT_VISIBLE_TO_READ_TOKEN");assert.throws(()=>verifyGovernance(f.repo,f.ruleset,f.effective),/full pre-merge metadata visibility/); });
test("visible disabled merge or any bypass actor fails in both modes", () => { for (const mode of ["full","ci-visible"]) { const f=fixture();f.repo.allow_merge_commit=false;assert.throws(()=>verifyGovernance(f.repo,f.ruleset,f.effective,mode));f.repo.allow_merge_commit=true;f.ruleset.bypass_actors=[{actor_id:1}];assert.throws(()=>verifyGovernance(f.repo,f.ruleset,f.effective,mode)); } });
test("rules merely configured but absent on effective main never pass",()=>{const f=fixture();assert.throws(()=>verifyGovernance(f.repo,f.ruleset,[],"ci-visible"),/effective/);});
test("wrong app/context, non-strict checks and weakened independent review each fail",()=>{for(const mutate of [(f)=>{f.effective[3].parameters.required_status_checks[0].integration_id=1;},(f)=>{f.effective[3].parameters.required_status_checks[0].context="Other";},(f)=>{f.effective[3].parameters.strict_required_status_checks_policy=false;},(f)=>{f.effective[2].parameters.required_approving_review_count=0;},(f)=>{f.effective[2].parameters.allowed_merge_methods=["squash"];},(f)=>{f.ruleset.enforcement="disabled";}]){const f=fixture();mutate(f);assert.throws(()=>verifyGovernance(f.repo,f.ruleset,f.effective,"ci-visible"));}});
