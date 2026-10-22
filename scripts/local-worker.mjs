// The Next process owns PGlite. This loopback-only scheduler never opens the same data directory twice.
const origin = "http://127.0.0.1:3000";
let running = true;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { running = false; });
const session = await fetch(origin + "/api/spaces/session", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ identityId: "demo-admin-a" }) });
if (!session.ok) throw new Error("Start the local Next app before the CPU scheduler.");
const cookie = session.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("No local scheduler session.");
console.log("Loopback synthetic scheduler started. No cloud/GPU/provider action; external spend USD 0.");
try {
  while (running) { const response = await fetch(origin + "/api/spaces/operations/drain", { method: "POST", headers: { Origin: origin, Cookie: cookie } }); if (!response.ok) throw new Error("Local scheduler rejected: HTTP " + response.status); await new Promise((done) => setTimeout(done, 2000)); }
} finally { await fetch(origin + "/api/spaces/session", { method: "DELETE", headers: { Origin: origin, Cookie: cookie } }).catch(() => {}); }
