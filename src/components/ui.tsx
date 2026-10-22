import Link from "next/link";
import { ArrowRight, Box, Camera, Clapperboard, Layers3, Plus } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { GenerationMode } from "@/domain/types";

export function ModeIcon({ mode, size = 22 }: { readonly mode: GenerationMode; readonly size?: number }) {
  const props = { size, strokeWidth: 1.55, "aria-hidden": true as const };
  switch (mode) {
    case "pov": return <Camera {...props} />;
    case "cinematic": return <Clapperboard {...props} />;
    case "hybrid": return <Layers3 {...props} />;
    case "interactive-3d": return <Box {...props} />;
  }
}

export function Button({
  variant = "primary", className = "", type = "button", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: "primary" | "secondary" | "ghost" }) {
  return <button type={type} className={"button button-" + variant + " " + className} {...props} />;
}

export function StudioLink({ children = "Yeni çalışma", href = "/studio", secondary = false }: {
  readonly children?: ReactNode; readonly href?: string; readonly secondary?: boolean;
}) {
  return <Link className={"button button-" + (secondary ? "secondary" : "primary")} href={href}>
    <Plus size={17} aria-hidden="true" />{children}
  </Link>;
}

export function SectionHeading({ title, eyebrow, action }: {
  readonly title: string; readonly eyebrow?: string; readonly action?: ReactNode;
}) {
  return <div className="section-heading">
    <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div>
    {action}
  </div>;
}

export function TextLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return <Link href={href} className="text-link">{children}<ArrowRight size={16} aria-hidden="true" /></Link>;
}

export function EmptyState({ title, description, action }: {
  readonly title: string; readonly description: string; readonly action?: ReactNode;
}) {
  return <div className="empty-state">
    <div className="empty-icon"><Box aria-hidden="true" size={27} strokeWidth={1.25} /></div>
    <h2>{title}</h2><p>{description}</p>{action}
  </div>;
}

export function DemoNotice({ compact = false }: { readonly compact?: boolean }) {
  return <p className={"demo-notice" + (compact ? " compact" : "")}>
    <span className="status-dot" aria-hidden="true" />
    {compact ? "Sentetik portföy · Yerel önizleme" : "Bu çalışma alanındaki tüm mülkler ve görseller sentetiktir. Gerçek veri yüklenmez; video veya 3D üretimi yapılmaz."}
  </p>;
}
