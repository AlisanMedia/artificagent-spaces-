import { ProjectResult } from "@/features/platform/project-result";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(jobId))
    return <p>Bu çalışma bağlantısı geçerli değil.</p>;
  return <ProjectResult key={jobId} id={jobId} />;
}
