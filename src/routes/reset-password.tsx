import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/ss/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — StudySpace" },
      { name: "description", content: "Choose a new password for your StudySpace account." },
      { property: "og:title", content: "Set new password — StudySpace" },
      { property: "og:description", content: "Choose a new StudySpace password." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError("This reset link is invalid or expired. Ask for a new one.");
    toast.success("Password updated.");
    navigate({ to: "/", replace: true });
  }
  return (
    <div className="min-h-screen">
      <AppHeader showNav={false} />
      <main className="mx-auto max-w-md px-4 py-8">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-card p-6 shadow-card" noValidate>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <div className="space-y-2">
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="h-12 rounded-xl text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Confirm password</Label>
            <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className="h-12 rounded-xl text-base" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-full-soft px-3 py-2 text-sm font-medium text-full-strong">{error}</p>}
          <Button type="submit" size="tap" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
        </form>
      </main>
    </div>
  );
}
