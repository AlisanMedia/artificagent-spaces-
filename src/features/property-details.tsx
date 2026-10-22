"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, FileText, MapPin, Maximize2, X } from "lucide-react";
import type { MediaAsset } from "@/domain/types";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, DemoNotice, EmptyState, SectionHeading, StudioLink } from "@/components/ui";
import { PROPERTY_STATUS_LABELS } from "@/components/property-card";

export function PropertyDetails({ propertyId }: { readonly propertyId: string }) {
  const { properties } = useWorkspace();
  const property = properties.find((item) => item.id === propertyId);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  if (!property) return <EmptyState title="Bu çalışma alanında görünmüyor." description="Bu örnek mülk farklı bir çalışma alanına ait olabilir. Menüden çalışma alanını değiştirebilir veya portföye dönebilirsiniz." action={<Link href="/properties" className="button button-secondary">Portföye dön</Link>} />;
  return <>
    <div className="detail-topline"><Link href="/properties" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Portföye dön</Link><DemoNotice compact /></div>
    <div className="page-heading detail-heading"><div><p className="eyebrow">{property.reference} / {property.category.toLocaleUpperCase("tr")}</p><h1>{property.name}</h1><p className="property-location"><MapPin size={16} aria-hidden="true" />{property.location}</p></div><StudioLink href={"/studio?property=" + property.id}>Çalışma başlat</StudioLink></div>
    <div className="detail-hero"><Image src={property.cover} alt={property.name + " için sentetik mimari illüstrasyon"} width={1200} height={760} priority unoptimized /><span className="image-chip">SENTETİK MİMARİ ÇALIŞMA</span><div className="detail-hero-caption"><span>{property.rooms} / {property.areaM2} m²</span><span>{PROPERTY_STATUS_LABELS[property.status]}</span></div></div>
    <div className="detail-columns">
      <section className="detail-description"><SectionHeading title="Mekânın hikâyesi" /><p>{property.description}</p><div className="evidence-summary"><span><Check size={16} aria-hidden="true" />{property.media.length} sentetik kaynak</span><span><FileText size={16} aria-hidden="true" />{property.evidenceClass === "spatial-verified" ? "Örnek ölçülü plan hazır" : "Ölçülü plan bulunmuyor"}</span></div></section>
      <aside className="detail-facts"><dl><div><dt>Referans</dt><dd>{property.reference}</dd></div><div><dt>Tür</dt><dd>{property.category}</dd></div><div><dt>Örnek alan</dt><dd>{property.areaM2} m²</dd></div><div><dt>Kaynak sınıfı</dt><dd>{property.evidenceClass === "spatial-verified" ? "Sentetik E2" : "Sentetik E1"}</dd></div></dl></aside>
    </div>
    <section className="content-section"><SectionHeading title="Görseller ve kaynaklar" eyebrow="KANITA BAĞLI ANLATIM" action={<span className="subtle-count">{property.media.length} KAYNAK</span>} /><div className="asset-grid">{property.media.map((asset) => <button key={asset.id} className="asset-card" onClick={() => { setSelectedAsset(asset); dialog.current?.showModal(); }}><span className="asset-image"><Image src={asset.path} alt={asset.label + " — sentetik örnek"} width={1200} height={760} unoptimized /><span className="asset-expand"><Maximize2 size={17} aria-hidden="true" /></span></span><span className="asset-caption"><strong>{asset.label}</strong><span>{asset.kind === "floor-plan" ? "Örnek plan" : "İllüstrasyon"}<ArrowUpRight size={14} aria-hidden="true" /></span></span></button>)}</div></section>
    <section className="content-section room-panel"><SectionHeading title="Örnek oda anotasyonları" /><div className="room-list">{property.roomLabels.map((room, index) => <div key={room}><span className="room-index">0{index + 1}</span><strong>{room}</strong><span>Sentetik anotasyon</span></div>)}</div><p className="field-description">Bu kayıtlar hazır fixture’lardır; gerçek bir mekân analizi veya ölçüm yapılmamıştır.</p></section>
    <dialog ref={dialog} className="asset-dialog" aria-labelledby="asset-title"><div className="dialog-heading"><h2 id="asset-title">{selectedAsset?.label ?? "Kaynak görsel"}</h2><Button variant="ghost" aria-label="Görseli kapat" onClick={() => dialog.current?.close()}><X size={21} /></Button></div>{selectedAsset ? <Image src={selectedAsset.path} alt={selectedAsset.label + " — sentetik örnek"} width={1200} height={760} unoptimized /> : null}<p>Sentetik kaynak · Gerçek bir mülke ait değildir.</p></dialog>
  </>;
}
