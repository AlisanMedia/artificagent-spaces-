import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

test("V01 studio → durable task → real1080p private MP4 → distinct reviewer → approved download, entirely offline", async ({
  page,
}, info) => {
  const root = String(info.config.metadata["privateFixtureRoot"]),
    fixture = JSON.parse(
      await readFile(join(root, "v01-offline-info.json"), "utf8"),
    );
  const origin = "http://127.0.0.1:3008",
    requests: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith(origin) &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      requests.push(new URL(r.url()).hostname);
  });
  expect(
    (
      await page.request.post("/api/spaces/session", {
        headers: { Origin: origin },
        data: { identityId: "demo-admin-a" },
      })
    ).ok(),
  ).toBe(true);
  await page.addInitScript(
    ({ propertyId }) =>
      localStorage.setItem("spaces-v3:demo-admin-a:studio", propertyId),
    fixture,
  );
  await page.goto("/spaces?service=video");
  await page.getByRole("button", { name: "Tarzını seç", exact: true }).click();
  const control = page.getByRole("region", {
    name: "Doğal Tur sağlayıcı testi",
  });
  await expect(control).toContainText("Gerçek AI üretimi yapılmaz");
  const mobileResume = info.project.name === "v01-mobile";
  if (mobileResume)
    await control
      .getByRole("link", { name: "Kayıtlı V01 çalışmasını aç" })
      .click();
  else
    await control
      .getByRole("button", { name: "Offline V01 akışını dene", exact: true })
      .click();
  await expect(page).toHaveURL(/\/spaces\/projects\//);
  const jobId = new URL(page.url()).pathname.split("/").at(-1)!;
  const path = `/api/spaces/jobs/${jobId}`;
  // App polls its own server; server polls exactly one saved provider task. No webhook or public deploy.
  await expect
    .poll(async () => (await (await page.request.get(path)).json()).state, {
      timeout: 20_000,
    })
    .toBe(mobileResume ? "approved" : "awaiting-review");
  const job = await (await page.request.get(path)).json();
  expect(job.output.width).toBe(1920);
  expect(job.output.height).toBe(1080);
  expect(job.output.kind).toBe("provider-contract-fixture");
  await expect(page.getByText(/Gerçek fal üretimi değildir/)).toBeVisible();
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((v: HTMLVideoElement) => ({
        width: v.videoWidth,
        height: v.videoHeight,
        duration: v.duration,
      })),
    )
    .toMatchObject({ width: 1920, height: 1080 });
  await video.evaluate((v: HTMLVideoElement) => v.play());
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  if (!mobileResume) {
    await expect(
      page.getByRole("button", { name: "İndir", exact: true }),
    ).toBeDisabled();
    expect(
      (
        await page.request.post(path + "/download-grant", {
          headers: { Origin: origin },
          data: {},
        })
      ).status(),
    ).toBe(403);
    const review = {
      decision: "approved",
      rights: true,
      evidence: true,
      continuity: true,
      disclosure: true,
      outputSha256: job.output.sha256,
    };
    expect(
      (
        await page.request.post(path + "/review", {
          headers: { Origin: origin },
          data: review,
        })
      ).status(),
    ).toBe(403);
    await page.reload();
    await expect(video).toBeVisible();
    await page.request.post("/api/spaces/session", {
      headers: { Origin: origin },
      data: { identityId: "demo-reviewer-a" },
    });
    const g = await (
      await page.request.post(path + "/review-grant", {
        headers: { Origin: origin },
        data: {},
      })
    ).json();
    expect(
      (
        await page.request.get(path + "/output", {
          headers: { "x-spaces-grant": g.token },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post(path + "/review", {
          headers: { Origin: origin },
          data: review,
        })
      ).ok(),
    ).toBe(true);
    await page.request.post("/api/spaces/session", {
      headers: { Origin: origin },
      data: { identityId: "demo-admin-a" },
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "İndir", exact: true }),
    ).toBeEnabled();
  }
  const grant = await (
    await page.request.post(path + "/download-grant", {
      headers: { Origin: origin },
      data: {},
    })
  ).json();
  const output = await page.request.get(path + "/output", {
    headers: { "x-spaces-grant": grant.token },
  });
  expect(output.headers()["content-type"]).toBe("video/mp4");
  expect(
    createHash("sha256")
      .update(await output.body())
      .digest("hex"),
  ).toBe(job.output.sha256);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "İndir", exact: true }).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.mp4$/);
  expect(
    (
      await page.request.post(path + "/publish", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(".spaces-local/v01-ui-evidence", {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(
    `.spaces-local/v01-ui-evidence/${info.project.name}-measurements.json`,
    JSON.stringify({
      mode: "offline-fixture",
      jobId,
      sourceSha256: fixture.sourceSha256,
      outputSha256: job.output.sha256,
      width: job.output.width,
      height: job.output.height,
      seconds: job.output.durationSeconds,
      separateReviewerRecorded: true,
      realProviderCalls: 0,
      externalSpendUsd: 0,
    }),
  );
  await page.screenshot({
    path: `.spaces-local/v01-ui-evidence/${info.project.name}-reviewed-result.png`,
    fullPage: true,
  });
  await page.request.post("/api/spaces/session", {
    headers: { Origin: origin },
    data: { identityId: "demo-admin-b" },
  });
  expect((await page.request.get(path)).status()).toBe(404);
  expect(
    (
      await page.request.get(path + "/output", {
        headers: { "x-spaces-grant": grant.token },
      })
    ).ok(),
  ).toBe(false);
  expect(requests).toEqual([]);
});
