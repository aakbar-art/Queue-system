import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/30 p-8 md:p-12">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">ArcEdge Queueing System</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Clinic queue, intake, and staff portal</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Single-tenant demo: live queue, simulated WhatsApp intake with approvals, wall display, and role-based
          access. Local-first with optional API sync. Not HIPAA compliant.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className={cn(buttonVariants({ size: "lg" }))}>
            Staff login
          </Link>
          <Link to="/whatsapp" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            WhatsApp intake (sim)
          </Link>
          <Link to="/display" className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}>
            Open wall display
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <SurfaceCard to="/admin" title="Admin" desc="Queue control, approvals, catalog, users, reports." />
        <SurfaceCard to="/patient" title="Patient" desc="Check ticket status by phone or code." />
        <SurfaceCard to="/login" title="Roles" desc="admin / front / doctor demo accounts on login page." />
      </div>
    </main>
  );
}

function SurfaceCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
      </Card>
    </Link>
  );
}
