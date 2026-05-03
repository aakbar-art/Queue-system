import type { Priority, QueueState, Ticket } from "./schema";

const priorityRank: Record<Priority, number> = {
  emergency: 0,
  priority: 1,
  normal: 2,
};

export function formatTicketCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

export function sortWaitingTickets(tickets: Ticket[]): Ticket[] {
  return tickets
    .filter((t) => t.status === "waiting")
    .slice()
    .sort((a, b) => {
      const pr = priorityRank[a.priority] - priorityRank[b.priority];
      if (pr !== 0) return pr;
      return a.number - b.number;
    });
}

export function estimateWaitMinutes(state: QueueState, ticketId: string): number | null {
  const ticket = state.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "waiting") return null;
  const waitingOrdered = sortWaitingTickets(state.tickets);
  const idx = waitingOrdered.findIndex((t) => t.id === ticketId);
  if (idx <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < idx; i++) {
    const sid = waitingOrdered[i].serviceId;
    const svc = sid ? state.services.find((s) => s.id === sid) : undefined;
    sum += svc?.estMinutes ?? 15;
  }
  return sum;
}

export function nextWaitingTicket(state: QueueState): Ticket | undefined {
  return sortWaitingTickets(state.tickets)[0];
}
