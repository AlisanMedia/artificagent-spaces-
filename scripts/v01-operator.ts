import { createInterface } from "node:readline/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Agent, request as httpsRequest } from "node:https";
import { pathToFileURL } from "node:url";
import { invariant, PlatformError } from "../src/domain/platform";
import { PlatformRuntime } from "../src/server/runtime";
import {
  falSecretStatus,
  readFalSecret,
  readApproverPublicKey,
  readPrivateBinding,
} from "../src/server/v01/configuration";
import { FileV01Authority } from "../src/server/v01/authorization";
import {
  setupOperator,
  operatorConfig,
  applicationEnvironment,
  approvedScope,
  issuePermit,
  exists,
  SourceBinding,
  APPROVED_SOURCE,
} from "./v01-operator-core";

async function question(text: string) {
  invariant(
    process.stdin.isTTY && process.stdout.isTTY,
    "V01_OPERATOR_TTY_REQUIRED",
    403,
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(text)).trim();
  } finally {
    rl.close();
  }
}
/** No echo, argv secret or chat input. Restores the terminal on abort. */
async function hiddenSecret() {
  invariant(
    process.stdin.isTTY && process.stdout.isTTY,
    "V01_OPERATOR_TTY_REQUIRED",
    403,
  );
  process.stdout.write("FAL_KEY (gizli giriş; ekranda gösterilmez): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolveSecret, reject) => {
    let text = "";
    const clean = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (bytes: Buffer) => {
      for (const char of bytes.toString("utf8")) {
        if (char === "\u0003" || char === "\u001b") {
          clean();
          reject(new Error("V01_OPERATOR_INPUT_ABORTED"));
          return;
        }
        if (char === "\r" || char === "\n") {
          clean();
          resolveSecret(text);
          return;
        }
        if (char === "\u007f" || char === "\b") text = text.slice(0, -1);
        else if (char >= " " && char <= "~") text += char;
        if (text.length > 4096) {
          clean();
          reject(new Error("V01_OPERATOR_INPUT_LIMIT"));
          return;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}
function print(value: unknown) {
  console.log(JSON.stringify(value));
}
async function prepare(home: string) {
  const cfg = await operatorConfig(home),
    scope = await approvedScope(cfg.repositoryRoot);
  await mkdir(cfg.runtimeRoot, { recursive: true, mode: 0o700 });
  const bindingFile = join(cfg.runtimeRoot, "v01-source-binding.json");
  const previous = (await exists(bindingFile))
    ? SourceBinding.parse(JSON.parse(readPrivateBinding(bindingFile)))
    : null;
  invariant(
    previous || (await readdir(cfg.runtimeRoot)).length === 0,
    "V01_EXISTING_RUNTIME_MUST_NOT_BE_REPLACED",
    409,
  );
  const rt = await PlatformRuntime.create(cfg.runtimeRoot, false, false);
  try {
    const actor = await rt.db.actor("demo-admin-a", "studio");
    if (previous) {
      const p = await rt.properties.get(actor, previous.propertyId),
        a = (await rt.properties.assets(actor, p.id)).find(
          (x) => x.id === previous.assetId,
        );
      invariant(
        p.revision === previous.revision &&
          a?.clean_hash === APPROVED_SOURCE &&
          previous.authorizationSha256 === scope.sha256,
        "V01_SOURCE_BINDING_CHANGED",
        409,
      );
      return;
    }
    const p = await rt.properties.create(actor, {
      title: "V01 • Onaylı tek sentetik sağlayıcı testi",
      syntheticOnly: true,
    });
    await rt.properties.upload(
      actor,
      p.id,
      await readFile(join(cfg.repositoryRoot, "public/golden-v5/living.png")),
      "photo",
      {
        syntheticOnly: true,
        ownedOrLicensed: true,
        metadataRemovalAccepted: true,
      },
    );
    const property = await rt.properties.get(actor, p.id),
      asset = (await rt.properties.assets(actor, p.id))[0]!;
    invariant(
      asset.clean_hash === APPROVED_SOURCE,
      "V01_APPROVED_SOURCE_DRIFT",
      409,
    );
    await writeFile(
      bindingFile,
      JSON.stringify({
        organizationId: "studio",
        propertyId: p.id,
        revision: property.revision,
        assetId: asset.id,
        sourceSha256: asset.clean_hash,
        authorizationSha256: scope.sha256,
      }),
      { mode: 0o600, flag: "wx" },
    );
  } finally {
    await rt.db.close();
  }
}
/** Only documented free control-plane GETs. No inference, purchases, key listing or enterprise requirement. */
async function controlRead(path: string, key: string) {
  const allowed = [
    "/v1/models/pricing?endpoint_id=kling%2Fv4%2Fimage-to-video",
    "/v1/account/billing?expand=credits",
    "/v1/account/model-access-controls",
  ];
  invariant(allowed.includes(path), "V01_CONTROL_READ_PATH_DENIED", 403);
  const agent = new Agent({ proxyEnv: process.env, keepAlive: false });
  return new Promise<{ status: number; body: Buffer }>(
    (resolveRead, reject) => {
      const req = httpsRequest(
        new URL("https://api.fal.ai" + path),
        {
          agent,
          method: "GET",
          timeout: 20000,
          headers: { authorization: "Key " + key },
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          res.on("data", (b: Buffer) => {
            bytes += b.length;
            if (bytes > 524288)
              res.destroy(new Error("V01_CONTROL_READ_LIMIT"));
            else chunks.push(b);
          });
          res.on("end", () => {
            clearTimeout(timer);
            agent.destroy();
            resolveRead({
              status: res.statusCode ?? 0,
              body: Buffer.concat(chunks),
            });
          });
          res.on("error", () => {
            clearTimeout(timer);
            agent.destroy();
            reject(new Error("V01_CONTROL_READ_FAILED"));
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("V01_CONTROL_READ_TIMEOUT")),
        30000,
      );
      req.on("timeout", () => req.destroy());
      req.on("error", () => {
        clearTimeout(timer);
        agent.destroy();
        reject(new Error("V01_CONTROL_READ_FAILED"));
      });
      req.end();
    },
  );
}
export async function operatorMain(args: string[]) {
  const command = args[0] ?? "status";
  invariant(
    ["status", "setup", "prepare", "account", "issue", "serve"].includes(
      command,
    ),
    "V01_OPERATOR_COMMAND_DENIED",
    403,
  );
  const home = resolve(
    process.env["SPACES_V01_OPERATOR_HOME"] ??
      join(homedir(), ".local", "share", "artificagent-spaces-v01-operator"),
  );
  if (command === "status") {
    let cfg;
    try {
      cfg = await operatorConfig(home);
    } catch {
      /* No setup does not imply owner authorization is absent. */
    }
    const env = cfg ? applicationEnvironment(cfg, process.env) : process.env;
    let trust = false;
    try {
      trust = Boolean(readApproverPublicKey(env));
    } catch {
      /* fail closed */
    }
    let permit = false;
    if (cfg && trust)
      try {
        await new FileV01Authority(cfg.runtimeRoot, () =>
          readApproverPublicKey(env),
        ).load(Date.now());
        permit = true;
      } catch {
        /* expired/missing stays closed */
      }
    print({
      OWNER_AUTHORIZATION: "APPROVED_CONDITIONAL",
      maximumUsd: 10,
      FAL_KEY: falSecretStatus(env),
      APPROVER_TRUST: trust ? "CONFIGURED" : "MISSING",
      RUNTIME_PERMIT: permit ? "CONFIGURED" : "MISSING",
      MODEL_ACCESS: "NOT_VERIFIED",
      reviewerRequiredForGeneration: false,
      providerExecutedByThisCommand: false,
    });
    return;
  }
  if (command === "setup") {
    invariant(args.length <= 2, "V01_NO_SECRET_COMMAND_ARGUMENTS", 403);
    if (await exists(join(home, "app-config.json"))) {
      await operatorConfig(home);
      print({ setup: "CONFIGURED", overwritten: false });
      return;
    }
    const operatorId = await question(
      "Yetkili operatör kimliği (isim tek başına hesap doğrulaması sayılmaz): ",
    );
    const approvalReference = await question(
      "Owner/operatör kurulum yetkisi referansı (mevcut V5.8.1 onayı; yeni harcama onayı değil): ",
    );
    const approveKeySetup =
      (await question(
        "Yalnız bu kurulum için 'KURULUMU ONAYLIYORUM' yazın: ",
      )) === "KURULUMU ONAYLIYORUM";
    const existingPrivateKey = args[1] ? resolve(args[1]) : undefined;
    const trustedPublicKey = readApproverPublicKey();
    // Validate scope and manual setup approval before collecting a provider secret.
    await approvedScope(process.cwd());
    invariant(
      approveKeySetup,
      "V01_EXPLICIT_OPERATOR_SETUP_APPROVAL_REQUIRED",
      403,
    );
    const falKey =
      falSecretStatus() === "CONFIGURED" ? undefined : await hiddenSecret();
    const cfg = await setupOperator({
      home,
      repo: process.cwd(),
      operatorId,
      approvalReference,
      approveKeySetup,
      ...(existingPrivateKey ? { existingPrivateKey } : {}),
      ...(trustedPublicKey ? { trustedPublicKey } : {}),
      ...(falKey !== undefined ? { falKey } : {}),
      pinFingerprint: async (fingerprint) =>
        (await question(
          "Public verification fingerprint: " +
            fingerprint +
            "\nBu fingerprint'i trust olarak kaydetmek için aynen yazın: ",
        )) === fingerprint,
    });
    const templatePath = join(home, "evidence-template.json");
    await writeFile(
      templatePath,
      JSON.stringify(
        {
          version: "v581-operator-evidence-v1",
          authorizationSha256: cfg.authorizationSha256,
          accountReferenceSha256: null,
          verifiedByOperator: cfg.operatorId,
          reviewedAtMs: null,
          expiresAtMs: null,
          sourceSha256: APPROVED_SOURCE,
          model: "kling/v4/image-to-video",
          access: {
            state: "NOT_VERIFIED",
            method: "fal-support-confirmation",
            artifact: { file: "", sha256: null },
          },
          rights: {
            state: "NOT_VERIFIED",
            syntheticSourceTransferAndRetentionApproved: false,
            artifact: { file: "", sha256: null },
          },
          billing: {
            state: "NOT_VERIFIED",
            unitPriceMicroUsdPerSecond: null,
            maximumAdditionalLiabilityMicroUsd: null,
            newPurchaseMicroUsd: null,
            includesTaxFeesAndPartnerRetries: false,
            providerRetryAndFallbackConstraintsReviewed: false,
            artifact: { file: "", sha256: null },
          },
        },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    await prepare(home);
    print({
      setup: "CONFIGURED",
      FAL_KEY: falSecretStatus(applicationEnvironment(cfg, process.env)),
      RUNTIME_PERMIT: "MISSING",
      MODEL_ACCESS: "NOT_VERIFIED",
      publicTrustManuallyPinned: true,
      operatorIdentityVerifiedByTool: false,
      inferenceSubmits: 0,
    });
    return;
  }
  if (command === "prepare") {
    await prepare(home);
    print({ source: "CONFIGURED", inferenceSubmits: 0 });
    return;
  }
  const cfg = await operatorConfig(home),
    env = applicationEnvironment(cfg, process.env);
  if (command === "account") {
    const key = readFalSecret(env);
    const names: [string, string][] = [
      ["pricing", "/v1/models/pricing?endpoint_id=kling%2Fv4%2Fimage-to-video"],
      ["billing", "/v1/account/billing?expand=credits"],
    ];
    invariant(
      args.slice(1).every((a) => a === "--existing-enterprise-report"),
      "V01_OPERATOR_OPTION_DENIED",
      403,
    );
    if (args.includes("--existing-enterprise-report"))
      names.push(["access", "/v1/account/model-access-controls"]);
    const result: Record<string, unknown> = {
      MODEL_ACCESS: "NOT_VERIFIED",
      maximumTotalLiability: "UNKNOWN",
      inferenceSubmits: 0,
    };
    for (const [name, path] of names) {
      const response = await controlRead(path, key);
      result[name] =
        response.status === 200
          ? "READ_COMPLETED_NOT_AN_ENTITLEMENT_OR_CAP_GUARANTEE"
          : "NOT_VERIFIED";
      if (response.status === 200)
        await writeFile(
          join(home, name + "-read-" + Date.now() + ".txt"),
          response.body,
          { mode: 0o600, flag: "wx" },
        );
    }
    print(result);
    return;
  }
  if (command === "issue") {
    invariant(args.length === 2, "V01_PRIVATE_EVIDENCE_FILE_REQUIRED", 403);
    const evidence = JSON.parse(readPrivateBinding(resolve(args[1]!), 1048576));
    print(await issuePermit(home, evidence));
    return;
  }
  // Same Next application, existing routes and real gateway. No demo generator or offline signing helper is called.
  const permit = await new FileV01Authority(cfg.runtimeRoot, () =>
    readApproverPublicKey(env),
  ).load(Date.now());
  invariant(
    permit.permit.mode === "fal-live-test",
    "V01_OPERATIONAL_PERMIT_REQUIRED",
    403,
  );
  readFalSecret(env);
  const child = spawn(
    process.execPath,
    ["scripts/next.mjs", "start", "--port", "3008"],
    { env, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => child.kill(signal));
  await new Promise<void>((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
      resolveExit();
    });
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  operatorMain(process.argv.slice(2)).catch((error) => {
    // Never print arbitrary filesystem/provider errors, submitted values, key paths, payloads or stack traces.
    const code =
      error instanceof PlatformError
        ? error.code
        : "V01_OPERATOR_CONFIGURATION_OR_INPUT_FAILED";
    print({ status: "MISSING", code });
    process.exitCode = 1;
  });
}
