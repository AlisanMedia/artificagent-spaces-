# V2.0 execution backlog — 2026-10-22

Standing owner authorization replaces per-phase development approvals. Work proceeds on feature branches; real external services remain disabled.

| Slice | Dependency | Concrete acceptance |
| --- | --- | --- |
| Tenant kernel | none | local PostgreSQL engine; RLS positive/negative reads/writes; forged org denied; CRUD revision immutable |
| Evidence/storage | tenant | magic/decode/sanitize/hash/quarantine; private local storage; expiry/revoke/tenant grant tests |
| Durable media | evidence | durable jobs/outbox/idempotency/fencing; valid MP4 in both ratios; cost reservation and ffprobe |
| Review/release | media | immutable reviewer decision; stale source invalidates release; signed private download |
| Parametric 3D | E2 manifest | Blender GLB export; verified geometry/collision graph; independent WASD/touch walk |
| Voice | release + 3D | shared template A/B isolation; deterministic transcripts/tools; signed adapter disabled; no live agent calls |
| Analytics/commerce | consent + release | dedup, opt-out/erase/retention; verified conversions only; credits atomic/no negative |
| Partner/brand | tenant | child assignment boundary; aggregate-only partner access; safe themes; fake domains local only |
| Hardening/CI | all | main push and stable Foundation acceptance; adversarial/browser/axe; public scan; PR queue |

Provider candidates are not verified winners. No model, rate, live pricing or terms are assumed from names in the authorization. Record documentation timestamps and disabled states; measure local outputs independently.
