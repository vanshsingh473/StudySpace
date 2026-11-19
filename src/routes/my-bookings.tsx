import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/ss/AppHeader";
import { RequireStudent } from "@/components/ss/RequireStudent";
import { hm } from "@/components/ss/Countdown";
import { Skeleton } from "@/components/ui/skeleton";
import { myBookings } from "@/lib/studyspace.functions";
import { errorText, unwrap } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My bookings — StudySpace" },
      { name: "description", content: "Your study seat bookings for today." },
      { property: "og:title", content: "My bookings — StudySpace" },
      { property: "og:description", content: "Your study seat bookings for today." },
    ],
  }),
  component: () => <RequireStudent>{(s) => <MyBookings token={s.token} />}</RequireStudent>,
});

const STATUS = { active: "bg-free-soft text-free-strong", cancelled: "bg-unavail-soft text-muted-foreground", expired: "bg-unavail-soft text-muted-foreground" };

function MyBookings({ token }: { token: string }) {
  const fn = useServerFn(myBookings);
  const q = useQuery({ queryKey: ["myBookings"], queryFn: async () => unwrap(await fn({ data: { token } })) });
  return (
    <div className="min-h-screen">
      <AppHeader subtitle="My bookings today" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <h1 className="text-xl font-bold">Today's bookings</h1>
        {q.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        {q.isError && <p role="alert" className="rounded-xl bg-full-soft p-4 text-full-strong">{errorText(q.error)}</p>}
        {q.data?.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">
            No bookings yet today. <Link to="/" className="font-semibold text-primary underline">Find a free room</Link>
          </div>
        )}
        {q.data?.map((b) => (
          <Link key={b.id} to="/booking/$id" params={{ id: String(b.id) }}
            className={cn("flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card focus-visible:outline-2 focus-visible:outline-ring", b.status !== "active" && "opacity-60")}>
            <div className="flex-1">
              <p className="font-bold">{b.room.name} · Seat {b.seat.label}</p>
              <p className="text-sm text-muted-foreground tabular">{b.period.name} ({hm(b.period.start_time)}–{hm(b.period.end_time)}) · {b.booking_code}</p>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase", STATUS[b.status])}>{b.status}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </main>
    </div>
  );
}
