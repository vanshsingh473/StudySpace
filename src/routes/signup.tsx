import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/ss/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { checkSignup } from "@/lib/studyspace.functions";
import { validateSignup } from "@/lib/signup-rules";
import { errorText, unwrap } from "@/lib/session";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — StudySpace" },
      { name: "description", content: "Create your StudySpace account with your email, roll number and password." },
      { property: "og:title", content: "Sign up — StudySpace" },
      { property: "og:description", content: "Create your StudySpace student account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const check = useServerFn(checkSignup);
  const [f, setF] = useState({ name: "", email: "", roll: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateSignup(f);
    if (!v.ok) return setError(v.error);
    if (busy) return;
    setBusy(true);
    try {
      const c = unwrap(await check({ data: { roll: v.roll, email: v.email } }));
      if (c.rollTaken) return setError("This roll number is already registered.");
      if (c.emailTaken) return setError("This email is already registered. Try logging in.");
      const { error } = await supabase.auth.signUp({
        email: v.email,
        password: f.password,
        options: { emailRedirectTo: window.location.origin, data: { name: v.name, roll_no: v.roll } },
      });
      if (error) {
        const m = error.message.toLowerCase();
        return setError(m.includes("database") ? "This roll number is already registered."
          : m.includes("registered") ? "This email is already registered. Try logging in." : error.message);
      }
      setSentTo(v.email);
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
        {sentTo ? (
          <div className="space-y-4 rounded-2xl bg-card p-6 text-center shadow-card">
            <MailCheck className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted-foreground">We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open it to activate your account, then log in.</p>
            <Button asChild size="tap" className="w-full"><Link to="/login">Go to log in</Link></Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-card p-6 shadow-card" noValidate>
            <div>
              <h1 className="text-2xl font-bold">Create account</h1>
              <p className="mt-1 text-muted-foreground">One account per roll number.</p>
            </div>
            <Field id="name" label="Full name" value={f.name} onChange={set("name")} autoComplete="name" />
            <Field id="email" label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" />
            <Field id="roll" label="Roll number" value={f.roll} onChange={set("roll")} placeholder="e.g. 12A_42" className="uppercase" />
            <Field id="password" label="Password (min 8 characters)" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" />
            <Field id="confirm" label="Confirm password" type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" />
            {error && <p role="alert" className="rounded-xl bg-full-soft px-3 py-2 text-sm font-medium text-full-strong">{error}</p>}
            <Button type="submit" size="tap" className="w-full" disabled={busy}>
              <UserPlus aria-hidden="true" /> {busy ? "Please wait…" : "Sign up"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Log in</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({ id, label, className = "", ...rest }: { id: string; label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...rest} className={`h-12 rounded-xl text-base ${className}`} />
    </div>
  );
}
