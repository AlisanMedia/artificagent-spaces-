"use client";

import { useState } from "react";
import { Check, RotateCcw, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, DemoNotice } from "@/components/ui";

export function Settings() {
  const { reducedMotion, setReducedMotion, reset, organization } = useWorkspace();
  const [message, setMessage] = useState("");
  return <>
    <div className="page-topline"><span className="eyebrow">SİZE UYGUN BİR ÇALIŞMA ALANI</span><DemoNotice compact /></div>
    <div className="page-heading"><div><h1>Küçük tercihler.</h1><p>Yerel önizlemeyi kendi ritminize göre ayarlayın.</p></div></div>
    <div className="settings-stack">
      <section className="settings-card"><div className="settings-card-heading"><div><h2>Görünüm ve erişilebilirlik</h2><p>Tercihler yalnız bu sekmede geçerlidir.</p></div></div><label className="preference-row"><span><strong>Hareketleri azalt</strong><small>Geçiş ve vurgu animasyonlarını azaltın. Sistem tercihiniz de dikkate alınır.</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label></section>
      <section className="settings-card"><div className="settings-card-heading"><div><h2>Örnek çalışma alanı</h2><p>Seçili koleksiyon: {organization.name}</p></div><ShieldCheck size={23} strokeWidth={1.5} aria-hidden="true" /></div><ul className="settings-checks"><li><Check size={15} aria-hidden="true" />Yalnız sentetik mülk ve görseller</li><li><Check size={15} aria-hidden="true" />Harici hesap veya üretim bağlantısı yok</li><li><Check size={15} aria-hidden="true" />Gerçek dosya yükleme ve ödeme yok</li></ul></section>
      <section className="settings-card"><div className="settings-card-heading"><div><h2>Yeni bir başlangıç</h2><p>Bu sekmedeki taslakları ve tercihleri sıfırlayın. Örnek portföy korunur.</p></div></div><Button variant="secondary" onClick={() => { reset(); setMessage("Yerel taslaklar ve tercihler sıfırlandı."); }}><RotateCcw size={16} aria-hidden="true" />Demoyu sıfırla</Button>{message ? <p className="settings-status" role="status">{message}</p> : null}</section>
    </div>
  </>;
}
