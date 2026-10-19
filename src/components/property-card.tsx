import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin, MoveUpRight } from "lucide-react";
import type { Property } from "@/domain/types";

export const PROPERTY_STATUS_LABELS = {
  "review-ready": "İncelemeye hazır",
  draft: "Taslak",
  "evidence-needed": "Plan eksik",
} as const;

export function PropertyCard({ property }: { readonly property: Property }) {
  return <article className="property-card">
    <Link href={"/properties/" + property.id} className="property-cover" aria-label={property.name + " mülkünü incele"}>
      <Image src={property.cover} alt={property.name + " için sentetik mimari illüstrasyon"} fill unoptimized sizes="(max-width: 700px) 100vw, (max-width: 1200px) 45vw, 30vw" />
      <span className="image-chip">{property.category}</span>
      <span className="cover-arrow"><ArrowUpRight size={20} aria-hidden="true" /></span>
      <span className="image-watermark">SENTETİK GÖRSEL</span>
    </Link>
    <div className="property-info">
      <div className="property-name-row">
        <h3><Link href={"/properties/" + property.id}>{property.name}</Link></h3>
        <span className="reference">{property.reference}</span>
      </div>
      <p className="property-location"><MapPin size={13} aria-hidden="true" />{property.location}</p>
      <div className="property-meta"><span>{property.rooms}</span><span>{property.areaM2} m²</span><span>{property.media.length} görsel</span></div>
      <div className="property-card-footer">
        <span className={"status-label status-" + property.status}><span aria-hidden="true" />{PROPERTY_STATUS_LABELS[property.status]}</span>
        <Link className="small-link" href={"/studio?property=" + property.id} aria-label={property.name + " için çalışma başlat"}>Çalışma başlat<MoveUpRight size={13} aria-hidden="true" /></Link>
      </div>
    </div>
  </article>;
}
