import type { VoiceTranslations } from "@/lib/queue/schema";

/** Thrown when Chromium cannot reach its cloud speech backend — triggers optional local Whisper fallback. */
export const CLOUD_SPEECH_NETWORK_CODE = "ERR_CLOUD_SPEECH_NETWORK";

/** Spoken / UI language for voice capture + translation routing */
export type VoiceUiLang = "en" | "ur" | "sd" | "ps" | "bal";

export const VOICE_LANG_OPTIONS: ReadonlyArray<{
  id: VoiceUiLang;
  label: string;
  /** Web Speech API `lang` hint */
  speechRecognitionLang: string;
  /** Fallback if the browser often mis-detects or rejects this `lang` */
  speechRecognitionLangFallback?: string;
  /** MyMemory `langpair` left-hand code for the transcribed text */
  myMemorySource: string;
}> = [
  { id: "en", label: "English", speechRecognitionLang: "en-US", myMemorySource: "en" },
  { id: "ur", label: "Urdu — اردو", speechRecognitionLang: "ur-PK", myMemorySource: "ur" },
  {
    id: "sd",
    label: "Sindhi — سنڌي",
    speechRecognitionLang: "sd-IN",
    speechRecognitionLangFallback: "ur-PK",
    myMemorySource: "sd",
  },
  {
    id: "ps",
    label: "Pashto — پښتو",
    speechRecognitionLang: "ps-AF",
    speechRecognitionLangFallback: "ur-PK",
    myMemorySource: "ps",
  },
  {
    id: "bal",
    label: "Balochi — بلوچی",
    speechRecognitionLang: "ur-PK",
    myMemorySource: "ur",
  },
];

const MM_TARGET: Record<keyof VoiceTranslations, string> = {
  en: "en",
  ur: "ur",
  sd: "sd",
  ps: "ps",
  bal: "bal",
};

function clipForTranslate(text: string, max = 450): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function cleanMyMemoryOutput(s: string): string {
  return s
    .replace(/\s*MYMEMORY WARNING[^.]*\.?/gi, "")
    .replace(/^QUERY LENGTH LIMIT EXCEEDED\.?\s*/gi, "")
    .trim();
}

async function translateLine(from: string, to: string, q: string): Promise<string> {
  if (from === to) return q;
  const text = clipForTranslate(q);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  const raw = data.responseData?.translatedText ?? "";
  return cleanMyMemoryOutput(raw);
}

/**
 * Fetches English, Urdu, Sindhi, Pashto, and Balochi renditions via MyMemory public API.
 * Balochi may fall back if `bal` code is unavailable for a given pair.
 */
export async function translateTranscriptionToAll(
  transcription: string,
  sourceMyMemoryCode: string,
): Promise<VoiceTranslations> {
  const keys: (keyof VoiceTranslations)[] = ["en", "ur", "sd", "ps", "bal"];
  const out: VoiceTranslations = {};

  await Promise.all(
    keys.map(async (key) => {
      const to = MM_TARGET[key];
      try {
        if (sourceMyMemoryCode === to) {
          out[key] = transcription;
          return;
        }
        let text = await translateLine(sourceMyMemoryCode, to, transcription);
        if (!text && key === "bal") {
          text = await translateLine(sourceMyMemoryCode, "bgp", transcription).catch(() => "");
        }
        if (!text && key === "bal") {
          text = await translateLine(sourceMyMemoryCode, "ur", transcription).catch(() => "");
        }
        if (text) out[key] = text;
      } catch {
        /* leave missing */
      }
    }),
  );

  return out;
}

/** Ensures the tab has mic permission (SpeechRecognition often fails silently without this on some setups). */
export async function ensureMicrophoneAccess(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone access. Try Chrome or Edge.");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    throw new Error(
      "Microphone blocked. Click the lock icon in the address bar, allow the microphone, then try again.",
    );
  }
}

function speechRecognitionErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Microphone permission denied. Allow the mic for this site and try again.";
    case "no-speech":
      return "No speech was heard. Speak closer to the mic, wait for “Listening”, then try again.";
    case "audio-capture":
      return "No microphone found or it is in use by another app.";
    case "network":
      return CLOUD_SPEECH_NETWORK_CODE;
    case "aborted":
      return "Listening was interrupted. Tap the mic once and speak clearly.";
    case "service-not-allowed":
      return "Speech recognition is disabled in this browser or region.";
    default:
      return `Speech recognition failed (${code}). Try Chrome/Edge on desktop, or type your message.`;
  }
}

type RecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isLikelySpeechNetworkFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg === CLOUD_SPEECH_NETWORK_CODE ||
    /cloud speech service could not be reached/i.test(msg) ||
    /Google.s speech API/i.test(msg) ||
    /\bnetwork\b/i.test(msg)
  );
}

/**
 * Captures one utterance using the Web Speech API.
 * Uses continuous + interim mode and aggregates finals (more reliable than one-shot mode in Chrome).
 * Retries a few times on `network` — Chrome often reports that transiently even when the internet works.
 */
export async function transcribeWithWebSpeech(
  speechRecognitionLang: string,
  fallbackLang?: string,
): Promise<string> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    throw new Error("Speech recognition is not available. Use Chrome or Edge, or type your message.");
  }

  const tryLang = (lang: string) =>
    new Promise<string>((resolve, reject) => {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      let settled = false;
      let finalText = "";
      let latestInterim = "";
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let hitLongTimeout = false;

      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        fn();
      };

      const finishWithText = (raw: string) => {
        const text = raw.trim();
        done(() => {
          if (!text) reject(new Error("No speech detected — speak after tapping the mic, then pause."));
          else resolve(text);
        });
      };

      const hardTimeout = window.setTimeout(() => {
        hitLongTimeout = true;
        try {
          recognition.stop();
        } catch {
          /* */
        }
      }, 32000);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const row = event.results[i];
          const piece = row[0]?.transcript ?? "";
          if (row.isFinal) {
            finalText += piece;
            latestInterim = "";
          } else {
            latestInterim = piece;
          }
        }
        const merged = (finalText + latestInterim).trim();
        if (merged && silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      };

      recognition.onspeechend = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          try {
            recognition.stop();
          } catch {
            /* */
          }
        }, 650);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        window.clearTimeout(hardTimeout);
        const code = event.error || "unknown";
        if (code === "aborted" && (finalText || latestInterim)) {
          finishWithText(finalText + latestInterim);
          return;
        }
        if (code === "no-speech" && (finalText || latestInterim)) {
          finishWithText(finalText + latestInterim);
          return;
        }
        /* Chrome often emits `network` even when Wi‑Fi works — if we already have text, use it. */
        if (code === "network" && (finalText || latestInterim)) {
          finishWithText(finalText + latestInterim);
          return;
        }
        done(() => reject(new Error(speechRecognitionErrorMessage(code))));
      };

      recognition.onend = () => {
        window.clearTimeout(hardTimeout);
        if (silenceTimer) clearTimeout(silenceTimer);
        const combined = (finalText + latestInterim).trim();
        if (!settled) {
          if (combined) finishWithText(combined);
          else {
            done(() =>
              reject(
                new Error(
                  hitLongTimeout
                    ? "Listening timed out — speak within 30 seconds after tapping the mic."
                    : speechRecognitionErrorMessage("no-speech"),
                ),
              ),
            );
          }
        }
      };

      try {
        void recognition.start();
      } catch (e) {
        window.clearTimeout(hardTimeout);
        reject(e instanceof Error ? e : new Error("Could not start speech recognition."));
      }
    });

  const runPrimaryThenFallback = () =>
    tryLang(speechRecognitionLang).catch((err) => {
      const msg = err instanceof Error ? err.message : "";
      if (/microphone|permission|denied|not-allowed|audio-capture/i.test(msg)) throw err;
      /* On any failure (including flaky `network`), a different `lang` often still works. */
      if (fallbackLang && fallbackLang !== speechRecognitionLang) return tryLang(fallbackLang);
      throw err;
    });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(350 * attempt);
    try {
      return await runPrimaryThenFallback();
    } catch (e) {
      lastErr = e;
      if (attempt < 2 && isLikelySpeechNetworkFailure(e)) continue;
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
