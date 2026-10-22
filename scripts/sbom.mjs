import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const inventory = JSON.parse(await readFile("artifacts/dependency-licenses.json", "utf8"));
if (inventory.some((item) => item.license === "UNKNOWN")) throw new Error("License must be reviewed before SBOM export");
const { stdout } = await promisify(execFile)("npm", ["sbom", "--sbom-format", "cyclonedx", "--offline", "--ignore-scripts"], { maxBuffer: 8388608, timeout: 30000 });
const bom = JSON.parse(stdout);
if (bom.bomFormat !== "CycloneDX" || !bom.dependencies?.length || !bom.components?.length) throw new Error("Incomplete npm SBOM");
// Keep the standard component/dependency graph; omit generated identity/time for a reproducible public inventory.
delete bom.serialNumber;
delete bom.metadata.timestamp;
await writeFile("artifacts/sbom.cdx.json", JSON.stringify(bom, null, 2) + "\n");
console.log(JSON.stringify({ installedPaths: inventory.length, uniqueComponents: bom.components.length, graphNodes: bom.dependencies.length, unknownLicenses: 0 }));
