"use client";
import { Button, EmptyState } from "@/components/ui";
export default function ErrorPage({ reset }: { readonly reset: () => void }) {
  return <EmptyState title="Bu görünüm yüklenemedi." description="Yerel ekranı yeniden deneyebilirsiniz. Hiçbir harici iş veya ücretli işlem başlatılmadı." action={<Button onClick={reset}>Yeniden dene</Button>} />;
}
