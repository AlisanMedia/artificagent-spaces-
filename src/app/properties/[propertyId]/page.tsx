import { notFound } from "next/navigation";
import { PropertyDetails } from "@/features/property-details";
import { SYNTHETIC_PROPERTIES } from "@/fixtures/properties";

export const metadata = { title: "Mülk ayrıntısı" };
export const dynamicParams = false;
export function generateStaticParams() { return SYNTHETIC_PROPERTIES.map((property) => ({ propertyId: property.id })); }
export default async function PropertyPage({ params }: { readonly params: Promise<{ readonly propertyId: string }> }) {
  const { propertyId } = await params;
  if (!SYNTHETIC_PROPERTIES.some((property) => property.id === propertyId)) notFound();
  return <PropertyDetails propertyId={propertyId} />;
}
