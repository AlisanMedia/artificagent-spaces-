/** Private local preparation/aggregation. Never recruits users, uploads responses or establishes independent acceptance. */
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  realpath,
  lstat,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import {
  emptyEvaluation,
  EvaluationRecord,
  PARTICIPANT_SLOTS,
  summarizeEvaluations,
  UX_PROTOCOL,
  UX_TASKS,
} from "../src/domain/usability-evaluation";
const args = process.argv.slice(2),
  action = args[0];
const argument = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const sourceHead =
  argument("--source-head") ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceHead))
  throw Error("EXACT_SOURCE_HEAD_REQUIRED");
const sourceDirty =
  execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--",
      "src",
      "scripts/build-owner-preview.ts",
      "package.json",
      "package-lock.json",
    ],
    { encoding: "utf8" },
  ).trim().length > 0;
const privateRoot = resolve(".spaces-local/usability-v53");
await mkdir(privateRoot, { recursive: true, mode: 0o700 });
if (action === "prepare") {
  const folder = await mkdtemp(join(privateRoot, "packet-"));
  await mkdir(join(folder, "responses"), { mode: 0o700 });
  const templates = PARTICIPANT_SLOTS.map((slot) =>
    emptyEvaluation(sourceHead, sourceDirty, slot),
  );
  for (const r of templates)
    await writeFile(
      join(folder, "responses", r.participantCode + ".json"),
      JSON.stringify(r, null, 2) + "\n",
      { mode: 0o600, flag: "wx" },
    );
  await writeFile(
    join(folder, "protocol.json"),
    JSON.stringify(
      {
        version: UX_PROTOCOL,
        sourceHead,
        sourceDirty,
        tasks: UX_TASKS,
        actualParticipants: null,
        humanAcceptance: "NOT_VERIFIED",
        retentionDaysProposed: 14,
        noContactOrRecording: true,
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(
    join(folder, "NOT_RUN.json"),
    JSON.stringify(summarizeEvaluations(templates, sourceHead), null, 2) + "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    JSON.stringify({
      result: "PREPARED_NOT_RUN",
      folder,
      plannedSlots: 5,
      actualParticipants: null,
      completedResponses: 0,
      externalSpendMicroUsd: 0,
    }),
  );
} else if (action === "summarize") {
  const input = argument("--input");
  if (!input) throw Error("PRIVATE_RESPONSE_DIRECTORY_REQUIRED");
  const base = await realpath(resolve(".spaces-local")),
    folder = await realpath(input);
  if (!folder.startsWith(base + sep) || (await lstat(input)).isSymbolicLink())
    throw Error("PRIVATE_RESPONSE_DIRECTORY_REQUIRED");
  const names = await readdir(folder);
  if (names.length > 5 || names.some((n) => !/^P0[1-5]\.json$/.test(n)))
    throw Error("FIVE_ALLOWLISTED_RESPONSES_ONLY");
  const records: unknown[] = [];
  for (const name of names) {
    const file = join(folder, name),
      stat = await lstat(file);
    if (!stat.isFile() || stat.size > 32768)
      throw Error("BOUNDED_RESPONSE_FILE_REQUIRED");
    const r = EvaluationRecord.parse(JSON.parse(await readFile(file, "utf8")));
    if (name !== r.participantCode + ".json")
      throw Error("PARTICIPANT_FILE_MISMATCH");
    records.push(r);
  }
  const summary = summarizeEvaluations(records, sourceHead),
    output = await mkdtemp(join(privateRoot, "summary-"));
  await writeFile(
    join(output, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      result: summary.status,
      output,
      eligibleSelfReportedRecords: summary.eligibleSelfReportedRecords,
      independentHumanAcceptance: summary.independentHumanAcceptance,
      realDeviceSafari: summary.realDeviceSafari,
    }),
  );
} else throw Error("USE_PREPARE_OR_SUMMARIZE");
