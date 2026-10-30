import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("default V01 UI and direct API cannot turn a local photo into a paid submission without signed permission", async ({
  page,
  baseURL,
}) => {
  await page.goto("/spaces?productionService=V01");
  const picker = page.getByLabel("Fotoğraf veya video seç");
  await expect(picker).toBeEnabled();
  await picker.setInputFiles({
    name: "owned-synthetic.png",
    mimeType: "image/png",
    buffer: readFileSync("public/golden-v5/living.png"),
  });
  await page
    .getByRole("checkbox", { name: /Bu dosyaları kullanma hakkım var/ })
    .check();
  await page
    .getByRole("button", { name: "Dosyaları güvenle yükle", exact: true })
    .click();
  await expect(
    page.getByText("Özel alana kaydedildi", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tarzını seç", exact: true }).click();
  const control = page.getByRole("region", {
    name: "Doğal Tur sağlayıcı testi",
  });
  await expect(control).toContainText("imzalı test izni henüz yok");
  await expect(
    control.getByRole("button", {
      name: "İzinli V01 testini başlat",
      exact: true,
    }),
  ).toBeDisabled();
  const workspace = await (
    await page.request.get("/api/spaces/workspace")
  ).json();
  // The real current draft is read from the existing private resume key, never inferred from a tenant selector.
  const id = await page.evaluate(() =>
    localStorage.getItem("spaces-v3:demo-admin-a:studio"),
  );
  expect(id).toBeTruthy();
  const draft = await (
    await page.request.get(`/api/spaces/properties/${id}`)
  ).json();
  const source = draft.assets.find((a: { kind: string }) => a.kind === "photo");
  const prepared = await page.request.post("/api/spaces/production/requests", {
    headers: { Origin: baseURL! },
    data: {
      propertyId: draft.property.id,
      revision: draft.property.revision,
      serviceId: "V01",
      sourceAssetIds: [source.id],
      options: { durationSeconds: 4, aspectRatio: "16:9" },
      rights: {
        syntheticOnly: true,
        ownedOrLicensed: true,
        conceptAccepted: false,
      },
      idempotencyKey: crypto.randomUUID(),
      maxCostMicroUsd: 0,
    },
  });
  expect(prepared.status()).toBe(201);
  const r = await prepared.json();
  expect(
    (
      await page.request.post(
        `/api/spaces/production/requests/${r.id}/v01-start`,
        { headers: { Origin: baseURL! }, data: {} },
      )
    ).status(),
  ).toBe(403);
  const after = await (await page.request.get("/api/spaces/workspace")).json();
  expect(
    after.jobs.filter(
      (j: { property_id: string }) => j.property_id === draft.property.id,
    ),
  ).toHaveLength(0);
  expect(after.accounts).toEqual(workspace.accounts);
  expect(
    (
      await (
        await page.request.get(`/api/spaces/production/requests/${r.id}`)
      ).json()
    ).state,
  ).toBe("awaiting-provider-approval");
});
