"use client";

import { useState } from "react";
import { Grid2X2, List, Search, SlidersHorizontal } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, DemoNotice, EmptyState, StudioLink } from "@/components/ui";

export function Properties({ initialQuery = "" }: { readonly initialQuery?: string }) {
  const { properties } = useWorkspace();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("Tümü");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const results = properties.filter((property) =>
    (category === "Tümü" || property.category === category) &&
    (property.name + " " + property.location + " " + property.reference).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr").trim()));

  return <>
    <div className="page-topline"><span className="eyebrow">MEKÂN KOLEKSİYONUNUZ</span><DemoNotice compact /></div>
    <div className="page-heading"><div><h1>Portföyünüz.</h1><p>Her mekân, anlatılmayı bekleyen yeni bir hikâye.</p></div><StudioLink /></div>
    <div className="property-toolbar">
      <div className="filter-tabs" role="group" aria-label="Mülk kategorisi">{["Tümü", "Daire", "Villa", "Konaklama"].map((item) => <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={category === item ? "active" : ""}>{item}{item === "Tümü" ? <span>{properties.length}</span> : null}</button>)}</div>
      <div className="property-tools"><label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Portföyde ara</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mülk adı veya konum..." maxLength={100} /></label><div className="layout-toggle" role="group" aria-label="Portföy görünümü"><button aria-label="Kart görünümü" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><Grid2X2 size={17} aria-hidden="true" /></button><button aria-label="Liste görünümü" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={19} aria-hidden="true" /></button></div></div>
    </div>
    <p className="results-count" role="status"><SlidersHorizontal size={14} aria-hidden="true" />{results.length} örnek mülk gösteriliyor</p>
    {results.length > 0 ? <div className={"property-grid" + (layout === "list" ? " list-view" : "")}>{results.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : <EmptyState title="Bu aramada bir mekân yok." description="Farklı bir mülk adı deneyin veya filtreleri temizleyin." action={<Button variant="secondary" onClick={() => { setQuery(""); setCategory("Tümü"); }}>Filtreleri temizle</Button>} />}
    <div className="bottom-notice"><DemoNotice /></div>
  </>;
}
