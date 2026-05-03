import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { readSession, writeSession } from "@/lib/auth-session";
import { useQueueState } from "@/lib/queue/hooks";
import { estimateWaitMinutes, sortWaitingTickets } from "@/lib/queue/logic";
import {
  callNext,
  createWalkInTicket,
  resolveApproval,
  setTicketStatus,
  togglePause,
} from "@/lib/queue/ops";
import { patchQueue } from "@/lib/queue/store";
import type { Priority } from "@/lib/queue/schema";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const session = readSession();
  const state = useQueueState((s) => s);
  const [roomId, setRoomId] = useState<string | null>(state.rooms[0]?.id ?? null);
  const [walkPriority, setWalkPriority] = useState<Priority>("normal");
  const [walkService, setWalkService] = useState(state.services[0]?.id ?? "");

  useEffect(() => {
    const allowed = session?.roles.some((r) => r === "admin" || r === "front_desk" || r === "doctor");
    if (!session || !allowed) navigate({ to: "/login" });
  }, [session, navigate]);

  const actor = session?.username ?? "staff";

  const waiting = useMemo(() => sortWaitingTickets(state.tickets), [state.tickets]);
  const pendingApprovals = state.approvals.filter((a) => a.status === "pending");

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of state.tickets) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [state.tickets]);

  if (!session) return null;

  const isAdmin = session.roles.includes("admin");
  const isFrontDesk = session.roles.includes("front_desk");
  const isDoctor = session.roles.includes("doctor");

  if (isDoctor && !isAdmin && !isFrontDesk) {
    return <DoctorDashboard session={session} state={state} actor={actor} navigate={navigate} />;
  }

  const showAllTabs = isAdmin;
  const showOperationalTabs = isAdmin || isFrontDesk;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control room</h1>
          <p className="text-sm text-muted-foreground">
            {state.config.clinicName} · signed in as {session.fullName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              writeSession(null);
              navigate({ to: "/login" });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Waiting" value={String(waiting.length)} />
        <Kpi title="Paused" value={state.paused ? "Yes" : "No"} />
        <Kpi title="Pending approvals" value={String(pendingApprovals.length)} />
        <Kpi title="Next #" value={String(state.nextNumber)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant={state.paused ? "default" : "outline"} onClick={() => togglePause(actor)}>
            {state.paused ? "Resume queue" : "Pause queue"}
          </Button>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Room for call</Label>
              <select
                className="mt-1 flex h-9 rounded-md border border-border bg-card px-2 text-sm"
                value={roomId ?? ""}
                onChange={(e) => setRoomId(e.target.value || null)}
              >
                <option value="">Counter</option>
                {state.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => callNext(actor, roomId)} disabled={state.paused || waiting.length === 0}>
              Call next
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-l border-border pl-4">
            <div>
              <Label className="text-xs">Walk-in priority</Label>
              <select
                className="mt-1 flex h-9 rounded-md border border-border bg-card px-2 text-sm"
                value={walkPriority}
                onChange={(e) => setWalkPriority(e.target.value as Priority)}
              >
                <option value="normal">Normal</option>
                <option value="priority">Priority</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Service</Label>
              <select
                className="mt-1 flex h-9 rounded-md border border-border bg-card px-2 text-sm"
                value={walkService}
                onChange={(e) => setWalkService(e.target.value)}
              >
                {state.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                createWalkInTicket({
                  actor,
                  priority: walkPriority,
                  serviceId: walkService || null,
                });
                toast.success("Walk-in ticket created");
              }}
            >
              New walk-in
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="queue">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {showOperationalTabs && (
            <>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="approvals">
                Approvals {pendingApprovals.length ? <Badge className="ml-1">{pendingApprovals.length}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="rooms">Rooms</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="reservations">Reservations</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </>
          )}
          {showAllTabs && (
            <>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="doctors">Doctors</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="queue">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Waiting (priority order)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {waiting.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <div>
                      <div className="font-semibold">{t.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.priority} · {t.source}
                        {t.serviceId ? ` · est wait ${estimateWaitMinutes(state, t.id) ?? 0}m` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => setTicketStatus(actor, t.id, "called")}>
                        Mark called
                      </Button>
                      <Button size="sm" onClick={() => setTicketStatus(actor, t.id, "in_progress")}>
                        In progress
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setTicketStatus(actor, t.id, "completed")}>
                        Complete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setTicketStatus(actor, t.id, "no_show")}>
                        No-show
                      </Button>
                    </div>
                  </div>
                ))}
                {waiting.length === 0 && <p className="text-sm text-muted-foreground">No waiting tickets.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[420px] space-y-2 overflow-auto text-xs">
                {state.logs.slice(0, 80).map((l) => (
                  <div key={l.id} className="border-b border-border/60 pb-2">
                    <span className="font-medium">{l.actor}</span> · {l.action}{" "}
                    {l.ticketCode && <span className="text-primary">({l.ticketCode})</span>}
                    <div className="text-muted-foreground">{l.detail}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(l.at).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <div className="space-y-3">
            {pendingApprovals.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {a.patient.phone} · {a.patient.fullName ?? "Unknown"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <img src={a.evidence.imageDataUrl} alt="evidence" className="max-h-48 rounded-md border border-border" />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => resolveApproval(actor, a.id, "approved", "whatsapp")}>Approve</Button>
                    <Button variant="destructive" onClick={() => resolveApproval(actor, a.id, "rejected", "whatsapp")}>
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {pendingApprovals.length === 0 && <p className="text-sm text-muted-foreground">No pending approvals.</p>}
          </div>
        </TabsContent>

        <TabsContent value="rooms">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Rooms: {state.rooms.map((r) => r.name).join(", ") || "—"}. Assign doctors in future iterations; counter uses
              room select on queue actions.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              {state.fees.map((f) => (
                <div key={f.id} className="flex justify-between border-b border-border/60 py-2">
                  <span>{f.receiptNo ?? f.id.slice(0, 8)}</span>
                  <span>
                    net {f.net} · {f.status}
                  </span>
                </div>
              ))}
              {state.fees.length === 0 && <p className="text-muted-foreground">No fee lines yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              {state.services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">{s.estMinutes} min · {s.clinicType}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              {state.users.map((u) => (
                <div key={u.id} className="flex justify-between border-b border-border/60 py-2">
                  <span>
                    {u.username} — {u.roles.join(", ")}
                  </span>
                  <span className="text-muted-foreground">{u.active ? "active" : "off"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors">
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              {state.doctors.map((d) => (
                <div key={d.id}>
                  <div className="font-medium">{d.fullName}</div>
                  <div className="text-muted-foreground">{d.specialty}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <div>Clinic type: {state.config.clinicType}</div>
              <div>Currency: {state.config.currency}</div>
              <div>Tiers: {state.config.consultancyTiers.map((t) => `${t.name} (${t.amount})`).join(", ")}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations">
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm">
              {state.reservationCodes.map((c) => (
                <div key={c.id} className="flex justify-between">
                  <code>{c.code}</code>
                  <span>{c.active ? "active" : "inactive"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Ticket status distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="oklch(0.45 0.14 250)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], {
                  type: "application/json;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "queue-state.json";
                a.rel = "noopener";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export JSON snapshot
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <div>Proximity (minutes): {state.notifications.proximityMinutes}</div>
              <div>Notify on intake steps: {state.notifications.notifyOnIntakeSteps ? "yes" : "no"}</div>
              <div>Notify on called: {state.notifications.notifyOnCalled ? "yes" : "no"}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  patchQueue((d) => {
                    d.notifications.proximityMinutes = Math.min(120, d.notifications.proximityMinutes + 5);
                  })
                }
              >
                Bump proximity +5m
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        Demo simulation — not for regulated PHI. <Link to="/">Home</Link>
      </p>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

function DoctorDashboard({ session, state, actor, navigate }: { session: any; state: any; actor: string; navigate: any }) {
  const doctor = state.doctors.find((d: any) => d.userId === session.id);
  const room = doctor ? state.rooms.find((r: any) => r.doctorId === doctor.id) : null;

  const myTickets = state.tickets.filter(
    (t: any) => t.roomId === room?.id && (t.status === "called" || t.status === "in_progress")
  );
  const waiting = useMemo(() => sortWaitingTickets(state.tickets), [state.tickets]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {state.config.clinicName} · signed in as Dr. {session.fullName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              writeSession(null);
              navigate({ to: "/login" });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi title="Assigned Room" value={room?.name ?? "None"} />
        <Kpi title="Active Patients" value={String(myTickets.length)} />
        <Kpi title="Total Waiting" value={String(waiting.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                onClick={() => callNext(actor, room?.id ?? null)}
                disabled={state.paused || waiting.length === 0 || !room}
              >
                Call next patient
              </Button>
              {!room && (
                <p className="text-sm text-destructive mt-2 w-full">
                  You are not assigned to a room. Please contact an administrator.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Active Patients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myTickets.map((t: any) => (
                <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">{t.code}</div>
                      <div className="text-sm text-muted-foreground">
                        {t.priority} · {t.status.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {t.status === "called" && (
                      <Button size="sm" onClick={() => setTicketStatus(actor, t.id, "in_progress")}>
                        Start consult
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setTicketStatus(actor, t.id, "completed")}>
                      Complete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTicketStatus(actor, t.id, "no_show")}>
                      No-show
                    </Button>
                  </div>
                </div>
              ))}
              {myTickets.length === 0 && <p className="text-sm text-muted-foreground">No active patients.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Waiting (All)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] space-y-2 overflow-auto">
            {waiting.map((t: any) => (
              <div key={t.id} className="flex justify-between rounded-lg border border-border p-3 text-sm">
                <span className="font-semibold">{t.code}</span>
                <span className="text-muted-foreground">{t.priority}</span>
              </div>
            ))}
            {waiting.length === 0 && <p className="text-sm text-muted-foreground">No waiting tickets.</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Demo simulation — not for regulated PHI. <Link to="/">Home</Link>
      </p>
    </main>
  );
}

