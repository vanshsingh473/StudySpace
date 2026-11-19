import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import { RequireStudent } from "@/components/ss/RequireStudent";
import { hm } from "@/components/ss/Countdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { createBooking, getPeriodInfo, getRoomSeats, type Seat } from "@/lib/studyspace.functions";
import { ApiError, errorText, unwrap, type StudentInfo } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book/$roomId")({
  validateSearch: (s: Record<string, unknown>): { period?: number } => {
    const n = Number(s['period']);
    return Number.isInteger(n) && n > 0 ? { period: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Book a seat — StudySpace" },
      { name: "description", content: "Pick a seat and book it for one period." },
      { property: "og:title", content: "Book a seat — StudySpace" },
      { property: "og:description", content: "Pick a free seat and hold it for your free period." },
    ],
  }),
  component: () => <RequireStudent>{(s) => <BookPage token={s.token} student={s.student} />}</RequireStudent>,
});

function BookPage({ token, student }: { token: string; student: StudentInfo }) {
  const { roomId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchInfo = useServerFn(getPeriodInfo);
  const fetchSeats = useServerFn(getRoomSeats);
  const book = useServerFn(createBooking);
  const rid = Number(roomId);

  const info = useQuery({ queryKey: ["periodInfo"], queryFn: async () => unwrap(await fetchInfo()) });
  const bookable = info.data?.bookable ?? [];
  const [periodId, setPeriodId] = useState<number | undefined>(search.period);
  useEffect(() => {
    if (!info.data) return;
    if (!periodId || !bookable.some((p) => p.id === periodId)) setPeriodId(bookable[0]?.id);
  }, [info.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const seatsKey = ["seats", rid, periodId];
  const seats = useQuery({
    queryKey: seatsKey,
    enabled: !!periodId,
    queryFn: async () => unwrap(await fetchSeats({ data: { token, roomId: rid, periodId: periodId! } })),
    refetchInterval: 15000,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSelected(null); setError(null); }, [periodId]);

  const mutation = useMutation({
    mutationFn: async (seatId: number) => unwrap(await book({ data: { token, roomId: rid, seatId, periodId: periodId! } })),
    onMutate: async (seatId) => {
      // Optimistic: mark the seat taken right away; roll back if the server says no.
      await qc.cancelQueries({ queryKey: seatsKey });
      const prev = qc.getQueryData<typeof seats.data>(seatsKey);
      if (prev) qc.setQueryData(seatsKey, { ...prev, seats: prev.seats.map((s: Seat) => (s.id === seatId ? { ...s, taken: true } : s)) });
      return { prev };
    },
    onError: (e, _seat, ctx) => {
      if (ctx?.prev) qc.setQueryData(seatsKey, ctx.prev);
      setError(errorText(e));
      if (e instanceof ApiError && e.code === "SEAT_TAKEN") { setSelected(null); qc.invalidateQueries({ queryKey: seatsKey }); }
      if (e instanceof ApiError && e.code === "UNAUTHORIZED") navigate({ to: "/login", replace: true });
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      toast.success(`Booked! Seat ${b.seat.label}`);
      navigate({ to: "/booking/$id", params: { id: String(b.id) }, replace: true });
    },
  });

  const room = seats.data?.room;
  const blocked = !!seats.data?.block_reason || room?.is_active === false;
  const selectedLabel = seats.data?.seats.find((s) => s.id === selected)?.label;

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 py-3">
          <Link to="/" className="grid h-12 w-12 place-items-center rounded-xl hover:bg-primary-foreground/10" aria-label="Back to rooms">
            <ArrowLeft aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-bold">{room ? `Book ${room.name}` : "Book a seat"}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
          <Label htmlFor="period">Period</Label>
          {info.isLoading ? <Skeleton className="h-12 w-full" /> : bookable.length === 0 ? (
            <p className="text-muted-foreground">No more periods to book today.</p>
          ) : (
            <select id="period" value={periodId ?? ""} onChange={(e) => setPeriodId(Number(e.target.value))}
              className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-ring">
              {bookable.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({hm(p.start_time)}–{hm(p.end_time)}){info.data?.current?.id === p.id ? " · now" : ""}</option>
              ))}
            </select>
          )}
          <Label htmlFor="rollno" className="pt-2">Roll number</Label>
          <input id="rollno" readOnly value={student.roll_no} className="h-12 w-full rounded-xl border border-input bg-muted px-3 text-base text-muted-foreground" />
        </div>

        <section aria-label="Seats" className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend cls="border-2 border-free bg-card" text="Available" />
            <Legend cls="bg-primary" text="Selected" />
            <Legend cls="bg-muted" text="Taken" />
          </div>
          {seats.isLoading || !periodId ? (
            <div className="grid grid-cols-4 gap-2">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : seats.isError ? (
            <p role="alert" className="text-full-strong">{errorText(seats.error)}</p>
          ) : blocked ? (
            <p className="flex items-center gap-2 rounded-xl bg-unavail-soft p-4 text-muted-foreground"><Ban className="h-5 w-5" aria-hidden="true" /> Unavailable this period{seats.data?.block_reason ? `: ${seats.data.block_reason}` : ""}.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Choose a seat">
              {seats.data!.seats.filter((s) => s.is_active).map((s) => {
                const isSel = selected === s.id;
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={isSel} disabled={s.taken}
                    aria-label={`Seat ${s.label}${s.taken ? ", taken" : isSel ? ", selected" : ", available"}`}
                    onClick={() => { setSelected(s.id); setError(null); }}
                    className={cn("relative h-14 rounded-xl text-base font-bold tabular focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      s.taken ? "cursor-not-allowed bg-muted text-muted-foreground line-through"
                        : isSel ? "bg-primary text-primary-foreground" : "border-2 border-free bg-card text-free-strong hover:bg-free-soft")}>
                    {s.label}
                    {isSel && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {error && <p role="alert" className="rounded-xl bg-full-soft px-4 py-3 font-medium text-full-strong">{error}</p>}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <Button asChild variant="secondary" size="tap" className="flex-1"><Link to="/">Cancel</Link></Button>
          <Button size="tap" className="flex-[2]" disabled={!selected || mutation.isPending || blocked}
            onClick={() => selected && !mutation.isPending && mutation.mutate(selected)}>
            {mutation.isPending ? "Booking…" : selectedLabel ? `Confirm seat ${selectedLabel}` : "Confirm Booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return <span className="flex items-center gap-1.5"><span className={cn("h-4 w-4 rounded", cls)} aria-hidden="true" />{text}</span>;
}
