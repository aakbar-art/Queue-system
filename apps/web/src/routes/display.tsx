import { createFileRoute } from "@tanstack/react-router";
import { useQueueState } from "@/lib/queue/hooks";

export const Route = createFileRoute("/display")({
  component: WallDisplay,
});

function WallDisplay() {
  const state = useQueueState((s) => s);
  const active = state.tickets.find((t) => t.status === "called" || t.status === "in_progress");
  const room = active?.roomId ? state.rooms.find((r) => r.id === active.roomId) : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-card to-accent/20 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Now serving</p>
      <div className="mt-6 text-6xl font-black tracking-tight md:text-8xl">{active?.code ?? "—"}</div>
      {room && <div className="mt-4 text-2xl text-muted-foreground">{room.name}</div>}
      {!active && <div className="mt-4 text-xl text-muted-foreground">Waiting for next call</div>}
      {state.paused && <div className="mt-8 rounded-full bg-amber-500/20 px-6 py-2 text-amber-900">Queue paused</div>}
    </div>
  );
}
