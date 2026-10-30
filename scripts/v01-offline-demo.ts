import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, writeFile, readFile, mkdtemp, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { PlatformRuntime } from "../src/server/runtime";
import { isolatedWorkerEnvironment } from "../src/server/media";
import { digest, newId } from "../src/server/crypto";
import {
  V01_MODEL,
  V01_PROFILE,
  V01Permit,
} from "../src/server/v01/authorization";
import { invariant } from "../src/domain/platform";

/** Only ephemeral offline permits can be generated here. There is no live permit signer or live account operation. */
export async function prepareV01OfflineDemo(root: string, maxRequests = 2) {
  const dir = resolve(root);
  invariant(
    dir.startsWith(resolve(".spaces-local") + sep),
    "V01_PRIVATE_DEMO_ROOT_REQUIRED",
  );
  await mkdir(dir, { recursive: true, mode: 0o700 });
  invariant(
    (await readdir(dir)).length === 0,
    "V01_FRESH_PRIVATE_ROOT_REQUIRED",
  );
  const rt = await PlatformRuntime.create(dir, false, false);
  try {
    const actor = await rt.db.actor("demo-admin-a", "studio");
    const p = await rt.properties.create(actor, {
      title: "V01 • Yalnız sentetik entegrasyon örneği",
      syntheticOnly: true,
    });
    await rt.properties.upload(
      actor,
      p.id,
      await readFile("public/golden-v5/living.png"),
      "photo",
      {
        syntheticOnly: true,
        ownedOrLicensed: true,
        metadataRemovalAccepted: true,
      },
    );
    const property = await rt.properties.get(actor, p.id),
      asset = (await rt.properties.assets(actor, p.id))[0]!;
    const source = rt.storage.path("studio", asset.id, "source");
    const output = join(dir, "v01-offline-output.mp4");
    await promisify(execFile)(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-loop",
        "1",
        "-i",
        source,
        "-t",
        "4",
        "-vf",
        "scale=2240:1260:in_range=pc:out_range=tv,crop=1920:1080:x=80+50*t:y=90,setsar=1,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
        "-r",
        "24",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "28",
        "-threads",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-color_range",
        "tv",
        "-x264-params",
        "colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off",
        "-map_metadata",
        "-1",
        "-an",
        "-movflags",
        "+faststart",
        "-fs",
        "8388608",
        "-n",
        output,
      ],
      { timeout: 45_000, maxBuffer: 65_536, env: isolatedWorkerEnvironment() },
    );
    const keys = generateKeyPairSync("ed25519"),
      now = Date.now();
    const permit = V01Permit.parse({
      version: "v01-owner-test-v1",
      id: newId(),
      mode: "offline-fixture",
      organizationId: "studio",
      propertyId: property.id,
      revision: property.revision,
      sourceSha256: asset.clean_hash,
      serviceId: "V01",
      model: V01_MODEL,
      profile: V01_PROFILE,
      durationSeconds: 4,
      aspectRatio: "16:9",
      maxRequests,
      maxPolls: 16,
      pollIntervalMs: 0,
      issuedAtMs: now - 1000,
      expiresAtMs: now + 1_800_000,
      submitWithinMs: 120_000,
      maxJobWallMs: 600_000,
      maxSourceBytes: 5_242_880,
      maxOutputBytes: 8_388_608,
      unitPriceMicroUsdPerSecond: 0,
      perRequestCapMicroUsd: 0,
      totalCapMicroUsd: 0,
      priceEvidenceSha256: digest("OFFLINE_ZERO_PRICE_NOT_A_VENDOR_QUOTE"),
      accountAccessVerified: false,
      syntheticOwnedSourceOnly: true,
      rightsAndRetentionApproved: false,
      providerHardCapAndOverageReviewed: false,
      transferMethod: "inline-base64-request-only",
      fixtureOutputSha256: digest(await readFile(output)),
    });
    const payload = Buffer.from(JSON.stringify(permit));
    await writeFile(
      join(dir, "v01-owner-test-permit.json"),
      JSON.stringify({
        payload: payload.toString("base64url"),
        signature: sign(null, payload, keys.privateKey).toString("hex"),
      }),
      { mode: 0o600, flag: "wx" },
    );
    const publicKey = keys.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    await writeFile(join(dir, "v01-approver-public.pem"), publicKey, {
      mode: 0o600,
      flag: "wx",
    });
    const info = {
      propertyId: property.id,
      revision: property.revision,
      assetId: asset.id,
      sourceSha256: asset.clean_hash,
      outputSha256: permit.fixtureOutputSha256,
      mode: "offline-fixture",
      externalSpendUsd: 0,
      realProviderCalls: 0,
    };
    await writeFile(join(dir, "v01-offline-info.json"), JSON.stringify(info), {
      mode: 0o600,
      flag: "wx",
    });
    return {
      ...info,
      publicKey,
      async signReconciliation(scope: {
        jobId: string;
        requestId: string;
        organizationId: string;
        sourceSha256: string;
        providerId: string;
      }) {
        const now = Date.now();
        const payload = Buffer.from(
          JSON.stringify({
            version: "v01-reconciliation-v1",
            ...scope,
            accountEvidenceSha256: digest(
              "OFFLINE_ACCOUNT_RECONCILIATION_NOT_VENDOR_PROOF",
            ),
            issuedAtMs: now,
            expiresAtMs: now + 120_000,
          }),
        );
        await writeFile(
          join(dir, "v01-reconciliation-proof.json"),
          JSON.stringify({
            payload: payload.toString("base64url"),
            signature: sign(null, payload, keys.privateKey).toString("hex"),
          }),
          { mode: 0o600 },
        );
      },
    };
  } finally {
    await rt.db.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const parent = resolve(".spaces-local", "v01-manual-demo");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const root =
    process.env["SPACES_V01_DEMO_ROOT"] ??
    (await mkdtemp(join(parent, "run-")));
  const info = await prepareV01OfflineDemo(root);
  if (process.argv.includes("--serve")) {
    console.log(
      JSON.stringify({
        mode: "OFFLINE_SYNTHETIC_ONLY",
        loopbackUrl: "http://127.0.0.1:3008/spaces?service=video",
        propertyTitle: "V01 • Yalnız sentetik entegrasyon örneği",
        privateRuntime: root,
        providerCalls: 0,
        externalSpendUsd: 0,
      }),
    );
    const child = spawn(
      process.execPath,
      ["scripts/next.mjs", "start", "--port", "3008"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          SPACES_LOCAL_DATA_DIR: root,
          SPACES_V01_APPROVER_PUBLIC_KEY: info.publicKey,
        },
      },
    );
    for (const signal of ["SIGTERM", "SIGINT"] as const)
      process.on(signal, () => child.kill(signal));
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  } else
    console.log(
      JSON.stringify({
        ...info,
        publicKey: "SERVER_PRIVATE_CONFIGURATION_ONLY_NOT_PRINTED",
      }),
    );
}
