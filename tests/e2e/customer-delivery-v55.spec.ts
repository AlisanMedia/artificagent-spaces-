import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:3000";
async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  const r = await page.request.post("/api/spaces" + path, {
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), path + " " + r.status()).toBe(true);
  return r.json() as Promise<T>;
}
test("V5.5 result route keeps real private preview, independent review, tenant and stale-revision gates", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await post(page, "/session", { identityId: "demo-admin-a" });
  const p = await post<{ id: string }>(page, "/properties", {
    title: "Sentetik V5.5 teslim güvenliği",
    syntheticOnly: true,
  });
  await post(page, `/properties/${p.id}/fixture`, {});
  const detail = (await (
    await page.request.get(`/api/spaces/properties/${p.id}`)
  ).json()) as { property: { revision: number } };
  const j = await post<{ id: string }>(page, "/jobs", {
    propertyId: p.id,
    revision: detail.property.revision,
    mode: "cinematic",
    durationSeconds: 4,
    aspectRatio: "16:9",
    idempotencyKey: randomUUID(),
  });
  await page.goto(`/spaces/projects/${j.id}`);
  const preview = page.getByLabel("Projenin gerçek yerel video çıktısı");
  await expect(preview).toBeVisible({ timeout: 60000 });
  await expect
    .poll(() => preview.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  expect(
    await preview.evaluate((v) => (v as HTMLVideoElement).duration),
  ).toBeGreaterThan(3.9);
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeDisabled();
  const self = await page.request.post(`/api/spaces/jobs/${j.id}/review`, {
    headers: { Origin: origin },
    data: {
      decision: "approved",
      rights: true,
      evidence: true,
      continuity: true,
      disclosure: true,
    },
  });
  expect(self.status()).toBe(403);
  const ctx = await browser.newContext();
  try {
    const other = await ctx.newPage();
    await post(other, "/session", { identityId: "demo-admin-b" });
    await other.goto(`/spaces/projects/${j.id}`);
    await expect(
      other.locator(".v55-result-page").getByRole("alert"),
    ).toContainText("erişimin yok");
    await expect(
      other.getByText("Sentetik V5.5 teslim güvenliği", { exact: true }),
    ).toHaveCount(0);
    await expect(other.locator("video")).toHaveCount(0);
    expect((await other.request.get(`/api/spaces/jobs/${j.id}`)).status()).toBe(
      404,
    );
  } finally {
    await ctx.close();
  }
  const change = await page.request.patch(`/api/spaces/properties/${p.id}`, {
    headers: { Origin: origin },
    data: {
      expectedRevision: detail.property.revision,
      title: "Sentetik yeni sürüm",
    },
  });
  expect(change.ok()).toBe(true);
  await expect(
    page.getByText("Kaynak kontrolü gerekli", { exact: true }),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "İndir", exact: true }),
  ).toBeDisabled();
  const expired = await page.request.post(
    `/api/spaces/jobs/${j.id}/preview-grant`,
    { headers: { Origin: origin }, data: {} },
  );
  expect([403, 409]).toContain(expired.status());
  await page.reload();
  await expect(
    page.getByText("Kaynak kontrolü gerekli", { exact: true }),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
});
