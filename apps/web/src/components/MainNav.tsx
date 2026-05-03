import { Link, useRouterState } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { onAuthChange, readSession, type SessionPayload } from "@/lib/auth-session";

export function MainNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<SessionPayload | null>(() => readSession());

  useEffect(() => {
    return onAuthChange(() => setSession(readSession()));
  }, []);

  const canSeeAdmin = session?.roles.some((r) => r === "admin" || r === "front_desk" || r === "doctor");

  const links = [
    { to: "/", label: "Home" },
    { to: "/login", label: "Login" },
    ...(canSeeAdmin ? ([{ to: "/admin", label: "Admin" }] as const) : []),
    { to: "/whatsapp", label: "WhatsApp" },
    { to: "/display", label: "Wall" },
    { to: "/patient", label: "Patient" },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Activity className="h-5 w-5 text-primary" />
          <span>ArcEdge Queue</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-accent",
                  active && "bg-accent text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
