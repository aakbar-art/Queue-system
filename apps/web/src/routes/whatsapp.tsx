import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueueState } from "@/lib/queue/hooks";
import { getQueueState, patchQueue } from "@/lib/queue/store";
import { submitApproval } from "@/lib/queue/ops";
import { buildConsultancySlipPdf } from "@/lib/pdf";
import type { ChatMessage, WhatsAppSession } from "@/lib/queue/schema";
import { toast } from "sonner";

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

function WhatsAppSim() {
  const sessions = useQueueState((s) => s.sessions);
  const state = useQueueState((s) => s);
  const [phoneInput, setPhoneInput] = useState("+15550001234");
  const [draftInput, setDraftInput] = useState("");

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

  const handleStepAction = () => {
    const s = session;
    if (!s) {
      bindSession();
      return;
    }
    const v = draftInput.trim();
    const allowEmpty = s.step === "phone" || s.step === "payment_upload" || s.step === "address";
    if (!v && !allowEmpty) {
      toast.error("Enter a value");
      return;
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
          toast.error("Invalid reservation code");
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Simulated WhatsApp intake</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Session is keyed by phone. Open Admin in another tab to approve payments.</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Phone key</Label>
              <Input className="mt-1" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} />
            </div>
            <Button className="self-end" type="button" variant="outline" onClick={bindSession}>
              Start / bind
            </Button>
          </div>
          <div>
            <Label>Your reply</Label>
            <Textarea className="mt-1" rows={3} value={draftInput} onChange={(e) => setDraftInput(e.target.value)} />
          </div>
          <Button type="button" onClick={handleStepAction}>
            Send
          </Button>
          {session && (
            <p className="text-xs">
              Step: <strong>{session.step}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(session?.messages ?? []).map((m: ChatMessage) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent"
                }`}
              >
                {m.kind === "pdf" && m.attachmentUrl ? (
                  <a className="underline" href={m.attachmentUrl} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
