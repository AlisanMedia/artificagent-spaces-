import { CustomerShowcase } from "@/features/showcase/customer-showcase";
import type { StudioProduct } from "@/domain/real-estate-styles";
export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const p = (await searchParams).product;
  const initial: StudioProduct =
    p === "ai-3d" || p === "tour-360" ? p : "video";
  return <CustomerShowcase initialProduct={initial} />;
}
