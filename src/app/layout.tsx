import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";
import "./platform.css";

export const metadata: Metadata = {
  title: { default: "ArtificAgent Spaces — Mekânlara yeni bir bakış", template: "%s · ArtificAgent Spaces" },
  description: "ArtificAgent Spaces yerel Phase 1 önizlemesi. Tamamı sentetik mülklerle dört yaratıcı anlatım akışı.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return <html lang="tr"><body><WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider></body></html>;
}
