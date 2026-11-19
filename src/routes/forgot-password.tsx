import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppHeader } from "@/components/ss/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — StudySpace" },
      { name: "description", content: "Get a link to reset your StudySpace password." },
      { property: "og:title", content: "Forgot password — StudySpace" },
      { property: "og:description", content: "Reset your StudySpace password." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }
  return (
    <div className="min-h-screen">
      <AppHeader showNav={false} />
      <main className="mx-auto max-w-md px-4 py-8">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-card p-6 shadow-card" noValidate>
          <h1 className="text-2xl font-bold">Forgot password</h1>
          {sent ? (
            <p className="text-muted-foreground">If that email has an account, a reset link is on its way.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl text-base" />
              </div>
              {error && <p role="alert" className="rounded-xl bg-full-soft px-3 py-2 text-sm font-medium text-full-strong">{error}</p>}
              <Button type="submit" size="tap" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
            </>
          )}
          <p className="text-center text-sm"><Link to="/login" className="font-semibold text-primary hover:underline">Back to log in</Link></p>
        </form>
      </main>
    </div>
  );
}
