import { readFile } from "node:fs/promises";
import { benchmarkBudget } from "../src/domain/benchmark-budget";
const plan = JSON.parse(
  await readFile("config/provider-benchmark-v4.json", "utf8"),
);
console.log(
  JSON.stringify(
    {
      version: plan.version,
      ...benchmarkBudget(plan),
      execution: "NO_INFERENCE_OR_ACCOUNT_ACTION_IMPLEMENTED",
    },
    null,
    2,
  ),
);
