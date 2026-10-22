"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Download, FileImage, FileText, ShieldCheck } from "lucide-react";
import { prepareLocalPreview } from "@/composition/local-runtime";
import { defaultConfiguration, getMode, MODE_DEFINITIONS } from "@/domain/modes";
import type { AssetId, GenerationConfiguration, GenerationMode, PreviewPlan, Property, PropertyId } from "@/domain/types";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, DemoNotice, ModeIcon } from "@/components/ui";

function SourcePicker({ property, selected, onChange }: {
  readonly property: Property; readonly selected: readonly AssetId[];
  readonly onChange: (ids: readonly AssetId[]) => void;
}) {
  return <fieldset className="source-fieldset"><legend>Kaynak görseller</legend>
    <p className="field-description">Bu akışta yalnız hazır sentetik görseller kullanılır.</p>
    <div className="source-list">{property.media.map((asset) => <label key={asset.id} className="source-choice">
      <input type="checkbox" checked={selected.includes(asset.id)} onChange={(event) => onChange(event.target.checked ? [...selected, asset.id] : selected.filter((id) => id !== asset.id))} />
      {asset.kind === "floor-plan" ? <FileText size={18} aria-hidden="true" /> : <FileImage size={18} aria-hidden="true" />}
      <span>{asset.label}<small>{asset.kind === "floor-plan" ? "Sentetik ölçülü plan" : "Sentetik illüstrasyon"}</small></span>
    </label>)}</div>
  </fieldset>;
}

function ConfigurationFields({ value, onChange }: {
  readonly value: GenerationConfiguration; readonly onChange: (value: GenerationConfiguration) => void;
}) {
  return <div className="settings-fields">
    {value.mode !== "interactive-3d" ? <div className="field-grid">
      <label className="field-label">Video planı süresi
        <select value={value.durationSeconds} onChange={(event) => onChange({ ...value, durationSeconds: event.target.value === "60" ? 60 : 30 })}><option value="30">30 saniye</option><option value="60">60 saniye</option></select>
      </label>
      <label className="field-label">Görüntü oranı
        <select value={value.aspectRatio} onChange={(event) => onChange({ ...value, aspectRatio: event.target.value === "9:16" ? "9:16" : "16:9" })}><option value="16:9">16:9 · Yatay</option><option value="9:16">9:16 · Dikey</option></select>
      </label>
    </div> : null}
    {value.mode === "pov" ? <label className="field-label">Kamera temposu
      <select value={value.cameraPace} onChange={(event) => onChange({ ...value, cameraPace: event.target.value === "balanced" ? "balanced" : "calm" })}><option value="calm">Sakin keşif</option><option value="balanced">Dengeli hareket</option></select>
      <span className="field-description">Göz hizası ve küçük kamera hareketleri. El veya nesne etkileşimi planlanmaz.</span>
    </label> : null}
    {value.mode === "cinematic" ? <>
      <label className="field-label">Görsel anlatım
        <select value={value.style} onChange={(event) => onChange({ ...value, style: event.target.value === "soft" ? "soft" : "editorial" })}><option value="editorial">Editorial · Sade ve etkili</option><option value="soft">Soft · Yumuşak ve dingin</option></select>
      </label>
      <label className="checkbox-field"><input type="checkbox" checked={value.captions} onChange={(event) => onChange({ ...value, captions: event.target.checked })} /><span>Başlık ve altyazı alanlarını plana ekle</span></label>
    </> : null}
    {value.mode === "hybrid" ? <label className="field-label">POV / sinematik dengesi
      <input type="range" min={25} max={75} step={25} value={value.povSharePercent} onChange={(event) => {
        const ratio = Number(event.target.value);
        onChange({ ...value, povSharePercent: ratio === 25 ? 25 : ratio === 75 ? 75 : 50 });
      }} aria-valuetext={"Yüzde " + value.povSharePercent + " POV"} />
      <span className="range-labels"><span>%{value.povSharePercent} POV</span><span>%{100 - value.povSharePercent} Cinematic</span></span>
    </label> : null}
    {value.mode === "interactive-3d" ? <div className="field-grid">
      <label className="field-label">Sahne detay planı
        <select value={value.quality} onChange={(event) => onChange({ ...value, quality: event.target.value === "detailed" ? "detailed" : "balanced" })}><option value="balanced">Dengeli</option><option value="detailed">Detaylı</option></select>
      </label>
      <label className="field-label">Başlangıç aydınlatması
        <select value={value.daypart} onChange={(event) => onChange({ ...value, daypart: event.target.value === "dusk" ? "dusk" : "day" })}><option value="day">Gündüz</option><option value="dusk">Akşamüstü</option></select>
      </label>
    </div> : null}
  </div>;
}

function downloadPlan(plan: PreviewPlan) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = plan.id + ".json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function PlanResult({ plan, property, onReset }: {
  readonly plan: PreviewPlan; readonly property: Property; readonly onReset: () => void;
}) {
  const [shot, setShot] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const activeShot = plan.shots[shot]!;
  const source = property.media.find((asset) => asset.id === activeShot.sourceAssetId);
  return <section className="plan-result" data-testid="preview-result" aria-labelledby="result-heading">
    <div className="result-heading"><span className="result-check"><CheckCheck size={25} aria-hidden="true" /></span><div><p className="eyebrow">YEREL PLAN HAZIR</p><h2 id="result-heading" ref={heading} tabIndex={-1}>{plan.mode === "interactive-3d" ? "Sahne taslağınız hazır." : "Hikâyenin ilk taslağı hazır."}</h2></div></div>
    <p className="result-disclosure" role="status">{plan.disclosure}</p>
    <div className="result-preview">
      <Image src={plan.mode === "interactive-3d" ? "/illustrations/floor-plan.svg" : source?.path ?? property.cover} alt="Gerçek çıktı olmayan sentetik plan önizlemesi" width={1200} height={760} unoptimized />
      <span className="preview-label">PLAN ÖNİZLEMESİ · {String(shot + 1).padStart(2, "0")} / 04</span>
    </div>
    <div className="storyboard">{plan.shots.map((item, index) => <button key={item.sequence} className={shot === index ? "storyboard-shot selected" : "storyboard-shot"} onClick={() => setShot(index)} aria-pressed={shot === index}>
      <span>{String(item.sequence).padStart(2, "0")}</span><strong>{item.roomLabel}</strong><small>{item.direction}</small>
    </button>)}</div>
    <ul className="result-checks">{plan.checks.map((check) => <li key={check}><Check size={15} aria-hidden="true" />{check}</li>)}</ul>
    <div className="result-actions"><Button onClick={() => downloadPlan(plan)}><Download size={16} aria-hidden="true" />Planı JSON olarak indir</Button><Link href="/reviews" className="button button-secondary">İnceleme alanı<ArrowRight size={16} aria-hidden="true" /></Link><Button variant="ghost" onClick={onReset}>Yeni taslak</Button></div>
  </section>;
}

function StudioFlow({ initialMode, initialPropertyId }: {
  readonly initialMode: GenerationMode; readonly initialPropertyId: string | undefined;
}) {
  const { scope, properties, savePlan } = useWorkspace();
  const initialProperty = properties.find((property) => property.id === initialPropertyId) ?? properties[0]!;
  const [configuration, setConfiguration] = useState(defaultConfiguration(initialMode));
  const [propertyId, setPropertyId] = useState(initialProperty.id);
  const [sources, setSources] = useState<readonly AssetId[]>(initialProperty.media.map((asset) => asset.id));
  const [step, setStep] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PreviewPlan | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const property = properties.find((item) => item.id === propertyId)!;
  const mode = getMode(configuration.mode);
  const blocked = configuration.mode === "interactive-3d" && property.evidenceClass !== "spatial-verified";

  function changeProperty(id: PropertyId) {
    const next = properties.find((item) => item.id === id);
    if (!next) return;
    setPropertyId(id);
    setSources(next.media.map((asset) => asset.id));
    setError(null);
  }

  function createPreview() {
    if (!acknowledged) return;
    const result = prepareLocalPreview(scope, { organizationId: scope.organizationId, propertyId, sourceAssetIds: sources, configuration });
    if (!result.ok) { setError(result.error.message); return; }
    savePlan(result.value);
    setPlan(result.value);
    setStep(4);
    setError(null);
  }

  function resetFlow() {
    setPlan(null); setStep(1); setAcknowledged(false); setError(null);
  }

  return <>
    <div className="page-topline"><span className="eyebrow">YARATICI STÜDYO</span><DemoNotice compact /></div>
    <div className="page-heading"><div><h1>Yeni bir perspektif.</h1><p>Bir mekân seçin. Anlatımınızı tasarlayın. Yerel planı inceleyin.</p></div></div>
    <ol className="wizard-steps" aria-label="Çalışma adımları">{["Mülk ve mod", "Yaratıcı ayarlar", "Kontrol ve önizleme"].map((label, index) => <li key={label} className={step > index + 1 ? "complete" : step === index + 1 ? "current" : ""} aria-current={step === index + 1 ? "step" : undefined}>
      <span>{step > index + 1 ? <Check size={14} aria-hidden="true" /> : "0" + (index + 1)}</span>{label}
    </li>)}</ol>
    {plan ? <PlanResult plan={plan} property={property} onReset={resetFlow} /> : <div className="studio-layout">
      <section className="studio-form" aria-labelledby="studio-step-heading">
        {step === 1 ? <>
          <p className="eyebrow">01 / BAŞLANGIÇ</p><h2 id="studio-step-heading" ref={heading} tabIndex={-1}>Mekânı nasıl anlatmak istersiniz?</h2><p className="form-intro">Her mod farklı bir bakış açısı. Hikâyenize uygun olanı seçin.</p>
          <fieldset className="mode-fieldset"><legend className="sr-only">Anlatım modu</legend><div className="mode-choice-grid">{MODE_DEFINITIONS.map((item) => <label key={item.id} className={"mode-choice" + (configuration.mode === item.id ? " selected" : "")}>
            <input type="radio" name="mode" value={item.id} checked={configuration.mode === item.id} onChange={() => { setConfiguration(defaultConfiguration(item.id)); setError(null); }} />
            <div className="mode-choice-top"><ModeIcon mode={item.id} /><span className="radio-indicator" /></div><strong>{item.name}</strong><span>{item.detail}</span>
          </label>)}</div></fieldset>
          <label className="field-label">Örnek mülk<select value={propertyId} onChange={(event) => changeProperty(event.target.value as PropertyId)}>{properties.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.reference}</option>)}</select></label>
          {blocked ? <div className="inline-notice" role="status"><ShieldCheck size={19} aria-hidden="true" /><p>Interactive 3D için örnek ölçülü plan gerekli. Atrium Loft veya Avlu Evi’ni seçin.</p></div> : null}
        </> : step === 2 ? <>
          <p className="eyebrow">02 / YARATICI YÖN</p><h2 id="studio-step-heading" ref={heading} tabIndex={-1}>{mode.name} akışını tasarlayın.</h2><p className="form-intro">{mode.description}</p>
          <ConfigurationFields value={configuration} onChange={setConfiguration} />
          <SourcePicker property={property} selected={sources} onChange={setSources} />
        </> : <>
          <p className="eyebrow">03 / SON BAKIŞ</p><h2 id="studio-step-heading" ref={heading} tabIndex={-1}>Hikâyenin çerçevesi hazır.</h2><p className="form-intro">Bu seçimler yalnız sentetik bir plan önizlemesi hazırlayacak.</p>
          <dl className="review-summary"><div><dt>Mülk</dt><dd>{property.name}</dd></div><div><dt>Anlatım</dt><dd>{mode.name}</dd></div><div><dt>Kaynaklar</dt><dd>{sources.length} sentetik görsel / plan</dd></div><div><dt>Çıktı</dt><dd>{mode.output} · JSON</dd></div><div><dt>Gerçek üretim ücreti</dt><dd>0 USD</dd></div></dl>
          <div className="inline-notice"><ShieldCheck size={19} aria-hidden="true" /><p>Video, gezilebilir 3D ve yayın bağlantısı oluşturulmaz. Yalnız yerel akışı inceleyebilirsiniz.</p></div>
          <label className="checkbox-field acknowledgment"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>Bu çalışmanın sentetik kaynaklarla hazırlanan yerel bir plan olduğunu anladım.</span></label>
        </>}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="wizard-actions">
          {step > 1 ? <Button variant="ghost" onClick={() => { setStep(step - 1); setError(null); }}><ArrowLeft size={16} aria-hidden="true" />Geri</Button> : <Link href="/properties" className="text-link">Mülkleri incele</Link>}
          {step < 3 ? <Button onClick={() => { setStep(step + 1); setError(null); }} disabled={blocked || (step === 2 && sources.length === 0)}>Devam et<ArrowRight size={16} aria-hidden="true" /></Button> : <Button onClick={createPreview} disabled={!acknowledged}>Yerel önizlemeyi hazırla<ArrowRight size={16} aria-hidden="true" /></Button>}
        </div>
      </section>
      <aside className="studio-summary" aria-label="Seçim özeti">
        <div className="summary-cover"><Image src={property.cover} alt={property.name + " sentetik illüstrasyonu"} width={1200} height={760} unoptimized /><span className="image-chip">SENTETİK MÜLK</span></div>
        <div className="summary-body"><span className="eyebrow">{property.reference}</span><h3>{property.name}</h3><p>{property.location} · {property.areaM2} m²</p><div className="summary-mode"><ModeIcon mode={configuration.mode} /><div><strong>{mode.name}</strong><span>{mode.detail}</span></div></div><dl><div><dt>Format</dt><dd>{"aspectRatio" in configuration ? configuration.aspectRatio : "Sahne planı"}</dd></div><div><dt>Kaynak</dt><dd>{sources.length} örnek</dd></div><div><dt>İnceleme</dt><dd>İnsan kontrolü</dd></div></dl><p className="summary-note">Taslaklar yalnız bu oturumda tutulur. Herhangi bir ödeme veya harici üretim başlatılmaz.</p></div>
      </aside>
    </div>}
  </>;
}

export function Studio({ initialMode = "pov", initialPropertyId }: {
  readonly initialMode?: GenerationMode; readonly initialPropertyId?: string | undefined;
}) {
  const { organization } = useWorkspace();
  return <StudioFlow key={organization.id} initialMode={initialMode} initialPropertyId={initialPropertyId} />;
}
