import { ManagementDashboard } from "@/features/platform/dashboard";
export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const params = await searchParams;
  return (
    <ManagementDashboard
      initialPropertyId={
        /^[A-Za-z0-9_-]{1,80}$/.test(params.property ?? "")
          ? params.property
          : undefined
      }
    />
  );
}
