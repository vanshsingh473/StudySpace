import { useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/lib/studyspace.functions";
import { FEEDBACK_MAX, cleanFeedback } from "@/lib/availability";
import { errorText, unwrap } from "@/lib/session";

/** Floating "Feedback" button shown on every screen. Messages are anonymous (no name or email). */
export function FeedbackButton() {
  const send = useServerFn(submitFeedback);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const message = cleanFeedback(msg);
    if (!message) return setError("Please write a short message first.");
    setBusy(true);
    try {
      unwrap(await send({ data: { message, page: pathname } }));
      toast.success("Thanks! Your feedback was sent.");
      setMsg("");
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-3 z-20 h-11 rounded-full px-4 shadow-card sm:bottom-6"
      >
        <MessageSquareText aria-hidden="true" /> Feedback
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription>What's one thing that confused you or that you'd change?</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
              aria-label="Your feedback"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              maxLength={FEEDBACK_MAX}
              rows={4}
              placeholder="Type here…"
              className="rounded-xl text-base"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>No name or email is saved.</span>
              <span className="tabular">{msg.length}/{FEEDBACK_MAX}</span>
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" size="tap" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
