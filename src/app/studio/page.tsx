import { Studio } from "@/features/studio";
import { isGenerationMode } from "@/domain/modes";

export const metadata = { title: "Yaratıcı stüdyo" };
export default async function StudioPage({ searchParams }: {
  readonly searchParams: Promise<{ readonly mode?: string | string[]; readonly property?: string | string[] }>;
}) {
  const params = await searchParams;
  const mode = isGenerationMode(params.mode) ? params.mode : "pov";
  const propertyId = typeof params.property === "string" ? params.property : undefined;
  return <Studio key={mode + (propertyId ?? "")} initialMode={mode} initialPropertyId={propertyId} />;
}
