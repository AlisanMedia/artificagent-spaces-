import { PropertyTour } from "@/features/platform/tour";
export default async function TourPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PropertyTour key={token} token={token} />;
}
