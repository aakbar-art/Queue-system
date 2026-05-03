import type { Draft } from "immer";
import { formatTicketCode, nextWaitingTicket, sortWaitingTickets } from "./logic";
import { patchQueue } from "./store";
import type { Approval, Patient, Priority, QueueState, Source, Ticket } from "./schema";
import { announceCall } from "../voice";

function uid() {
  return crypto.randomUUID();
}

function pushLog(
  draft: Draft<QueueState>,
  actor: string,
  action: string,
  detail: string,
  ticketCode?: string | null,
) {
  draft.logs.unshift({
    id: uid(),
    at: new Date().toISOString(),
    actor,
    action,
    ticketCode: ticketCode ?? null,
    detail,
  });
}

export function togglePause(actor: string): void {
  patchQueue((d) => {
    d.paused = !d.paused;
    pushLog(d, actor, d.paused ? "pause" : "resume", d.paused ? "Queue paused" : "Queue resumed");
  });
}

export function createWalkInTicket(opts: {
  actor: string;
  priority: Priority;
  serviceId: string | null;
  phone?: string | null;
}): void {
  patchQueue((d) => {
    const n = d.nextNumber;
    const code = formatTicketCode(d.config.ticketPrefix, n);
    const t: Ticket = {
      id: uid(),
      code,
      number: n,
      priority: opts.priority,
      source: "walk_in",
      status: "waiting",
      patientId: null,
      phone: opts.phone ?? null,
      serviceId: opts.serviceId,
      roomId: null,
      doctorId: null,
      createdAt: new Date().toISOString(),
      calledAt: null,
      completedAt: null,
      notes: null,
    };
    d.tickets.push(t);
    d.nextNumber = n + 1;
    pushLog(d, opts.actor, "ticket_create", `Walk-in ${code}`, code);
  });
}

export function callNext(actor: string, roomId: string | null): void {
  patchQueue((d) => {
    if (d.paused) return;
    const nw = nextWaitingTicket(d);
    if (!nw) return;
    const t = d.tickets.find((x) => x.id === nw.id);
    if (!t) return;
    t.status = "called";
    t.calledAt = new Date().toISOString();
    t.roomId = roomId;
    pushLog(d, actor, "call_next", `Called ${t.code}`, t.code);
    if (d.notifications.notifyOnCalled) {
      announceCall(`Ticket ${t.code}, please proceed`);
    }
  });
}

export function setTicketStatus(actor: string, ticketId: string, status: Ticket["status"]): void {
  patchQueue((d) => {
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!t) return;
    t.status = status;
    if (status === "completed") t.completedAt = new Date().toISOString();
    pushLog(d, actor, "ticket_status", `${t.code} -> ${status}`, t.code);
  });
}

export function reorderWaiting(actor: string, orderedIds: string[]): void {
  patchQueue((d) => {
    const waiting = sortWaitingTickets(d.tickets);
    const set = new Set(waiting.map((x) => x.id));
    const filtered = orderedIds.filter((id) => set.has(id));
    if (filtered.length !== waiting.length) return;
    const base = Math.min(...waiting.map((x) => x.number));
    filtered.forEach((id, i) => {
      const t = d.tickets.find((x) => x.id === id);
      if (t) t.number = base + i;
    });
    pushLog(d, actor, "reorder", "Waiting queue manually reordered");
  });
}

export function submitApproval(opts: {
  patient: Patient;
  evidence: Approval["evidence"];
  serviceId?: string | null;
  feeAmount?: number | null;
  priority?: Priority | null;
  consultancyAmount?: number | null;
}): string {
  const id = uid();
  patchQueue((d) => {
    d.approvals.unshift({
      id,
      patient: opts.patient,
      evidence: opts.evidence,
      serviceId: opts.serviceId ?? null,
      feeAmount: opts.feeAmount ?? null,
      priority: opts.priority ?? null,
      consultancyAmount: opts.consultancyAmount ?? null,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    pushLog(d, "whatsapp", "approval_submit", `Payment evidence for ${opts.patient.phone}`);
  });
  return id;
}

export function resolveApproval(actor: string, id: string, decision: "approved" | "rejected", source: Source): void {
  patchQueue((d) => {
    const a = d.approvals.find((x) => x.id === id);
    if (!a || a.status !== "pending") return;
    a.status = decision;
    if (decision === "approved") {
      const n = d.nextNumber;
      const code = formatTicketCode(d.config.ticketPrefix, n);
      const priority = a.priority ?? "normal";
      const t: Ticket = {
        id: uid(),
        code,
        number: n,
        priority,
        source,
        status: "waiting",
        patientId: a.patient.id,
        phone: a.patient.phone,
        serviceId: a.serviceId,
        roomId: null,
        doctorId: null,
        createdAt: new Date().toISOString(),
        calledAt: null,
        completedAt: null,
        notes: "From WhatsApp approval",
      };
      d.tickets.push(t);
      d.nextNumber = n + 1;
      d.receiptSeq += 1;
      const receiptNo = `R-${d.receiptSeq}`;
      d.fees.push({
        id: uid(),
        ticketId: t.id,
        gross: a.feeAmount ?? a.consultancyAmount ?? 0,
        discount: 0,
        net: a.feeAmount ?? a.consultancyAmount ?? 0,
        paid: a.feeAmount ?? a.consultancyAmount ?? 0,
        refund: 0,
        status: "settled",
        receiptNo,
        method: "whatsapp_evidence",
        reservationCodeId: null,
        createdAt: new Date().toISOString(),
      });
      pushLog(d, actor, "approval_approved", `Ticket ${code} issued`, code);
      const sess = d.sessions[a.patient.phone];
      if (sess) {
        sess.pendingApprovalId = null;
        sess.ticketId = t.id;
        sess.step = "done";
        sess.messages.push({
          id: uid(),
          role: "bot",
          text: `Approved. Your ticket is ${code}. Please wait in the lobby.`,
          at: new Date().toISOString(),
          kind: "text",
        });
      }
    } else {
      pushLog(d, actor, "approval_rejected", `Rejected approval ${id}`);
      const sess = d.sessions[a.patient.phone];
      if (sess) {
        sess.pendingApprovalId = null;
        sess.step = "rejected";
        sess.messages.push({
          id: uid(),
          role: "bot",
          text: "Your payment could not be verified. Please contact reception.",
          at: new Date().toISOString(),
          kind: "text",
        });
      }
    }
  });
}
