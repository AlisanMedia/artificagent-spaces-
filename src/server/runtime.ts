import { resolve, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { Database, openLocalDatabase } from "./database";
import { Secrets } from "./crypto";
import { IdentityService } from "./identity";
import { LocalPrivateStorage } from "./storage";
import { PropertyService } from "./properties";
import { JobService } from "./jobs";
import { ReleaseService } from "./releases";
import { AnalyticsService } from "./analytics";
import { VoiceService } from "./voice";
import { BrandService } from "./brands";
import { seedIdentity } from "./seed";
import { ProductionServiceEngine } from "./production/engine";
import { ProductionArtifactDelivery } from "./production/delivery";

export class PlatformRuntime {
  readonly identity: IdentityService;
  readonly properties: PropertyService;
  readonly jobs: JobService;
  readonly releases: ReleaseService;
  readonly analytics: AnalyticsService;
  readonly voice: VoiceService;
  readonly brands: BrandService;
  readonly production: ProductionServiceEngine;
  readonly productionDelivery: ProductionArtifactDelivery;
  constructor(
    readonly db: Database,
    readonly storage: LocalPrivateStorage,
    readonly secrets: Secrets,
  ) {
    this.identity = new IdentityService(db);
    this.properties = new PropertyService(db, storage);
    this.jobs = new JobService(db, this.properties, storage);
    this.releases = new ReleaseService(db, this.properties, this.jobs, secrets);
    this.analytics = new AnalyticsService(db, this.releases, secrets);
    this.voice = new VoiceService(db, this.releases, this.analytics, secrets);
    this.brands = new BrandService(db);
    this.production = new ProductionServiceEngine(db, this.properties);
    this.productionDelivery = new ProductionArtifactDelivery(
      db,
      this.properties,
      this.production,
      storage,
      secrets,
    );
  }
  static async create(root: string, memory = false, seedProperties = true) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const db = memory
      ? await new Database().ready()
      : await openLocalDatabase(root);
    await seedIdentity(db);
    const storageRoot = join(root, "private-objects");
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    const runtime = new PlatformRuntime(
      db,
      new LocalPrivateStorage(storageRoot),
      memory ? Secrets.ephemeral() : await Secrets.local(root),
    );
    if (seedProperties)
      for (const [organizationId, userId, id, title] of [
        ["studio", "demo-admin-a", "property-a", "Atrium • Ölçülü sentetik ev"],
        ["atelier", "demo-admin-b", "property-b", "Atelier • Sentetik ev B"],
      ] as const) {
        const actor = await db.actor(userId, organizationId);
        if (!(await runtime.properties.list(actor)).some((p) => p.id === id)) {
          await runtime.properties.create(
            actor,
            {
              title,
              description:
                "Yerel doğrulama için üretilmiş sentetik mülk. Gerçek adres veya müşteri verisi içermez.",
              syntheticOnly: true,
            },
            id,
          );
          await runtime.properties.applySyntheticPlan(actor, id);
        }
      }
    return runtime;
  }
}
const globalRuntime = globalThis as typeof globalThis & {
  spacesRuntimeV2?: Promise<PlatformRuntime>;
};
export function getRuntime() {
  globalRuntime.spacesRuntimeV2 ??= PlatformRuntime.create(
    resolve(
      /* turbopackIgnore: true */ process.env["SPACES_LOCAL_DATA_DIR"] ??
        join(process.cwd(), ".spaces-local"),
    ),
  );
  return globalRuntime.spacesRuntimeV2;
}
