import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Loader2,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  SendHorizontal,
  Smile,
  Square,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueueState } from "@/lib/queue/hooks";
import { getQueueState, patchQueue } from "@/lib/queue/store";
import { submitApproval } from "@/lib/queue/ops";
import { buildConsultancySlipPdf } from "@/lib/pdf";
import type { ChatMessage, VoiceMeta, WhatsAppSession } from "@/lib/queue/schema";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ensureMicrophoneAccess,
  translateTranscriptionToAll,
  VOICE_LANG_OPTIONS,
  type VoiceUiLang,
} from "@/lib/whatsappVoice";
import {
  blobToAudioDataUrlIfFits,
  startManualMicRecording,
  transcribeBlobWithWhisper,
} from "@/lib/voiceTranscribe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/whatsapp")({
  component: WhatsAppSim,
});

function uid() {
  return crypto.randomUUID();
}

function ensureSession(sessions: Record<string, WhatsAppSession>, phone: string): WhatsAppSession {
  const normalized = phone.replace(/\s+/g, "");
  if (!sessions[normalized]) {
    sessions[normalized] = {
      phone: normalized,
      step: "phone",
      draft: {},
      messages: [
        {
          id: uid(),
          role: "bot",
          text: "Welcome to clinic intake. Share your mobile number to begin.",
          at: new Date().toISOString(),
          kind: "text",
        },
      ],
      pendingApprovalId: null,
      ticketId: null,
    };
  }
  return sessions[normalized];
}

function pushBot(sess: WhatsAppSession, text: string) {
  sess.messages.push({
    id: uid(),
    role: "bot",
    text,
    at: new Date().toISOString(),
    kind: "text",
  });
}

function pushUser(sess: WhatsAppSession, text: string, voiceMeta?: VoiceMeta | null) {
  sess.messages.push({
    id: uid(),
    role: "user",
    text,
    at: new Date().toISOString(),
    kind: voiceMeta ? "voice" : "text",
    voiceMeta: voiceMeta ?? undefined,
  });
}

function formatMsgTime(iso: string) {
  try {
    return format(new Date(iso), "HH:mm");
  } catch {
    return "";
  }
}

const MAX_VOICE_RECORD_MS = 240_000;

const VOICE_TAB_META: { value: string; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
  { value: "sd", label: "سنڌي" },
  { value: "ps", label: "پښتو" },
  { value: "bal", label: "بلوچی" },
];

function VoiceNoteBubble({
  meta,
  text,
  transcribeBusy,
  onTranscribe,
}: {
  meta: VoiceMeta;
  text: string;
  transcribeBusy?: boolean;
  onTranscribe?: () => void;
}) {
  const tr = meta.translations ?? {};
  const labelForSource =
    VOICE_LANG_OPTIONS.find((o) => o.id === (meta.sourceLang as VoiceUiLang))?.label ?? meta.sourceLang;
  const transcript = (meta.transcription ?? "").trim();
  const showBubbleTranscribe =
    Boolean(onTranscribe) && Boolean(meta.audioDataUrl) && !transcript;

  return (
    <div className="min-w-[220px] max-w-[280px] space-y-2">
      {meta.audioDataUrl ? (
        <audio
          controls
          src={meta.audioDataUrl}
          className="h-9 w-full max-w-full rounded-md bg-black/[0.06]"
          preload="metadata"
        />
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-black/[0.06] px-2 py-2">
          <div className="flex h-10 flex-1 items-end justify-between gap-px overflow-hidden px-0.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="w-[3px] shrink-0 rounded-full bg-[#008069]/55"
                style={{ height: `${6 + (i % 9) + ((i * 3) % 7)}px` }}
              />
            ))}
          </div>
          <Mic className="size-5 shrink-0 text-[#008069]" strokeWidth={2} />
        </div>
      )}
      <p className="text-[11px] leading-tight text-[#667781]">Voice · {labelForSource}</p>
      {showBubbleTranscribe && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-[11px]"
          disabled={transcribeBusy}
          onClick={() => onTranscribe?.()}
        >
          {transcribeBusy ? (
            <>
              <Loader2 className="mr-1 size-3.5 animate-spin" />
              Transcribing…
            </>
          ) : (
            "Transcribe"
          )}
        </Button>
      )}
      <Tabs defaultValue="original" className="w-full">
        <TabsList className="flex h-auto min-h-8 w-full flex-wrap justify-start gap-0.5 bg-black/[0.07] p-1">
          {VOICE_TAB_META.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-2 py-1 text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="original" className="mt-2 max-h-36 overflow-y-auto">
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-[14px] leading-snug text-[#111b21]",
              ["ur", "sd", "ps", "bal"].includes(String(meta.sourceLang)) && "text-right",
            )}
            dir={["ur", "sd", "ps", "bal"].includes(String(meta.sourceLang)) ? "rtl" : "ltr"}
          >
            {transcript || (meta.audioDataUrl ? "— No transcript yet —" : text)}
          </p>
        </TabsContent>
        <TabsContent value="en" className="mt-2 max-h-36 overflow-y-auto">
          <p className="whitespace-pre-wrap break-words text-[14px] leading-snug text-[#111b21]">{tr.en ?? "—"}</p>
        </TabsContent>
        <TabsContent value="ur" className="mt-2 max-h-36 overflow-y-auto">
          <p className="whitespace-pre-wrap break-words text-right text-[14px] leading-snug text-[#111b21]" dir="rtl">
            {tr.ur ?? "—"}
          </p>
        </TabsContent>
        <TabsContent value="sd" className="mt-2 max-h-36 overflow-y-auto">
          <p className="whitespace-pre-wrap break-words text-right text-[14px] leading-snug text-[#111b21]" dir="rtl">
            {tr.sd ?? "—"}
          </p>
        </TabsContent>
        <TabsContent value="ps" className="mt-2 max-h-36 overflow-y-auto">
          <p className="whitespace-pre-wrap break-words text-right text-[14px] leading-snug text-[#111b21]" dir="rtl">
            {tr.ps ?? "—"}
          </p>
        </TabsContent>
        <TabsContent value="bal" className="mt-2 max-h-36 overflow-y-auto">
          <p className="whitespace-pre-wrap break-words text-right text-[14px] leading-snug text-[#111b21]" dir="rtl">
            {tr.bal ?? "—"}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WhatsAppSim() {
  const sessions = useQueueState((s) => s.sessions);
  const state = useQueueState((s) => s);
  const [phoneInput, setPhoneInput] = useState("+15550001234");
  const [draftInput, setDraftInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceUiLang, setVoiceUiLang] = useState<VoiceUiLang>("ur");
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voicePreviewBlob, setVoicePreviewBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voicePreviewTranscript, setVoicePreviewTranscript] = useState("");
  const [voicePreviewBusy, setVoicePreviewBusy] = useState(false);
  const [chatVoiceTranscribingId, setChatVoiceTranscribingId] = useState<string | null>(null);
  const recordingRef = useRef<Awaited<ReturnType<typeof startManualMicRecording>> | null>(null);
  const voicePreviewUrlRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voicePreviewOpen = Boolean(voicePreviewUrl);

  const session = useMemo(() => {
    const p = phoneInput.replace(/\s+/g, "");
    return sessions[p] ?? null;
  }, [sessions, phoneInput]);

  const bindSession = () => {
    patchQueue((d) => {
      ensureSession(d.sessions, phoneInput);
    });
  };

  const activePhone = phoneInput.replace(/\s+/g, "");

  const advance = (field: string, value: string, nextStep: string, botReply: string) => {
    patchQueue((d) => {
      const s = ensureSession(d.sessions, activePhone);
      s.draft[field] = value;
      s.step = nextStep;
      pushBot(s, botReply);
    });
  };

  const handleStepAction = (voice?: { meta: VoiceMeta; text: string }) => {
    const s = session;
    if (!s) {
      bindSession();
      return;
    }
    const v = voice?.text ?? draftInput.trim();
    const allowEmpty = s.step === "phone" || s.step === "payment_upload" || s.step === "address";
    if (!v && !allowEmpty) {
      toast.error("Enter a value");
      return;
    }

    const userBubbleText =
      s.step === "phone"
        ? activePhone
        : !v && s.step === "payment_upload"
          ? "📎 Receipt"
          : !v && s.step === "address"
            ? "skip"
            : v;

    patchQueue((d) => {
      pushUser(ensureSession(d.sessions, activePhone), userBubbleText, voice?.meta);
    });

    if (s.step === "reservation_code") {
      const code = v.toUpperCase();
      const rc = state.reservationCodes.find((c) => c.code === code && c.active && !c.consumedAt);
      if (!rc) {
        toast.error("Invalid reservation code");
        setDraftInput("");
        return;
      }
    }

    switch (s.step) {
      case "phone":
        patchQueue((d) => {
          const sess = ensureSession(d.sessions, activePhone);
          sess.draft.phone = activePhone;
          sess.step = "name";
          pushBot(sess, "Thanks. What is your full name?");
        });
        break;
      case "name":
        advance("fullName", v, "gender", "Gender?");
        break;
      case "gender":
        advance("gender", v, "age", "Age?");
        break;
      case "age":
        advance("age", v, "address", "Address (optional, type skip)?");
        break;
      case "address":
        advance("address", v === "skip" ? "" : v, "service", "Pick a service id from the list shown in clinic brochure (paste service UUID from admin for demo).");
        break;
      case "service":
        advance("serviceId", v, "tier", "Queue tier: type normal, priority, or emergency.");
        break;
      case "tier":
        advance("priority", v, "payment", "Type pay_card, pay_cash, or reservation");
        break;
      case "payment": {
        const choice = v.toLowerCase();
        patchQueue((d) => {
          const sess = ensureSession(d.sessions, activePhone);
          sess.draft.paymentChoice = choice;
          if (choice === "reservation") {
            sess.step = "reservation_code";
            pushBot(sess, "Enter your reservation code.");
          } else {
            sess.step = "payment_upload";
            pushBot(sess, "Upload a payment screenshot (paste a data URL or any long string for demo).");
          }
        });
        break;
      }
      case "reservation_code": {
        const code = v.toUpperCase();
        const rc = state.reservationCodes.find((c) => c.code === code && c.active && !c.consumedAt);
        if (!rc) {
          return;
        }
        patchQueue((d) => {
          const sess = ensureSession(d.sessions, activePhone);
          const r = d.reservationCodes.find((x) => x.id === rc.id);
          if (r) {
            r.consumedAt = new Date().toISOString();
            r.consumedByPhone = sess.phone;
          }
          sess.step = "payment_upload";
          pushBot(sess, "Reservation applied. Upload receipt optional — type done to skip file.");
        });
        break;
      }
      case "payment_upload": {
        const evidence = v || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        patchQueue((d) => {
          const sess = ensureSession(d.sessions, activePhone);
          sess.draft.evidenceImage = evidence;
          sess.step = "consult_pdf";
          const slip = buildConsultancySlipPdf({
            clinicName: d.config.clinicName,
            patientName: String(sess.draft.fullName ?? "Patient"),
            tierName: String(sess.draft.priority ?? "normal"),
            amount: d.config.consultancyTiers[0]?.amount ?? 0,
            currency: d.config.currency,
          });
          sess.messages.push({
            id: uid(),
            role: "bot",
            text: "Consultancy fee slip (PDF)",
            at: new Date().toISOString(),
            kind: "pdf",
            attachmentUrl: slip,
          });
          pushBot(sess, "Submit for admin approval?");
        });
        break;
      }
      case "consult_pdf":
        if (v.toLowerCase() === "submit") {
          const sess = getQueueState().sessions[activePhone];
          if (!sess) return;
          const patient = {
            id: uid(),
            phone: sess.phone,
            fullName: String(sess.draft.fullName ?? ""),
            gender: String(sess.draft.gender ?? ""),
            age: Number(sess.draft.age ?? 0) || null,
            address: String(sess.draft.address ?? "") || null,
          };
          const approvalId = submitApproval({
            patient,
            evidence: {
              imageDataUrl: String(sess.draft.evidenceImage ?? ""),
              note: "WhatsApp intake",
              at: new Date().toISOString(),
            },
            serviceId: String(sess.draft.serviceId ?? "") || null,
            feeAmount: 40,
            priority: (String(sess.draft.priority ?? "normal") as never) || null,
            consultancyAmount: state.config.consultancyTiers[0]?.amount ?? 25,
          });
          patchQueue((d) => {
            const s = ensureSession(d.sessions, activePhone);
            s.pendingApprovalId = approvalId;
            s.step = "pending";
            pushBot(s, "Submitted. Awaiting clinic approval.");
          });
          toast.success("Sent to approvals");
        }
        break;
      default:
        toast.message("Flow complete or waiting on staff.");
    }
    setDraftInput("");
  };

  const discardVoicePreview = () => {
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
      voicePreviewUrlRef.current = null;
    }
    setVoicePreviewUrl(null);
    setVoicePreviewBlob(null);
    setVoicePreviewTranscript("");
  };

  useEffect(() => {
    return () => {
      recordingRef.current?.cancel();
      if (voicePreviewUrlRef.current) {
        URL.revokeObjectURL(voicePreviewUrlRef.current);
      }
    };
  }, []);

  const startVoiceRecording = async () => {
    if (!session) {
      toast.error("Open Simulator settings and tap Bind first.");
      return;
    }
    if (draftInput.trim() || voicePreviewOpen) return;
    try {
      await ensureMicrophoneAccess();
      toast.message("Recording… tap the stop button when you are done.", { duration: 5000 });
      setVoiceRecording(true);
      const sess = await startManualMicRecording(MAX_VOICE_RECORD_MS);
      recordingRef.current = sess;
    } catch (e) {
      recordingRef.current = null;
      setVoiceRecording(false);
      toast.error(e instanceof Error ? e.message : "Could not start recording.");
    }
  };

  const stopVoiceRecording = async () => {
    const sess = recordingRef.current;
    recordingRef.current = null;
    setVoiceRecording(false);
    if (!sess) return;
    try {
      const blob = await sess.stop();
      if (blob.size < 120) {
        toast.error("Recording was too short.");
        return;
      }
      const url = URL.createObjectURL(blob);
      voicePreviewUrlRef.current = url;
      setVoicePreviewUrl(url);
      setVoicePreviewBlob(blob);
      setVoicePreviewTranscript("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recording failed.");
    }
  };

  const transcribeVoicePreview = async () => {
    if (!voicePreviewBlob) return;
    const loadId = toast.loading("Transcribing (local Whisper — first run may download the model)…");
    setVoicePreviewBusy(true);
    try {
      const t = await transcribeBlobWithWhisper(voicePreviewBlob, voiceUiLang);
      if (!t.trim()) {
        toast.error("No speech detected.");
        return;
      }
      setVoicePreviewTranscript(t);
      toast.success("Transcript ready. Use “Send for intake” to continue the form, or “Send voice note” for chat only.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      toast.dismiss(loadId);
      setVoicePreviewBusy(false);
    }
  };

  const sendVoiceNoteChatOnly = async () => {
    if (!voicePreviewBlob || !session) return;
    const t = voicePreviewTranscript.trim();
    const audioDataUrl = await blobToAudioDataUrlIfFits(voicePreviewBlob);
    if (!audioDataUrl) {
      toast.message("Clip is large: sent without in-chat playback.", { duration: 5000 });
    }
    const meta: VoiceMeta = {
      sourceLang: voiceUiLang,
      transcription: t,
      audioDataUrl: audioDataUrl ?? undefined,
    };
    patchQueue((d) => {
      pushUser(ensureSession(d.sessions, activePhone), t || "🎤 Voice message", meta);
    });
    discardVoicePreview();
    toast.success("Voice note sent.");
  };

  const sendPreviewForIntake = async () => {
    const t = voicePreviewTranscript.trim();
    if (!t) {
      toast.error("Transcribe first (or type your answer).");
      return;
    }
    if (!voicePreviewBlob) return;
    const opt = VOICE_LANG_OPTIONS.find((o) => o.id === voiceUiLang);
    if (!opt) return;
    const loadId = toast.loading("Translating (English, Urdu, Sindhi, Pashto, Balochi)…");
    let translations;
    try {
      translations = await translateTranscriptionToAll(t, opt.myMemorySource);
    } finally {
      toast.dismiss(loadId);
    }
    const audioDataUrl = await blobToAudioDataUrlIfFits(voicePreviewBlob);
    const meta: VoiceMeta = {
      sourceLang: voiceUiLang,
      transcription: t,
      translations,
      audioDataUrl: audioDataUrl ?? undefined,
    };
    discardVoicePreview();
    handleStepAction({ meta, text: t });
  };

  const transcribeChatVoiceMessage = async (m: ChatMessage) => {
    if (!m.voiceMeta?.audioDataUrl || !session) return;
    setChatVoiceTranscribingId(m.id);
    const loadId = toast.loading("Transcribing…");
    try {
      const blob = await fetch(m.voiceMeta.audioDataUrl).then((r) => r.blob());
      const t = await transcribeBlobWithWhisper(blob, voiceUiLang);
      if (!t.trim()) {
        toast.error("No speech detected.");
        return;
      }
      const opt = VOICE_LANG_OPTIONS.find((o) => o.id === voiceUiLang)!;
      const translations = await translateTranscriptionToAll(t, opt.myMemorySource);
      patchQueue((d) => {
        const sess = ensureSession(d.sessions, activePhone);
        const msg = sess.messages.find((x) => x.id === m.id);
        if (msg?.voiceMeta) {
          msg.voiceMeta.transcription = t;
          msg.voiceMeta.translations = translations;
          msg.text = t;
        }
      });
      toast.success("Transcribed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcribe failed.");
    } finally {
      toast.dismiss(loadId);
      setChatVoiceTranscribingId(null);
    }
  };

  const messages = session?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, session?.step]);

  const displayName = state.config.clinicName || "Clinic intake";
  const subtitle = session ? "Business account" : "Tap below to start";

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-start bg-[#d1d7db] px-2 py-3 sm:py-6">
      {/* Simulator controls — outside the “phone” */}
      <div className="mb-2 w-full max-w-[420px] rounded-lg border border-black/10 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left font-medium text-zinc-700"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <span>Simulator settings</span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", settingsOpen && "rotate-180")} />
        </button>
        {settingsOpen && (
          <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2 text-zinc-600">
            <p>Session is keyed by phone. Open Admin in another tab to approve payments.</p>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-zinc-500">Phone key</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  className="h-8 text-xs"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <Button className="h-8 shrink-0 text-xs" type="button" variant="outline" onClick={bindSession}>
                  Bind
                </Button>
              </div>
            </div>
            {session && (
              <p className="font-mono text-[11px] text-zinc-500">
                Step: <span className="text-zinc-800">{session.step}</span>
              </p>
            )}
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-zinc-500">Voice language</Label>
              <select
                className="mt-1 flex h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-800"
                value={voiceUiLang}
                onChange={(e) => setVoiceUiLang(e.target.value as VoiceUiLang)}
              >
                {VOICE_LANG_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                Use <strong>Chrome or Edge</strong> on <strong>https://</strong> or <strong>localhost</strong>. Tap the
                mic to <strong>record</strong>, tap <strong>stop</strong> when finished, then <strong>play back</strong>{" "}
                your note. <strong>Transcribe</strong> is optional (local Whisper; first run may download the model).{" "}
                <strong>Send voice note</strong> posts audio to chat only; <strong>Send for intake</strong> uses the
                transcript to continue the form. Translations use MyMemory when you send for intake.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Phone frame — WhatsApp-like chrome */}
      <div className="flex h-[min(780px,calc(100dvh-8rem))] w-full max-w-[420px] flex-col overflow-hidden rounded-md border border-black/[0.08] bg-[#f0f2f5] shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
        {/* Top bar — WhatsApp green */}
        <header className="flex shrink-0 items-center gap-2 bg-[#008069] px-2 py-2 text-white">
          <Link
            to="/"
            className="flex items-center justify-center rounded-full p-2 hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" strokeWidth={2.25} />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-medium leading-tight">{displayName}</h1>
              <p className="truncate text-[13px] text-white/85">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" className="rounded-full p-2 hover:bg-white/10" aria-label="Video call">
              <Video className="size-5" strokeWidth={2} />
            </button>
            <button type="button" className="rounded-full p-2 hover:bg-white/10" aria-label="Voice call">
              <Phone className="size-5" strokeWidth={2} />
            </button>
            <button type="button" className="rounded-full p-2 hover:bg-white/10" aria-label="Menu">
              <MoreVertical className="size-5" strokeWidth={2} />
            </button>
          </div>
        </header>

        {/* Chat */}
        <div ref={scrollRef} className="wa-chat-wallpaper relative min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {!session && (
            <div className="mx-auto mt-8 max-w-[280px] rounded-lg bg-[#fff9c4]/95 px-3 py-2 text-center text-[13.5px] leading-snug text-[#54656f] shadow-sm">
              <span className="font-medium text-[#111b21]">Demo chat</span>
              <br />
              Open <strong>Simulator settings</strong> and tap <strong>Bind</strong>. Type or use the <strong>mic</strong>{" "}
              to record a voice note, listen, then transcribe and send if you want.
            </div>
          )}
          <div className="flex flex-col gap-1">
            {messages.map((m: ChatMessage) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] px-2 pb-1.5 pt-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
                      isUser
                        ? "rounded-[7px] rounded-tr-[4px] bg-[#d9fdd3] text-[#111b21]"
                        : "rounded-[7px] rounded-tl-[4px] bg-white text-[#111b21]",
                    )}
                  >
                    {(m.kind === "voice" || m.voiceMeta) && m.voiceMeta ? (
                      <VoiceNoteBubble
                        meta={m.voiceMeta}
                        text={m.text}
                        transcribeBusy={chatVoiceTranscribingId === m.id}
                        onTranscribe={
                          m.voiceMeta.audioDataUrl && !(m.voiceMeta.transcription ?? "").trim()
                            ? () => void transcribeChatVoiceMessage(m)
                            : undefined
                        }
                      />
                    ) : m.kind === "pdf" && m.attachmentUrl ? (
                      <a
                        className="flex min-w-[200px] items-center gap-3 rounded-md border border-[#008069]/20 bg-[#f0fbf7] px-2 py-2 text-[#008069] no-underline hover:bg-[#e7f7f0]"
                        href={m.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="flex size-10 items-center justify-center rounded-full bg-[#008069]/15">
                          <FileText className="size-5 text-[#008069]" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-medium text-[#111b21]">
                            Consultancy_fee_slip.pdf
                          </span>
                          <span className="text-[12px] text-[#667781]">PDF · Tap to open</span>
                        </span>
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[1.35] text-[#111b21]">
                        {m.text}
                      </p>
                    )}
                    <div
                      className={cn(
                        "mt-0.5 flex justify-end gap-1 text-[11px] leading-none text-[#667781]",
                        isUser && "text-[#667781]",
                      )}
                    >
                      <span>{formatMsgTime(m.at)}</span>
                      {isUser && (
                        <span className="inline-flex text-[#53bdeb]" aria-hidden>
                          ✓✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {voicePreviewOpen && voicePreviewUrl ? (
          <div className="shrink-0 space-y-2 border-t border-[#e9edef] bg-[#e5ddd5] px-3 py-2">
            <audio controls src={voicePreviewUrl} className="h-9 w-full rounded-md bg-white/90" preload="metadata" />
            {voicePreviewTranscript.trim() ? (
              <p className="max-h-16 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-snug text-[#111b21]">
                {voicePreviewTranscript.trim()}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-[11px]"
                disabled={voicePreviewBusy || voiceRecording}
                onClick={() => void transcribeVoicePreview()}
              >
                {voicePreviewBusy ? (
                  <>
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                    Transcribing…
                  </>
                ) : (
                  "Transcribe"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-[11px]"
                disabled={voicePreviewBusy || voiceRecording}
                onClick={() => void sendVoiceNoteChatOnly()}
              >
                Send voice note
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[#008069] text-[11px] text-white hover:bg-[#007056]"
                disabled={voicePreviewBusy || voiceRecording || !voicePreviewTranscript.trim()}
                onClick={() => void sendPreviewForIntake()}
              >
                Send for intake
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-[11px]"
                disabled={voiceRecording}
                onClick={discardVoicePreview}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        {/* Composer — WhatsApp-style */}
        <footer className="flex shrink-0 items-end gap-1 border-t border-[#e9edef] bg-[#f0f2f5] px-2 py-2">
          <button
            type="button"
            className="mb-1 flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/[0.05]"
            aria-label="Emoji"
          >
            <Smile className="size-6" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="mb-1 flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/[0.05]"
            aria-label="Attach"
          >
            <Paperclip className="size-6" strokeWidth={1.75} />
          </button>
          <div className="relative mb-1 min-h-10 flex-1 rounded-3xl bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
            <textarea
              className="max-h-28 min-h-[22px] w-full resize-none bg-transparent text-[15px] leading-snug text-[#111b21] outline-none placeholder:text-[#8696a0]"
              placeholder="Message"
              rows={1}
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStepAction();
                }
              }}
            />
          </div>
          {draftInput.trim() ? (
            <button
              type="button"
              onClick={handleStepAction}
              className="mb-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white shadow-sm hover:bg-[#007056]"
              aria-label="Send"
            >
              <SendHorizontal className="size-5" strokeWidth={2.25} />
            </button>
          ) : (
            <button
              type="button"
              disabled={(!session || voicePreviewOpen || voicePreviewBusy) && !voiceRecording}
              onClick={() => void (voiceRecording ? stopVoiceRecording() : startVoiceRecording())}
              className={cn(
                "mb-1 flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/[0.05] disabled:opacity-40",
                voiceRecording && "animate-pulse text-[#008069]",
              )}
              aria-label={voiceRecording ? "Stop recording" : "Record voice note"}
            >
              {voiceRecording ? (
                <Square className="size-5 fill-current" strokeWidth={2} />
              ) : (
                <Mic className="size-6" strokeWidth={1.75} />
              )}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
