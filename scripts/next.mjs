import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [command, ...arguments_] = process.argv.slice(2);
if (!["dev", "build", "start", "typegen"].includes(command)) {
  console.error("Only local Next.js lifecycle commands are allowed.");
  process.exit(1);
}
const cli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const args = [cli, command, ...arguments_];
if (command === "dev" || command === "start") args.push("--hostname", "127.0.0.1");
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
