import Link from "next/link";
import { EmptyState } from "@/components/ui";
export default function NotFound() {
  return <EmptyState title="Bu sayfa portföyde yok." description="Bağlantı bir örnek mülke veya sayfaya ait değil. Çalışma alanınıza dönebilirsiniz." action={<Link href="/" className="button button-primary">Genel bakışa dön</Link>} />;
}
