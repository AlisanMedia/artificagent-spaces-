import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { StudioWordmark } from "../features/platform/studio-presentation";
import {
  emptyEvaluation,
  exportEvaluation,
  PARTICIPANT_SLOTS,
  UX_ISSUES,
  UX_OUTCOMES,
  UX_TASKS,
  type Evaluation,
  type TaskResult,
} from "../domain/usability-evaluation";
import "../app/studio-visual.css";
import "./evaluation.css";
declare const SPACES_PREVIEW_BUILD_ID: string;
const sourceHead = SPACES_PREVIEW_BUILD_ID.slice(0, 40);
const dirty = SPACES_PREVIEW_BUILD_ID.includes(" · ");
const outcomeLabels = {
  SUCCESS_UNASSISTED: "Yardım almadan tamamladı",
  SUCCESS_ASSISTED: "Yardımla tamamladı",
  FAILED: "Tamamlayamadı",
  NOT_ATTEMPTED: "Denenmedi",
};
const issueLabels = {
  CONTROL_NOT_FOUND: "Kontrol bulunamadı",
  UNCLEAR_COPY: "Açıklama anlaşılmadı",
  MEDIA_NOT_PLAYING: "Video oynatılamadı",
  NAVIGATION_DIFFICULT: "Gezinme zor geldi",
  ACCESSIBILITY: "Erişilebilirlik sorunu",
  LOADING_OR_ERROR: "Yükleme / hata",
  CAPABILITY_MISUNDERSTANDING: "Ürünün yaptığı yanlış anlaşıldı",
};
function EvaluationForm() {
  const [record, setRecord] = useState<Evaluation>(() =>
    emptyEvaluation(sourceHead, dirty),
  );
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const started = useRef(0),
    form = useRef<HTMLFormElement>(null),
    download = useRef<HTMLAnchorElement>(null);
  function updateTask(index: number, patch: Partial<TaskResult>) {
    setRecord((r) => ({
      ...r,
      tasks: r.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      completion: "DRAFT",
    }));
    setNotice("");
  }
  function clear() {
    setActive(null);
    started.current = 0;
    setRecord(emptyEvaluation(sourceHead, dirty, record.participantCode));
    setNotice(
      "Form temizlendi. Bu sayfada yanıt tutulmuyor. Daha önce indirdiğiniz dosyaları cihazınızdan ayrıca silin.",
    );
  }
  function save() {
    if (!form.current?.reportValidity()) return;
    try {
      const data = exportEvaluation({ ...record, completion: "COMPLETED" });
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const a = download.current!;
      a.href = url;
      a.download = `spaces-ux-${record.participantCode}-${sourceHead.slice(0, 8)}.json`;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.removeAttribute("href");
      }, 1000);
      setNotice(
        "Yanıt dosyası cihazınıza indirildi; sunucuya gönderilmedi. Bu kayıt bağımsız insan kabulünü kendiliğinden kanıtlamaz.",
      );
    } catch {
      setNotice(
        "Kayıt tamamlanamadı. Her görevin sonucunu, son soruyu ve kayıt türüne uygun onayları kontrol edin. Hiçbir yanıt gönderilmedi.",
      );
    }
  }
  return (
    <div className="studio-theme evaluation-page">
      <a href="#evaluation-main" className="evaluation-skip">
        Forma geç
      </a>
      <header>
        <a href="/spaces/" aria-label="ArtificAgent Spaces stüdyosu">
          <StudioWordmark />
        </a>
        <span>KULLANIM DEĞERLENDİRMESİ</span>
      </header>
      <main id="evaluation-main" tabIndex={-1}>
        <p className="studio-eyebrow">V5.3 · BAĞIMSIZ TEST HAZIRLIĞI</p>
        <h1>
          Deneyimi <em>birlikte değerlendirelim.</em>
        </h1>
        <p>
          Beş bağımsız emlak profesyoneli için altı görev. Bu formun varlığı
          gerçek katılım veya bağımsız kabul kanıtı değildir.
        </p>
        <aside className="evaluation-privacy">
          <strong>Yanıtlar bu sekmede kalır.</strong> İsim, e-posta, telefon,
          adres, dosya adı, ses veya görüntü kaydı alınmaz. Otomatik gönderim,
          çerez ve kalıcı tarayıcı kaydı yoktur. JSON indirme isteğe bağlıdır;
          sayfa yenilenince yanıtlar silinir.
        </aside>
        <div className="evaluation-links">
          <a href="/spaces/" target="_blank" rel="noreferrer">
            Stüdyoyu ayrı sekmede aç ↗
          </a>
          <a href="/golden-v5/living.png" download="sentetik-ornek-salon.png">
            Sentetik deneme fotoğrafını indir
          </a>
          <a href="/evaluation/protocol.json" target="_blank" rel="noreferrer">
            Görev protokolü
          </a>
        </div>
        <p className="evaluation-small">
          Yalnız verilen sentetik dosyayı kullanın; gerçek mülk veya müşteri
          dosyası seçmeyin. Moderatör yardım verdiğinde sonucu “Yardımla”
          işaretlesin. Katılımcıya son sorunun doğru cevabını önceden
          söylemeyin.
        </p>
        {dirty && (
          <p className="evaluation-warning">
            Bu geliştirme build'i değişiklik içeriyor. Gerçek bağımsız kayıt
            tamamlanamaz; yalnız sentetik prova yapılabilir.
          </p>
        )}
        <form
          ref={form}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset className="evaluation-setup">
            <legend>Test bilgileri</legend>
            <label>
              Katılımcı kodu
              <select
                aria-label="Katılımcı kodu"
                value={record.participantCode}
                disabled={active !== null}
                onChange={(e) => {
                  setRecord(
                    emptyEvaluation(
                      sourceHead,
                      dirty,
                      e.target.value as Evaluation["participantCode"],
                    ),
                  );
                  setNotice(
                    "Yeni katılımcı kodu seçildi. Önceki yanıtlar, süreler ve onaylar bu formdan temizlendi.",
                  );
                }}
              >
                {PARTICIPANT_SLOTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Kayıt türü
              <select
                aria-label="Kayıt türü"
                required
                value={
                  record.recordKind === "UNASSIGNED" ? "" : record.recordKind
                }
                onChange={(e) =>
                  setRecord((r) => ({
                    ...r,
                    recordKind: (e.target.value ||
                      "UNASSIGNED") as Evaluation["recordKind"],
                  }))
                }
              >
                <option value="">Seçin</option>
                <option value="INDEPENDENT_PROFESSIONAL">
                  Gerçek bağımsız profesyonel testi
                </option>
                <option value="SYNTHETIC_REHEARSAL">
                  Sentetik prova / otomasyon
                </option>
              </select>
            </label>
            <label>
              Cihaz
              <select
                aria-label="Cihaz"
                value={record.device}
                onChange={(e) =>
                  setRecord((r) => ({
                    ...r,
                    device: e.target.value as Evaluation["device"],
                  }))
                }
              >
                <option value="NOT_REPORTED">Belirtilmedi</option>
                <option value="DESKTOP">Masaüstü</option>
                <option value="MOBILE">Telefon</option>
                <option value="TABLET">Tablet</option>
              </select>
            </label>
            <label>
              Tarayıcı
              <select
                aria-label="Tarayıcı"
                value={record.browser}
                onChange={(e) =>
                  setRecord((r) => ({
                    ...r,
                    browser: e.target.value as Evaluation["browser"],
                  }))
                }
              >
                <option value="NOT_REPORTED">Belirtilmedi</option>
                <option value="CHROMIUM">Chrome / Chromium</option>
                <option value="SAFARI">Safari</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
          </fieldset>
          <p className="evaluation-small">
            Cihaz seçimi kişinin beyanıdır. Gerçek iPhone/Safari doğrulaması
            veya beş ayrı insanın katılımı bu formdan otomatik çıkarılmaz.
          </p>
          {record.recordKind === "INDEPENDENT_PROFESSIONAL" && (
            <fieldset className="evaluation-attestation">
              <legend>Bağımsızlık beyanı</legend>
              <label>
                <input
                  type="checkbox"
                  checked={record.professionalConfirmed}
                  onChange={(e) =>
                    setRecord((r) => ({
                      ...r,
                      professionalConfirmed: e.target.checked,
                    }))
                  }
                />
                Emlak alanında çalışan bir profesyonelim.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={record.independenceConfirmed}
                  onChange={(e) =>
                    setRecord((r) => ({
                      ...r,
                      independenceConfirmed: e.target.checked,
                    }))
                  }
                />
                Bu arayüzün geliştirme ekibinde değilim; görevleri bağımsız
                değerlendirdim.
              </label>
            </fieldset>
          )}
          <ol className="evaluation-tasks">
            {UX_TASKS.map((task, i) => {
              const response = record.tasks[i]!;
              return (
                <li key={task.id}>
                  <fieldset>
                    <legend>
                      {i + 1}. {task.title}
                    </legend>
                    <p>{task.instruction}</p>
                    <div className="evaluation-timer">
                      <button
                        type="button"
                        className="studio-secondary"
                        disabled={
                          active !== null || response.elapsedSeconds !== null
                        }
                        onClick={() => {
                          started.current = performance.now();
                          setActive(i);
                          setNotice(
                            "Süre ölçümü başladı; yalnız görevi bitirdiğinizde durdurun.",
                          );
                        }}
                      >
                        Süreyi başlat
                      </button>
                      <button
                        type="button"
                        className="studio-secondary"
                        disabled={active !== i}
                        onClick={() => {
                          const seconds = Math.round(
                            (performance.now() - started.current) / 1000,
                          );
                          updateTask(i, {
                            elapsedSeconds:
                              seconds <= 3600 ? Math.max(0, seconds) : null,
                          });
                          setActive(null);
                          setNotice(
                            seconds > 3600
                              ? "Bir saati aşan süre kaydedilmedi; bu görev süre eşiğini geçemez."
                              : "Görev süresi kaydedildi.",
                          );
                        }}
                      >
                        Süreyi durdur
                      </button>
                      <output aria-label={`${task.title} ölçülen süre`}>
                        {response.elapsedSeconds === null
                          ? "Henüz ölçülmedi"
                          : `${response.elapsedSeconds} sn`}
                      </output>
                    </div>
                    <div className="evaluation-response">
                      <label>
                        Görev sonucu
                        <select
                          required
                          aria-label={`${task.title} sonucu`}
                          value={response.outcome ?? ""}
                          onChange={(e) =>
                            updateTask(i, {
                              outcome: (e.target.value ||
                                null) as TaskResult["outcome"],
                            })
                          }
                        >
                          <option value="">Henüz değerlendirilmedi</option>
                          {UX_OUTCOMES.map((o) => (
                            <option key={o} value={o}>
                              {outcomeLabels[o]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Kullanım kolaylığı (isteğe bağlı)
                        <select
                          aria-label={`${task.title} kolaylık`}
                          value={response.ease ?? ""}
                          onChange={(e) =>
                            updateTask(i, {
                              ease: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        >
                          <option value="">Değerlendirilmedi</option>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <option key={v} value={v}>
                              {v} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <details>
                      <summary>Sorun kategorileri (isteğe bağlı)</summary>
                      <div className="evaluation-issues">
                        {UX_ISSUES.map((issue) => (
                          <label key={issue}>
                            <input
                              type="checkbox"
                              checked={response.issues.includes(issue)}
                              disabled={
                                !response.issues.includes(issue) &&
                                response.issues.length >= 4
                              }
                              onChange={(e) =>
                                updateTask(i, {
                                  issues: e.target.checked
                                    ? [...response.issues, issue]
                                    : response.issues.filter(
                                        (v) => v !== issue,
                                      ),
                                })
                              }
                            />
                            {issueLabels[issue]}
                          </label>
                        ))}
                      </div>
                    </details>
                  </fieldset>
                </li>
              );
            })}
          </ol>
          <fieldset className="evaluation-understanding">
            <legend>Önizlemede ne oldu?</legend>
            <p>
              Görevleri tamamladıktan sonra yanıtlayın. Moderatör
              yönlendirmesin.
            </p>
            <label>
              <input
                type="radio"
                name="understanding"
                required
                checked={record.understanding === "NEW_VIDEO_FROM_MY_FILES"}
                onChange={() =>
                  setRecord((r) => ({
                    ...r,
                    understanding: "NEW_VIDEO_FROM_MY_FILES",
                  }))
                }
              />
              Seçtiğim dosyalardan yeni bir video oluşturuldu.
            </label>
            <label>
              <input
                type="radio"
                name="understanding"
                checked={record.understanding === "PREGENERATED_SAMPLE"}
                onChange={() =>
                  setRecord((r) => ({
                    ...r,
                    understanding: "PREGENERATED_SAMPLE",
                  }))
                }
              />
              Önceden hazırlanmış bir örnek video gösterildi.
            </label>
            <label>
              <input
                type="radio"
                name="understanding"
                checked={record.understanding === "UNSURE"}
                onChange={() =>
                  setRecord((r) => ({ ...r, understanding: "UNSURE" }))
                }
              />
              Emin değilim.
            </label>
          </fieldset>
          <label className="evaluation-consent">
            <input
              type="checkbox"
              checked={record.consent}
              onChange={(e) => {
                if (!e.target.checked) clear();
                else setRecord((r) => ({ ...r, consent: true }));
              }}
            />
            Yalnız bu yapılandırılmış, kişi bilgisi içermeyen değerlendirmeyi
            cihazıma indirmeyi kabul ediyorum. Sunucuya gönderilmeyeceğini
            anladım.
          </label>
          <div className="evaluation-actions">
            <button
              type="submit"
              className="studio-primary"
              disabled={!record.consent || active !== null}
            >
              Yanıtı JSON olarak indir
            </button>
            <button type="button" className="studio-secondary" onClick={clear}>
              Yanıtları temizle
            </button>
          </div>
          <p
            role="status"
            aria-label="Kayıt bildirimi"
            className="evaluation-notice"
          >
            {notice}
          </p>
          <a ref={download} hidden aria-hidden="true" tabIndex={-1}>
            Yerel yanıt dosyası
          </a>
        </form>
        <details className="evaluation-technical">
          <summary>Teknik bilgi ve değerlendirme sınırı</summary>
          <p>
            Kaynak sürüm: <code>{SPACES_PREVIEW_BUILD_ID}</code>. Sonuç kaydı;
            görev, süre, kategori ve beyanlarla sınırlıdır. Otomatik yayın/kabul
            kararı vermez. İndirilen dosyayı Git'e veya public kanıt paketine
            eklemeyin; moderatör owner'ın onaylı özel kanalında saklasın.
          </p>
          <p>
            Fiziksel cihaz / gerçek katılımcı / bağımsız kabul: NOT_VERIFIED. Bu
            sayfa kendi başına beş gerçek kişinin test yaptığını kanıtlamaz.
          </p>
        </details>
      </main>
    </div>
  );
}
// Keep the evaluator separate from the customer studio and all privileged application APIs.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EvaluationForm />
  </StrictMode>,
);
