"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowUpRight, FileText, Image as ImageIcon, X } from "lucide-react";
import type { MediaAsset } from "@/domain/types";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, DemoNotice } from "@/components/ui";

export function Library() {
  const { properties } = useWorkspace();
  const [filter, setFilter] = useState<"all" | "illustration" | "floor-plan">("all");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const assets = properties.flatMap((property) => property.media);
  const filtered = assets.filter((asset) => filter === "all" || asset.kind === filter);
  return <>
    <div className="page-topline"><span className="eyebrow">HİKÂYENİN BAŞLADIĞI YER</span><DemoNotice compact /></div>
    <div className="page-heading"><div><h1>Görsel arşivi.</h1><p>Görselleri ve planları birlikte görün. Her kaynağın yerini bilin.</p></div><span className="count-badge">{assets.length} SENTETİK KAYNAK</span></div>
    <div className="library-note"><ImageIcon size={21} aria-hidden="true" /><div><strong>Hazır bir örnek koleksiyon.</strong><p>Bu fazda dosya yükleme bulunmaz. Aşağıdaki tüm görseller uygulamayla birlikte gelen sentetik illüstrasyonlardır.</p></div></div>
    <div className="filter-tabs library-tabs" role="group" aria-label="Kaynak türü">{([{ id: "all", label: "Tüm kaynaklar" }, { id: "illustration", label: "Görseller" }, { id: "floor-plan", label: "Planlar" }] as const).map((item) => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    <div className="asset-grid library-grid">{filtered.map((asset) => <button className="asset-card" key={asset.id} onClick={() => { setSelected(asset); dialog.current?.showModal(); }}>
      <span className="asset-image"><Image src={asset.path} alt={asset.label + " sentetik illüstrasyonu"} width={1200} height={760} unoptimized /><span className="asset-kind">{asset.kind === "floor-plan" ? <FileText size={18} aria-hidden="true" /> : <ImageIcon size={18} aria-hidden="true" />}</span></span>
      <span className="asset-caption"><strong>{asset.label}</strong><span>{properties.find((property) => property.id === asset.propertyId)?.name}<ArrowUpRight size={14} aria-hidden="true" /></span></span>
    </button>)}</div>
    {filtered.length === 0 ? <p className="empty-state">Bu çalışma alanında örnek plan bulunmuyor.</p> : null}
    <dialog ref={dialog} className="asset-dialog" aria-labelledby="library-asset-title"><div className="dialog-heading"><h2 id="library-asset-title">{selected?.label ?? "Görsel"}</h2><Button variant="ghost" aria-label="Görseli kapat" onClick={() => dialog.current?.close()}><X size={20} /></Button></div>{selected ? <Image src={selected.path} alt={selected.label + " — sentetik örnek"} width={1200} height={760} unoptimized /> : null}<p>Yerel sentetik kaynak · Gerçek müşteri verisi içermez.</p></dialog>
  </>;
}
