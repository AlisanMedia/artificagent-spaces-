import { Properties } from "@/features/properties";
export const metadata = { title: "Portföyünüz" };
export default async function PropertiesPage({ searchParams }: {
  readonly searchParams: Promise<{ readonly q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  return <Properties key={query} initialQuery={query} />;
}
