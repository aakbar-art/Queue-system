import {
  isLikelySpeechNetworkFailure,
  transcribeWithWebSpeech,
  type VoiceUiLang,
} from "@/lib/whatsappVoice";

/** ~1.3MB base64 — keeps localStorage snapshots usable */
const MAX_AUDIO_DATA_URL_CHARS = 1_400_000;

/**
 * Whisper multilingual decoder language (lowercase English name).
 * Always set from UI language so the model does not mis-guess (common with tiny/auto-detect).
 * Balochi has no dedicated Whisper label — Urdu is the closest supported decoder for this app.
 */
const WHISPER_LANGUAGE: Record<VoiceUiLang, string> = {
  en: "english",
  ur: "urdu",
  sd: "sindhi",
  ps: "pashto",
  bal: "urdu",
};

let whisperPipeline: Promise<unknown> | null = null;

function extractAsrText(output: unknown): string {
  if (typeof output === "string") return output.trim();
  if (output && typeof output === "object") {
    const o = output as {
      text?: string;
      generated_text?: string;
      chunks?: Array<{ text?: string }>;
    };
    if (typeof o.text === "string") return o.text.trim();
    if (typeof o.generated_text === "string") return o.generated_text.trim();
    if (Array.isArray(o.chunks) && o.chunks.length) {
      return o.chunks
        .map((c) => c.text ?? "")
        .join("")
        .trim();
    }
  }
  return "";
}

export type ManualRecordingSession = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

/**
 * Start recording until {@link ManualRecordingSession.stop} or {@link ManualRecordingSession.cancel}.
 * Uses periodic `dataavailable` so long voice notes are not truncated.
 */
export async function startManualMicRecording(maxMs: number): Promise<ManualRecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = mimeType
    ? new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  rec.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const finished = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    };
    rec.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error("Recording failed."));
    };
  });

  rec.start(500);

  maxTimer = window.setTimeout(() => {
    try {
      rec.requestData?.();
    } catch {
      /* */
    }
    try {
      if (rec.state === "recording") rec.stop();
    } catch {
      /* */
    }
  }, maxMs);

  const stop = async () => {
    if (cancelled) throw new Error("Recording cancelled.");
    if (maxTimer) clearTimeout(maxTimer);
    try {
      rec.requestData?.();
    } catch {
      /* */
    }
    try {
      if (rec.state === "recording") rec.stop();
    } catch {
      /* onstop may still run */
    }
    return finished;
  };

  const cancel = () => {
    cancelled = true;
    if (maxTimer) clearTimeout(maxTimer);
    rec.onstop = () => stream.getTracks().forEach((t) => t.stop());
    try {
      if (rec.state === "recording") rec.stop();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  return { stop, cancel };
}

export async function blobToAudioDataUrlIfFits(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = reader.result;
      if (typeof s !== "string") {
        resolve(null);
        return;
      }
      resolve(s.length <= MAX_AUDIO_DATA_URL_CHARS ? s : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function loadWhisperPipeline() {
  if (!whisperPipeline) {
    whisperPipeline = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.useBrowserCache = true;
      env.allowLocalModels = false;
      /** `base` is a strong accuracy jump over `tiny` for non‑English; first load ~2× larger than tiny. */
      return pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
        quantized: true,
      });
    })();
  }
  return whisperPipeline;
}

/**
 * Local Whisper — tuned for longer clips (chunked decoding).
 */
export async function transcribeBlobWithWhisper(blob: Blob, voiceUiLang: VoiceUiLang): Promise<string> {
  if (blob.size < 200) {
    throw new Error("Recording was too short or silent.");
  }

  const transcriber = (await loadWhisperPipeline()) as (
    audio: string,
    opts?: Record<string, string | number | boolean>,
  ) => Promise<unknown>;

  const url = URL.createObjectURL(blob);
  try {
    const lang = WHISPER_LANGUAGE[voiceUiLang];
    const opts: Record<string, string | number | boolean> = {
      task: "transcribe",
      language: lang,
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    };

    const out = await transcriber(url, opts);
    const text = extractAsrText(out);
    if (!text) throw new Error("Local model returned empty text.");
    return text;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type VoiceTranscribeHooks = {
  onCloudSpeechUnavailable?: () => void;
  onOfflineProcessingStart?: () => void;
  onOfflineProcessingEnd?: () => void;
};

/**
 * Fast path: Web Speech. If cloud is blocked, records a fresh clip and runs Whisper (legacy one-shot).
 */
export async function transcribeVoicePreferred(
  speechRecognitionLang: string,
  fallbackSpeechLang: string | undefined,
  voiceUiLang: VoiceUiLang,
  hooks?: VoiceTranscribeHooks,
): Promise<string> {
  try {
    return await transcribeWithWebSpeech(speechRecognitionLang, fallbackSpeechLang);
  } catch (err) {
    if (!isLikelySpeechNetworkFailure(err)) throw err;

    hooks?.onCloudSpeechUnavailable?.();

    const session = await startManualMicRecording(24000);
    let blob: Blob;
    try {
      blob = await session.stop();
    } catch (e) {
      throw new Error(
        `Could not record audio for offline transcription. ${e instanceof Error ? e.message : String(e)}`.trim(),
      );
    }

    hooks?.onOfflineProcessingStart?.();
    try {
      return await transcribeBlobWithWhisper(blob, voiceUiLang);
    } catch (inner) {
      throw new Error(
        "Voice failed: cloud speech is blocked on your network and local transcription could not run " +
          `(model download needs internet once, then works offline). ${inner instanceof Error ? inner.message : ""} ` +
          "You can still type your message below.",
      );
    } finally {
      hooks?.onOfflineProcessingEnd?.();
    }
  }
}
