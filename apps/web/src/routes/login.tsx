import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueueState } from "@/lib/queue/hooks";
import { readSession, writeSession } from "@/lib/auth-session";
import { toast } from "sonner";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const users = useQueueState((s) => s.users);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (readSession()) navigate({ to: "/admin" });
  }, [navigate]);

  const tryLocal = async (username: string, password: string) => {
    const u = users.find((x) => x.username === username && x.active);
    if (!u) {
      toast.error("Unknown user");
      return;
    }
    if (import.meta.env.VITE_QUEUE_BACKEND === "1") {
      const base = import.meta.env.VITE_API_BASE_URL ?? "/api";
      const r = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        toast.error("Invalid credentials");
        return;
      }
      const body = (await r.json()) as { user: { id: string; username: string; fullName: string; roles: string[] } };
      writeSession({
        userId: body.user.id,
        username: body.user.username,
        fullName: body.user.fullName,
        roles: body.user.roles as never,
      });
    } else {
      if (u.password !== password) {
        toast.error("Invalid credentials (local demo)");
        return;
      }
      writeSession({ userId: u.id, username: u.username, fullName: u.fullName, roles: u.roles });
    }
    toast.success("Signed in");
    navigate({ to: "/admin" });
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => void tryLocal(v.username, v.password))}
          >
            <div>
              <Label htmlFor="u">Username</Label>
              <Input id="u" className="mt-1" {...form.register("username")} autoComplete="username" />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" className="mt-1" {...form.register("password")} autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void tryLocal("admin", "admin123")}>
              Demo admin
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void tryLocal("front", "front123")}>
              Demo front
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void tryLocal("doctor", "doctor123")}>
              Demo doctor
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Local mode stores demo passwords in browser state only. Enable API mode with{" "}
            <code className="rounded bg-accent px-1">VITE_QUEUE_BACKEND=1</code>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
