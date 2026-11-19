import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestSpot, type Suggestion } from "@/lib/studyspace.functions";
import { errorText, unwrap } from "@/lib/session";

/** "Suggest a spot": asks the AI for the best free room this period. */
export function SuggestSpot({ periodId, signedIn }: { periodId: number; signedIn: boolean }) {
  const ask = useServerFn(suggestSpot);
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Suggestion | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(unwrap(await ask({ data: { periodId, wish } })));
    } catch (e) {
      setResult(undefined);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Suggest a spot" className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Anything you need? (optional)"
          placeholder="Optional: e.g. quiet, near the stairs"
          value={wish}
          maxLength={150}
          onChange={(e) => setWish(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-xl"
        />
        <Button size="tap" onClick={run} disabled={busy}>
          <Sparkles aria-hidden="true" /> {busy ? "Thinking…" : "Suggest a spot"}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-full-strong">{error}</p>}
      {result === null && <p className="text-sm text-muted-foreground">No free rooms to suggest this period. Try again in a few minutes.</p>}
      {result && (
        <div className="rounded-xl bg-secondary p-3" aria-live="polite">
          <p className="font-bold">{result.roomName} · {result.free} seats free</p>
          <p className="mt-1 text-sm">{result.reason}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">AI-generated, may contain mistakes.</p>
            <Button asChild size="sm" className="rounded-lg">
              {signedIn ? (
                <Link to="/book/$roomId" params={{ roomId: String(result.roomId) }} search={{ period: periodId }}>Book this room <ChevronRight aria-hidden="true" /></Link>
              ) : (
                <Link to="/login">Log in to book <ChevronRight aria-hidden="true" /></Link>
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
