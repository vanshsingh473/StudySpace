import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCw, School, Library, ChevronRight, MapPin, Clock, Ticket, WifiOff, CalendarOff } from "lucide-react";
import { AppHeader } from "@/components/ss/AppHeader";
import { RequireStudent } from "@/components/ss/RequireStudent";
import { StatusBadge } from "@/components/ss/StatusBadge";
import { Countdown, hm } from "@/components/ss/Countdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvailability } from "@/lib/studyspace.functions";
import { secondsUntil, type RoomAvailability } from "@/lib/availability";
import { errorText, unwrap } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudySpace — Free rooms right now" },
      { name: "description", content: "Live list of free classrooms and library seats for the current period at St. Paul's Inter College." },
      { property: "og:title", content: "StudySpace — Free rooms right now" },
      { property: "og:description", content: "See which rooms and library seats are free this period and book one in a tap." },
    ],
  }),
  component: () => <RequireStudent>{(s) => <Dashboard token={s.token} />}</RequireStudent>,
});

function Dashboard({ token }: { token: string }) {
  const fetchAvail = useServerFn(getAvailability);
  const [freeOnly, setFreeOnly] = useState(false);
  const q = useQuery({
    queryKey: ["availability"],
    queryFn: async () => ({ ...unwrap(await fetchAvail({ data: { token } })), stamp: Date.now() }),
    refetchInterval: 15000,
    retry: 1,
  });

  const d = q.data;
  const current = d?.info.current && !d.info.current.is_break ? d.info.current : null;
  const shownPeriod = current ?? d?.info.next ?? null;
  const rooms = (d?.rooms ?? []).filter((r) => !freeOnly || r.status === "FREE" || r.status === "FEW");
  const allFull = d && d.rooms.length > 0 && d.rooms.every((r) => r.status === "FULL" || r.status === "UNAVAILABLE");

  return (
    <div className="min-h-screen pb-28">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Period chip */}
        <section aria-label="Current period" className="rounded-2xl bg-card p-4 shadow-card">
          {!d ? (
            <Skeleton className="h-12 w-full" />
          ) : current ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Period now</p>
                <p className="text-xl font-bold">{current.name} <span className="font-semibold text-muted-foreground tabular">({hm(current.start_time)}–{hm(current.end_time)})</span></p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Ends in</p>
                <p className="text-2xl font-extrabold"><Countdown seconds={secondsUntil(d.info.now.slice(11), current.end_time)} stamp={d.stamp} /></p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CalendarOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold">{d.info.current?.is_break ? `${d.info.current.name} break` : "No active period"}</p>
                <p className="text-muted-foreground">
                  {d.info.next ? <>Next: <b>{d.info.next.name}</b> at <span className="tabular">{hm(d.info.next.start_time)}</span> — you can book it now.</> : "No more periods today. See you tomorrow!"}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="tap" onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Refresh availability">
            <RefreshCw className={cn(q.isFetching && "animate-spin")} aria-hidden="true" /> Refresh
          </Button>
          <div role="group" aria-label="Filter rooms" className="ml-auto flex rounded-xl bg-secondary p-1">
            {[["All", false], ["Free only", true]].map(([label, val]) => (
              <button key={String(label)} type="button" aria-pressed={freeOnly === val} onClick={() => setFreeOnly(val as boolean)}
                className={cn("h-10 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring",
                  freeOnly === val ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {q.isError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-full-soft p-4 text-full-strong">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">{errorText(q.error)}</p>
              {d && <p className="text-sm">Showing the last list we got.</p>}
            </div>
          </div>
        )}

        {/* Room list */}
        <section aria-label={shownPeriod ? `Rooms for ${shownPeriod.name} period` : "Rooms"} className="space-y-3">
          {!d && !q.isError && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
          {d && !shownPeriod && <Empty text="Nothing to book right now." />}
          {d && shownPeriod && rooms.length === 0 && <Empty text={freeOnly ? "No free rooms this period. Try 'All' or another period." : "No rooms set up yet."} />}
          {allFull && !freeOnly && (
            <p className="rounded-xl bg-few-soft px-4 py-3 text-sm font-medium text-few-strong">Every room is full this period. Try the next period or refresh in a few minutes.</p>
          )}
          {shownPeriod && rooms.map((r) => <RoomCard key={r.id} room={r} periodId={shownPeriod.id} disabledBecauseBooked={!!d?.myActive && d.myActive.period.id === shownPeriod.id} />)}
        </section>
      </main>

      {d?.myActive && (
        <Link to="/booking/$id" params={{ id: String(d.myActive.id) }}
          className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-2xl items-center gap-3 bg-accent px-4 py-4 text-accent-foreground shadow-card focus-visible:outline-2 focus-visible:outline-primary sm:bottom-4 sm:rounded-2xl">
          <Ticket className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-sm font-medium">Your booking</span>
            <span className="block font-bold">{d.myActive.room.name} · Seat {d.myActive.seat.label} · {d.myActive.period.name}</span>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">{text}</div>;
}

function RoomCard({ room, periodId, disabledBecauseBooked }: { room: RoomAvailability; periodId: number; disabledBecauseBooked: boolean }) {
  const Icon = room.type === "library" ? Library : School;
  const disabled = room.status === "FULL" || room.status === "UNAVAILABLE";
  return (
    <article className={cn("rounded-2xl bg-card p-4 shadow-card", disabled && "opacity-60")} aria-disabled={disabled}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{room.name}</h2>
            <StatusBadge status={room.status} label={room.label} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {room.location_note || "—"}
          </p>
          {room.block_reason && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> In use: {room.block_reason}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-muted-foreground">
          <span className="text-3xl font-extrabold text-foreground tabular">{room.status === "UNAVAILABLE" ? "—" : room.free}</span>
          <span className="tabular"> / {room.total} seats free</span>
        </p>
        {disabled ? (
          <Button size="tap" variant="secondary" disabled>{room.status === "FULL" ? "Full" : "Unavailable"}</Button>
        ) : (
          <Button asChild size="tap">
            <Link to="/book/$roomId" params={{ roomId: String(room.id) }} search={{ period: periodId }}>
              {disabledBecauseBooked ? "View" : "Book"} <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}
