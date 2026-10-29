import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  SERVICES,
  SERVICE_CATEGORIES,
  validateServiceCatalog,
} from "../src/domain/service-catalog";

const Page = z
  .object({
    url: z.url(),
    finalUrl: z.url(),
    status: z.literal(200),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedOn: z.literal("2026-10-29"),
  })
  .strict();
const Research = z
  .object({
    schemaVersion: z.literal(1),
    retrievedOn: z.literal("2026-10-29"),
    costUsd: z.literal(0),
    method: z.string().min(30),
    limitations: z.array(z.string()).min(4),
    sources: z
      .array(
        z
          .object({
            id: z.enum([
              "emlakvideo",
              "reele",
              "pedra",
              "reimaginehome",
              "applydesign",
              "styldod",
            ]),
            name: z.string().min(1),
            url: z.url(),
            verification: z.literal("PUBLIC_FIRST_PARTY_DESCRIPTION_ONLY"),
            observations: z.array(z.string()).min(2),
            pages: z.array(Page).min(1),
          })
          .strict(),
      )
      .length(6),
  })
  .strict();
validateServiceCatalog(SERVICES);
const record = Research.parse(
  JSON.parse(
    await readFile(
      "fixtures/service-catalog/competitors-2026-10-29.json",
      "utf8",
    ),
  ),
);
const officialHosts = new Map([
  ["emlakvideo", "emlakvideo.ai"],
  ["reele", "www.reel-e.ai"],
  ["pedra", "pedra.ai"],
  ["reimaginehome", "www.reimaginehome.ai"],
  ["applydesign", "www.applydesign.io"],
  ["styldod", "www.styldod.com"],
]);
const sourceIds = new Set<string>();
for (const source of record.sources) {
  if (sourceIds.has(source.id)) throw Error("DUPLICATE_COMPETITOR_SOURCE");
  sourceIds.add(source.id);
  const host = officialHosts.get(source.id);
  for (const address of [
    source.url,
    ...source.pages.flatMap((p) => [p.url, p.finalUrl]),
  ]) {
    const u = new URL(address);
    if (
      u.protocol !== "https:" ||
      u.hostname !== host ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      throw Error("UNVERIFIED_COMPETITOR_SOURCE");
  }
}
for (const service of SERVICES)
  if (service.sources.some((s) => s !== "owner-baseline" && !sourceIds.has(s)))
    throw Error("SERVICE_SOURCE_MISSING");
console.log(
  `PASS: ${SERVICES.length} service definitions / ${SERVICE_CATEGORIES.length} groups / 6 first-party sources. Six local/sample actions; other services planned, no inference entitlement.`,
);
