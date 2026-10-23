"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import {
  Activity, ArrowUpRight, Bell, Building2, ChevronDown, ChevronRight, CircleHelp,
  Image as ImageIcon, LayoutDashboard, Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { ORGANIZATIONS } from "@/fixtures/properties";
import type { OrganizationId } from "@/domain/types";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui";

const NAVIGATION = [
  { href: "/", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/properties", label: "Mülkler", icon: Building2 },
  { href: "/library", label: "Görsel arşivi", icon: ImageIcon },
  { href: "/activity", label: "Çalışmalar", icon: Activity },
  { href: "/reviews", label: "İnceleme", icon: ShieldCheck },
];

function Brand() {
  return <Link href="/" className="brand" aria-label="ArtificAgent Spaces ana sayfa">
    <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 30 30" fill="none"><path d="m7 22 8-15 8 15M11 17h8" stroke="currentColor" strokeWidth="2.4" /><path d="m20 7 4 7" stroke="currentColor" strokeWidth="1.5" /></svg></span>
    <span><strong>ArtificAgent</strong><span className="brand-spaces">SPACES</span></span>
  </Link>;
}

function SidebarContent({ onNavigate }: { readonly onNavigate?: () => void }) {
  const pathname = usePathname();
  const { organization, switchOrganization, plans } = useWorkspace();
  return <>
    <Brand />
    <div className="workspace-select">
      <span className="workspace-avatar">{organization.initials}</span>
      <div className="workspace-select-body">
        <label htmlFor={onNavigate ? "mobile-workspace" : "desktop-workspace"}>Örnek çalışma alanı</label>
        <select id={onNavigate ? "mobile-workspace" : "desktop-workspace"} value={organization.id}
          onChange={(event) => { switchOrganization(event.target.value as OrganizationId); onNavigate?.(); }}>
          {ORGANIZATIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <ChevronDown size={14} aria-hidden="true" />
    </div>
    <p className="nav-label">ÇALIŞMA ALANI</p>
    <nav aria-label={onNavigate ? "Mobil gezinme" : "Ana gezinme"} className="main-nav">
      {NAVIGATION.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return <Link key={href} href={href} onClick={() => onNavigate?.()} className={active ? "nav-item active" : "nav-item"} aria-current={active ? "page" : undefined}>
          <Icon size={19} strokeWidth={1.65} aria-hidden="true" /><span>{label}</span>
          {href === "/activity" && plans.length > 0 ? <span className="nav-count">{plans.length}</span> : null}
        </Link>;
      })}
    </nav>
    <Link href="/studio" onClick={() => onNavigate?.()} className={pathname === "/studio" ? "studio-nav active" : "studio-nav"} aria-current={pathname === "/studio" ? "page" : undefined}>
      <Plus size={18} aria-hidden="true" />Yeni çalışma<span className="studio-nav-spark"><Sparkles size={14} aria-hidden="true" /></span>
    </Link>
    <div className="sidebar-bottom">
      <div className="sidebar-note">
        <span className="note-symbol" aria-hidden="true">⌑</span>
        <p>Bir mekân.<br /><strong>Dört farklı bakış.</strong></p>
        <Link href="/studio" onClick={() => onNavigate?.()}>Stüdyoyu keşfet<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
      <Link href="/settings" onClick={() => onNavigate?.()} className={pathname === "/settings" ? "nav-item active" : "nav-item"}><Settings2 size={18} aria-hidden="true" />Tercihler</Link>
      <div className="sidebar-foot"><span className="status-dot" aria-hidden="true" />Yerel demo<span>PHASE 01</span></div>
    </div>
  </>;
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const menu = useRef<HTMLDialogElement>(null);
  const updates = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const current = pathname === "/studio" ? "Yaratıcı stüdyo" : NAVIGATION.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.label ?? (pathname === "/settings" ? "Tercihler" : "Genel bakış");

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q");
    if (typeof query === "string") router.push("/properties?q=" + encodeURIComponent(query.trim()));
  }

  if (pathname.startsWith("/spaces") || pathname.startsWith("/tour/")) return <div className="spaces-shell"><a href="#main-content" className="skip-link">İçeriğe geç</a><header className="spaces-header"><Link href="/spaces" className="spaces-wordmark"><span aria-hidden="true">A↗</span> ArtificAgent <em>SPACES</em></Link><nav aria-label="Platform gezinme"><Link href="/spaces">Stüdyo</Link><Link href="/spaces/manage">Hesap ve yönetim</Link></nav><span className="spaces-pill">YEREL · SENTETİK · 0 USD</span></header><main id="main-content" tabIndex={-1}>{children}</main><footer className="spaces-footer">ARTIFICAGENT SPACES <span>Yerel örnek çalışma · İnternet yayını ve ödeme kapalı</span></footer></div>;

  return <div className="app-layout">
    <a href="#main-content" className="skip-link">İçeriğe geç</a>
    <aside className="desktop-sidebar" aria-label="Çalışma alanı menüsü"><SidebarContent /></aside>
    <dialog ref={menu} className="mobile-menu-dialog" aria-labelledby="mobile-menu-title">
      <div className="mobile-menu-close"><h2 id="mobile-menu-title" className="sr-only">Çalışma alanı menüsü</h2><Button variant="ghost" onClick={() => menu.current?.close()} aria-label="Menüyü kapat"><X size={22} /></Button></div>
      <SidebarContent onNavigate={() => menu.current?.close()} />
    </dialog>
    <div className="workspace-main">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" aria-label="Menüyü aç" onClick={() => menu.current?.showModal()}><Menu size={22} aria-hidden="true" /></button>
        <div className="breadcrumb"><span>Çalışma alanı</span><ChevronRight size={13} aria-hidden="true" /><strong>{current}</strong></div>
        <div className="topbar-actions">
          <form role="search" className="topbar-search" onSubmit={search}>
            <Search size={16} aria-hidden="true" /><input name="q" aria-label="Mülk ara" placeholder="Mülk ara..." autoComplete="off" maxLength={100} />
          </form>
          <button className="icon-button" aria-label="Kullanım rehberi" onClick={() => help.current?.showModal()}><CircleHelp size={19} strokeWidth={1.5} aria-hidden="true" /></button>
          <button className="icon-button notification-button" aria-label="Bildirimler" onClick={() => updates.current?.showModal()}><Bell size={19} strokeWidth={1.5} aria-hidden="true" /><span /></button>
          <Link href="/settings" className="profile-avatar" aria-label="Çalışma alanı tercihleri">AS</Link>
        </div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      <footer className="app-footer"><span>ARTIFICAGENT SPACES</span><Link href="/spaces">Çalışan yerel platformu aç ↗</Link><span>PHASE 01 / FOUNDATION ARŞİVİ</span></footer>
    </div>
    <dialog ref={updates} className="content-dialog" aria-labelledby="updates-title">
      <div className="dialog-heading"><h2 id="updates-title">Çalışma alanı notları</h2><Button variant="ghost" aria-label="Bildirimleri kapat" onClick={() => updates.current?.close()}><X size={20} /></Button></div>
      <div className="dialog-content"><p>Örnek portföyünüz keşfe hazır.</p><p className="muted">Dört moddan birini seçerek yerel bir plan önizlemesi hazırlayabilirsiniz. Hesap, ödeme veya harici üretim servisi bağlı değildir.</p></div>
    </dialog>
    <dialog ref={help} className="content-dialog" aria-labelledby="help-title">
      <div className="dialog-heading"><h2 id="help-title">İlk çalışmanız, üç adımda</h2><Button variant="ghost" aria-label="Rehberi kapat" onClick={() => help.current?.close()}><X size={20} /></Button></div>
      <ol className="help-steps"><li>Sentetik portföyden bir mülk seçin.</li><li>POV, Cinematic, Hybrid veya Interactive 3D akışını ayarlayın.</li><li>Yerel planı inceleyin; dilerseniz JSON olarak indirin.</li></ol>
      <p className="dialog-content muted">Taslaklar yalnız bu sekmenin belleğinde tutulur. Sayfa yenilendiğinde sıfırlanır.</p>
    </dialog>
  </div>;
}
