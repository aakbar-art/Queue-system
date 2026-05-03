import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueueState } from "@/lib/queue/hooks";
import { estimateWaitMinutes } from "@/lib/queue/logic";

export const Route = createFileRoute("/patient")({
  component: PatientView,
});

function PatientView() {
  const tickets = useQueueState((s) => s.tickets);
  const state = useQueueState((s) => s);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const matches = tickets.filter((t) => {
    const byPhone = phone && t.phone && t.phone.replace(/\s/g, "") === phone.replace(/\s/g, "");
    const byCode = code && t.code.toLowerCase() === code.trim().toLowerCase();
    return byPhone || byCode;
  });

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Ticket status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Phone on file</Label>
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1555..." />
          </div>
          <div>
            <Label>Or ticket code</Label>
            <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="A-001" />
          </div>
          <Button type="button" variant="outline" onClick={() => { setPhone(""); setCode(""); }}>
            Clear
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {matches.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">{t.code}</CardTitle>
              <Badge variant="secondary">{t.status}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t.status === "waiting" && (
                <p>Estimated wait: about {estimateWaitMinutes(state, t.id) ?? 0} minutes.</p>
              )}
              {t.status === "called" && <p>Please proceed to the counter when your number appears on the wall.</p>}
              {t.status === "in_progress" && <p>You are being served.</p>}
              {t.status === "completed" && <p>Visit completed. Thank you.</p>}
            </CardContent>
          </Card>
        ))}
        {matches.length === 0 && (phone || code) && <p className="text-sm text-muted-foreground">No matching tickets.</p>}
      </div>
    </main>
  );
}
