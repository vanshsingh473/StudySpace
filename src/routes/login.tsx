import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/ss/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loginWithRoll } from "@/lib/studyspace.functions";
import { normalizeRoll } from "@/lib/availability";
import { errorText, unwrap } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — StudySpace" },
      { name: "description", content: "Log in with your email or roll number and password to book a study seat." },
      { property: "og:title", content: "Log in — StudySpace" },
      { property: "og:description", content: "Log in with your email or roll number and password to book a study seat." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const rollLogin = useServerFn(loginWithRoll);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = id.trim();
    if (!v || !password) return setError("Enter your email or roll number and your password.");
    if (busy) return;
    setBusy(true);
    try {
      if (v.includes("@")) {
        const { error } = await supabase.auth.signInWithPassword({ email: v.toLowerCase(), password });
        if (error) {
          return setError(error.message.toLowerCase().includes("confirm")
            ? "Please confirm your email first — check your inbox for the link."
            : "Roll number/email or password is wrong.");
        }
      } else {
        const roll = normalizeRoll(v);
        if (!roll) return setError("Roll number looks wrong. Use a format like 12A_42.");
        const t = unwrap(await rollLogin({ data: { roll, password } }));
        const { error } = await supabase.auth.setSession(t);
        if (error) throw error;
      }
      toast.success("Welcome back!");
      navigate({ to: "/", replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader showNav={false} />
      <main className="mx-auto max-w-md px-4 py-8">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-card p-6 shadow-card" noValidate>
          <div>
            <h1 className="text-2xl font-bold">Log in</h1>
            <p className="mt-1 text-muted-foreground">Use your email or school roll number and your password.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="id">Email or roll number</Label>
            <Input id="id" value={id} onChange={(e) => setId(e.target.value)} placeholder="you@email.com or 12A_42"
              autoComplete="username" className="h-12 rounded-xl text-base" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" className="h-12 rounded-xl text-base" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-full-soft px-3 py-2 text-sm font-medium text-full-strong">{error}</p>}
          <Button type="submit" size="tap" className="w-full" disabled={busy}>
            <Lock aria-hidden="true" /> {busy ? "Please wait…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here? <Link to="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
