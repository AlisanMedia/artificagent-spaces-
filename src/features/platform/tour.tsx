"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Mic, MicOff, Send, ShieldCheck, Square, Volume2 } from "lucide-react";
import type {
  GuideTurn,
  TourView,
  VoiceSessionView,
} from "@/contracts/platform-ui";
import type { SceneController } from "./scene-viewer";
import type { EngagementEvent } from "@/domain/platform";
import { api, localRequest, saveBlob } from "./client";

const Viewer = dynamic(
  () => import("./scene-viewer").then((m) => m.SceneViewer),
  { ssr: false, loading: () => <p>Serbest 3D yükleniyor…</p> },
);
export function PropertyTour({ token }: { token: string }) {
  const [tour, setTour] = useState<TourView | null>(null),
    [outputUrl, setOutputUrl] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [consented, setConsented] = useState(false);
  const [consent, setConsent] = useState({
      analytics: false,
      voice: false,
      contact: false,
    }),
    [voice, setVoice] = useState<VoiceSessionView | null>(null),
    [messages, setMessages] = useState<
      { speaker: "guide" | "visitor"; text: string }[]
    >([]),
    [question, setQuestion] = useState(""),
    [micStatus, setMicStatus] = useState("Mikrofon kapalı"),
    [muted, setMuted] = useState(true),
    [contactOpen, setContactOpen] = useState(false);
  const viewer = useRef<SceneController>(null),
    eventQueue = useRef<EngagementEvent[]>([]),
    analyticsEnabled = useRef(false),
    sequence = useRef(1),
    activeVoice = useRef<string | null>(null),
    observedRoom = useRef("");
  const tourApi = useCallback(
    <T,>(path: string, data?: unknown) =>
      api<T>("/tour/" + path, { publicationToken: token, data }),
    [token],
  );
  const flush = useCallback(async () => {
    if (!analyticsEnabled.current || !eventQueue.current.length) return;
    const batch = eventQueue.current.splice(0, 20);
    try {
      await tourApi("events", batch);
    } catch {
      /* bounded local analytics must never interrupt exploration; no transcript in event */
    }
  }, [tourApi]);
  const event = useCallback(
    (
      name: EngagementEvent["name"],
      fields: Partial<
        Pick<EngagementEvent, "roomId" | "poiId" | "value" | "category">
      > = {},
    ) => {
      if (analyticsEnabled.current && eventQueue.current.length < 60)
        eventQueue.current.push({
          eventId: crypto.randomUUID(),
          name,
          timestamp: new Date().toISOString(),
          campaign: "",
          ...fields,
        });
    },
    [],
  );
  useEffect(() => {
    let cancelled = false,
      blobUrl = "";
    void tourApi<TourView>("resolve")
      .then(async (data) => {
        if (cancelled) return;
        setTour(data);
        observedRoom.current = data.scene.rooms[0]?.id ?? "";
        const response = await localRequest("/tour/output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicationToken: token }),
        });
        blobUrl = URL.createObjectURL(await response.blob());
        if (cancelled) URL.revokeObjectURL(blobUrl);
        else setOutputUrl(blobUrl);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "TOUR_UNAVAILABLE");
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [token, tourApi]);
  useEffect(() => {
    const timer = setInterval(() => void flush(), 4000);
    return () => clearInterval(timer);
  }, [flush]);
  useEffect(
    () => () => {
      activeVoice.current = null;
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    },
    [],
  );
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "LOCAL_TOUR_FAILED");
    } finally {
      setBusy(false);
    }
  }
  const onRoom = useCallback(
    (roomId: string) => {
      observedRoom.current = roomId;
      event("room_entered", { roomId });
    },
    [event],
  );
  async function stopGuide() {
    viewer.current?.cancelNavigation();
    const session = voice;
    activeVoice.current = null;
    setVoice(null);
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (session) {
      await tourApi("voice/stop", { voiceToken: session.token });
      event("voice_session_ended");
    }
  }
  function speakLocally(text: string) {
    if (muted || typeof speechSynthesis === "undefined") return;
    const local = speechSynthesis
      .getVoices()
      .find(
        (v) =>
          v.localService && v.lang.startsWith(tour?.brand.language ?? "tr"),
      );
    if (!local) {
      setNotice(
        "Cihazda uygun yerel ses yok; metin altyazı modu etkin. Uzak TTS açılmadı.",
      );
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = local;
    speechSynthesis.speak(utterance);
  }
  async function ask(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!voice || !question.trim()) return;
    const session = voice,
      text = question;
    setQuestion("");
    setMessages((old) =>
      [...old, { speaker: "visitor" as const, text }].slice(-30),
    );
    await action(async () => {
      const reply = await tourApi<GuideTurn>("voice/speak", {
        voiceToken: session.token,
        payload: {
          sequence: sequence.current,
          question: text,
          currentRoom: viewer.current?.currentRoom() ?? observedRoom.current,
        },
      });
      if (activeVoice.current !== session.id) return;
      sequence.current = reply.nextSequence;
      setMessages((old) =>
        [...old, { speaker: "guide" as const, text: reply.text }].slice(-30),
      );
      speakLocally(reply.text);
      event("voice_question_category", { category: reply.category });
      if (reply.command) {
        try {
          await tourApi("voice/tool", {
            voiceToken: session.token,
            payload: reply.command,
          });
          const result = await viewer.current?.execute(reply.command);
          if (activeVoice.current !== session.id) return;
          if (!result?.completed) throw new Error("VIEWER_NOT_READY");
          event("voice_tool_succeeded");
          setMessages((old) =>
            [
              ...old,
              {
                speaker: "guide" as const,
                text: "Görüntüleyici izinli işlemin tamamlandığını doğruladı.",
              },
            ].slice(-30),
          );
        } catch {
          event("voice_tool_rejected");
          setMessages((old) =>
            [
              ...old,
              {
                speaker: "guide" as const,
                text: "Görüntüleyici bu hareketi tamamlayamadı; başarılı olduğunu varsaymıyorum.",
              },
            ].slice(-30),
          );
        }
      }
    });
  }
  async function microphone() {
    try {
      if (!consent.voice || !consented)
        throw new Error("Önce rehber iznini kaydedin.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus(
        "İzin verildi; yerel demoda kayıt ve ses aktarımı kapalı. Metin kullanın.",
      );
    } catch {
      setMicStatus(
        "Mikrofon reddedildi veya kullanılamıyor. Metin rehberi çalışmaya devam eder.",
      );
    }
  }
  async function submitLead(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const data = new FormData(eventForm.currentTarget);
    await action(async () => {
      const result = await tourApi<{
        status: string;
        bookingConfirmed: boolean;
      }>("lead", {
        name: String(data.get("name")),
        contactMethod: "email",
        contact: String(data.get("email")),
        message: String(data.get("message") ?? ""),
        explicitConsent: data.get("leadConsent") === "on",
        consentVersion: "spaces-consent-v1",
        viewingRequested: data.get("viewing") === "on",
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice(
        `${result.status}: Yerel ilgi kaydı alındı. Görüşme/randevu onaylanmadı, dış CRM'e aktarılmadı.`,
      );
      setContactOpen(false);
    });
  }
  const style = tour
    ? ({
        "--spaces-accent": tour.brand.accent,
        "--spaces-accent-text": tour.brand.accentText,
      } as CSSProperties)
    : undefined;
  return (
    <div className="spaces-page spaces-tour" style={style}>
      <div className="spaces-eyebrow">
        {tour?.brand.displayName ?? "ARTIFICAGENT SPACES"} / PERMISSIONED LOCAL
        TOUR
      </div>
      <h1>{tour?.title ?? "İzinli tur yükleniyor…"}</h1>
      <p className="spaces-lede">Mekânı kendi ritminizde keşfedin.</p>
      <div className="spaces-safety">
        <ShieldCheck size={19} aria-hidden="true" />
        <p>
          Sentetik mülk. Süreli, revizyona bağlı yerel erişim. AI rehber
          simülasyonu; ElevenLabs bağlantısı veya ses kaydı yok. Gerçek müşteri
          bilgisi girmeyin.
        </p>
      </div>
      {error && (
        <p className="spaces-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="spaces-notice" role="status">
          {notice}
        </p>
      )}
      {tour && (
        <>
          <section className="spaces-panel spaces-consent">
            <h2>Kontrol sizde.</h2>
            <p>
              Tur izlemek için analiz veya rehber rızası gerekmez. Seçimler ayrı
              ve varsayılan olarak kapalıdır.
            </p>
            <div className="spaces-consent-options">
              {(["analytics", "voice", "contact"] as const).map((key) => (
                <label key={key} className="spaces-checkbox">
                  <input
                    type="checkbox"
                    checked={consent[key]}
                    onChange={(e) =>
                      setConsent((old) => ({ ...old, [key]: e.target.checked }))
                    }
                  />
                  {
                    {
                      analytics: "Takma kimlikli oda / etkileşim analizi",
                      voice: "Yerel AI rehber oturumu",
                      contact: "Ayrı form ile sentetik iletişim talebi",
                    }[key]
                  }
                </label>
              ))}
            </div>
            <div className="spaces-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    if (voice) await stopGuide();
                    analyticsEnabled.current = false;
                    eventQueue.current = [];
                    await tourApi("consent", {
                      ...consent,
                      recording: false,
                      version: "spaces-consent-v1",
                    });
                    setConsented(true);
                    analyticsEnabled.current = consent.analytics;
                    event("listing_viewed");
                    if (tour.output.kind === "parametric-mesh") {
                      event("tour_3d_started");
                      event("room_entered", {
                        roomId: tour.scene.rooms[0]!.id,
                      });
                    }
                    setNotice(
                      "İzinler bu yerel ziyaret oturumuna kaydedildi. Ses kaydı kapalı.",
                    );
                  })
                }
              >
                {consented ? "İzinleri güncelle" : "Seçimlerimi kaydet"}
              </button>
              {consented && (
                <button
                  className="subtle"
                  onClick={() =>
                    void action(async () => {
                      await tourApi("withdraw");
                      analyticsEnabled.current = false;
                      eventQueue.current = [];
                      setConsent((old) => ({ ...old, analytics: false }));
                      setNotice(
                        "Analiz rızası geri çekildi, bu oturumun analiz olayları silindi.",
                      );
                    })
                  }
                >
                  Analizi geri çek / sil
                </button>
              )}
            </div>
          </section>
          <div className="spaces-tour-grid">
            <section className="spaces-panel spaces-tour-media">
              <div className="spaces-section-label">
                {tour.output.kind === "parametric-mesh"
                  ? "ACTUAL BLENDER GLB / FREE WALK"
                  : "ACTUAL H264 MP4 / IMAGE-MOTION DEMO"}
              </div>
              {outputUrl &&
                (tour.output.kind === "parametric-mesh" ? (
                  <Viewer
                    ref={viewer}
                    scene={tour.scene}
                    modelUrl={outputUrl}
                    onRoom={onRoom}
                    onDaypart={() => event("daypart_changed")}
                  />
                ) : (
                  <video
                    src={outputUrl}
                    controls
                    preload="metadata"
                    aria-label="Onaylı gerçek MP4"
                    onPlay={() => event("video_started")}
                    onEnded={() => event("video_completed")}
                  />
                ))}
              {!outputUrl && (
                <p role="status">Doğrulanmış çıktı dosyası yükleniyor…</p>
              )}
              <p className="spaces-muted">{tour.output.qa.disclosure}</p>
              <div className="spaces-actions">
                <button
                  className="subtle"
                  onClick={() =>
                    void action(async () => {
                      const response = await localRequest("/tour/output", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ publicationToken: token }),
                      });
                      saveBlob(
                        await response.blob(),
                        `spaces-approved.${tour.output.extension}`,
                      );
                    })
                  }
                >
                  Onaylı çıktıyı indir
                </button>
                <button
                  className="subtle"
                  onClick={() => {
                    event("inspection_detail_opened");
                    setNotice(
                      tour.scene.facts
                        .map((f) => `${f.label}: ${f.value} (${f.truth})`)
                        .join(" · "),
                    );
                  }}
                >
                  Kanıtlı mülk bilgileri
                </button>
              </div>
              <p className="spaces-muted">
                Bilinmeyen alanlar: {tour.scene.unknownRegions.join(" · ")}
              </p>
            </section>
            <aside className="spaces-panel spaces-guide">
              <div className="spaces-section-label">
                {tour.brand.voiceName.toUpperCase()} / AI LOCAL SIMULATION
              </div>
              <h2>Mekânın rehberi.</h2>
              <p>
                Onaylı bu mülkü anlatır. Ölçü yoksa rakam vermez; bilinmeyen
                odaya götürmez. Canlı ElevenLabs kapalıdır.
              </p>
              {!voice ? (
                <button
                  disabled={
                    !consented ||
                    !consent.voice ||
                    busy ||
                    tour.output.kind !== "parametric-mesh"
                  }
                  onClick={() =>
                    void action(async () => {
                      const session =
                        await tourApi<VoiceSessionView>("voice/start");
                      activeVoice.current = session.id;
                      sequence.current = session.nextSequence;
                      setVoice(session);
                      setMessages([
                        { speaker: "guide", text: session.intro.text },
                      ]);
                      event("voice_session_started");
                    })
                  }
                >
                  <Mic size={16} aria-hidden="true" />
                  İzinli yerel rehberi başlat
                </button>
              ) : (
                <>
                  <div className="spaces-guide-actions">
                    <button
                      className="subtle"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          const resumed = await tourApi<{
                            nextSequence: number;
                          }>("voice/resume", { voiceToken: voice.token });
                          sequence.current = resumed.nextSequence;
                          setNotice(
                            "Aynı mülk kapsamındaki oturum yeniden doğrulandı; yeni provider çağrısı açılmadı.",
                          );
                        })
                      }
                    >
                      Oturumu doğrula / sürdür
                    </button>
                    <button
                      className="subtle"
                      onClick={() => void microphone()}
                      aria-label="Mikrofon iznini dene"
                    >
                      <Mic size={17} aria-hidden="true" />
                    </button>
                    <button
                      className="subtle"
                      aria-pressed={!muted}
                      aria-label="Cihazdaki yerel seslendirme"
                      onClick={() => {
                        setMuted((old) => !old);
                        if (!muted && typeof speechSynthesis !== "undefined")
                          speechSynthesis.cancel();
                      }}
                    >
                      <Volume2 size={17} aria-hidden="true" />
                      {muted ? "Sessiz" : "Cihaz sesi"}
                    </button>
                    <button
                      className="subtle"
                      onClick={() => void action(stopGuide)}
                    >
                      <Square size={14} aria-hidden="true" />
                      Bitir
                    </button>
                  </div>
                  <p className="spaces-muted" role="status">
                    <MicOff size={13} aria-hidden="true" />
                    {micStatus}
                  </p>
                  <div
                    className="spaces-transcript"
                    role="log"
                    aria-label="Geçici yerel rehber yazışması"
                  >
                    {messages.map((message, index) => (
                      <p
                        key={index}
                        className={
                          message.speaker === "guide"
                            ? "guide-line"
                            : "visitor-line"
                        }
                      >
                        <strong>
                          {message.speaker === "guide" ? "AI rehber" : "Siz"}
                        </strong>
                        {message.text}
                      </p>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => void ask(e)}
                    className="spaces-guide-input"
                  >
                    <label htmlFor="guide-question" className="sr-only">
                      Rehbere soru sor
                    </label>
                    <input
                      id="guide-question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Salon kaç metrekare?"
                      maxLength={500}
                      required
                    />
                    <button disabled={busy} aria-label="Soruyu gönder">
                      <Send size={17} aria-hidden="true" />
                    </button>
                  </form>
                  <div className="spaces-suggestions">
                    {[
                      "Salon kaç metrekare?",
                      "Mutfak kaç metrekare?",
                      "Mutfak odasına götür",
                      "Akşam ışığını göster",
                      "Balkona götür",
                    ].map((q) => (
                      <button
                        className="subtle"
                        key={q}
                        onClick={() => setQuestion(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="spaces-muted">
                Metin yalnız bu sayfanın belleğinde. Ham transcript/audio
                kaydedilmez. Mikrofon testi izin sonrası akışı hemen kapatır;
                canlı transkripsiyon yapmaz.
              </p>
            </aside>
          </div>
          <section className="spaces-panel">
            <h2>Bir sonraki adımı insanla konuşun.</h2>
            <p>
              Bu demo yalnız sentetik ilgi talebi kaydeder. Gerçek toplantı,
              fiyat veya müsaitlik doğrulaması yapmaz.
            </p>
            <button
              disabled={!consented || !consent.contact}
              onClick={() => {
                setContactOpen(true);
                event("lead_form_opened");
                event("contact_clicked");
              }}
            >
              Sentetik iletişim formunu aç
            </button>
            {contactOpen && (
              <form
                className="spaces-form"
                onSubmit={(e) => void submitLead(e)}
              >
                <label>
                  Sentetik ad
                  <input
                    name="name"
                    required
                    maxLength={80}
                    defaultValue="Örnek ziyaretçi"
                  />
                </label>
                <label>
                  Sentetik e-posta (.invalid)
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={120}
                    defaultValue="visitor@example.invalid"
                  />
                </label>
                <label>
                  Mesaj
                  <textarea name="message" maxLength={500} />
                </label>
                <label className="spaces-checkbox">
                  <input type="checkbox" name="viewing" />
                  Gösterim talebi bırak (PENDING)
                </label>
                <label className="spaces-checkbox">
                  <input type="checkbox" name="leadConsent" required />
                  Bu sentetik iletişim bilgisinin yalnız doğru mülk
                  organizasyonunda saklanmasına açık rıza veriyorum.
                </label>
                <button disabled={busy}>Yerel ilgi talebini kaydet</button>
              </form>
            )}
            {consented && (
              <button
                className="subtle spaces-erase"
                onClick={() =>
                  void action(async () => {
                    if (voice) await stopGuide();
                    await tourApi("erase");
                    analyticsEnabled.current = false;
                    eventQueue.current = [];
                    setMessages([]);
                    setConsent({
                      analytics: false,
                      voice: false,
                      contact: false,
                    });
                    setNotice(
                      "Bu ziyaretin analizi ve iletişim kayıtları silindi. Kimliksiz audit/maliyet kayıtları tutulur.",
                    );
                  })
                }
              >
                Bu oturumun analiz / iletişim verisini sil
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
