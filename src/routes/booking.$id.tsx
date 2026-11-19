import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CheckCircle2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { RequireStudent } from "@/components/ss/RequireStudent";
import { Countdown, hm } from "@/components/ss/Countdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelBooking, getBooking } from "@/lib/studyspace.functions";
import { secondsUntil } from "@/lib/availability";
import { errorText, unwrap, type StudentInfo } from "@/lib/session";

export const Route = createFileRoute("/booking/$id")({
  head: () => ({
    meta: [
      { title: "Your booking slip — StudySpace" },
      { name: "description", content: "Your booking slip with QR code, seat, room and period." },
      { property: "og:title", content: "Booking slip — StudySpace" },
      { property: "og:description", content: "Show this slip to the librarian or teacher." },
    ],
  }),
  component: () => <RequireStudent>{(s) => <Slip token={s.token} student={s.student} />}</RequireStudent>,
});

function Slip({ token, student }: { token: string; student: StudentInfo }) {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchB = useServerFn(getBooking);
  const cancel = useServerFn(cancelBooking);
  const [showDir, setShowDir] = useState(false);
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => ({ ...unwrap(await fetchB({ data: { token, bookingId: Number(id) } })), stamp: Date.now() }),
    refetchInterval: 30000,
  });
  const m = useMutation({
    mutationFn: async () => unwrap(await cancel({ data: { token, bookingId: Number(id) } })),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Booking released");
      navigate({ to: "/", replace: true });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const b = q.data?.booking;
  const active = b?.status === "active";
  const nowTime = q.data?.now.slice(11) ?? "00:00:00";
  const started = b ? nowTime >= b.period.start_time : false;

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-md items-center gap-2 px-2 py-3">
          <Link to="/" className="grid h-12 w-12 place-items-center rounded-xl hover:bg-primary-foreground/10" aria-label="Back to rooms"><ArrowLeft aria-hidden="true" /></Link>
          <h1 className="text-xl font-bold">Booking slip</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-5">
        {q.isLoading ? <Skeleton className="h-[520px] w-full rounded-2xl" /> : q.isError || !b ? (
          <div role="alert" className="rounded-2xl bg-card p-6 text-center shadow-card">
            <p className="font-semibold">{errorText(q.error)}</p>
            <Button asChild size="tap" className="mt-4"><Link to="/">Back to rooms</Link></Button>
          </div>
        ) : (
          <article className="overflow-hidden rounded-2xl bg-card shadow-card">
            <div className={active ? "bg-free-soft p-5 text-center text-free-strong" : "bg-muted p-5 text-center text-muted-foreground"}>
              <CheckCircle2 className="mx-auto h-14 w-14" aria-hidden="true" />
              <p className="mt-2 text-3xl font-extrabold tracking-wide">{active ? "BOOKED!" : b.status === "cancelled" ? "RELEASED" : "EXPIRED"}</p>
              {active && (
                <p className="mt-1 font-medium">
                  {started ? <>Period ends in <Countdown seconds={secondsUntil(nowTime, b.period.end_time)} stamp={q.data!.stamp} className="font-bold" /></>
                    : <>Starts in <Countdown seconds={secondsUntil(nowTime, b.period.start_time)} stamp={q.data!.stamp} className="font-bold" /></>}
                </p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
              <Item k="Booking ID" v={b.booking_code} big />
              <Item k="Seat" v={b.seat.label} big />
              <Item k="Room" v={b.room.name} />
              <Item k="Period" v={`${b.period.name} · ${hm(b.period.start_time)}–${hm(b.period.end_time)}`} />
              <Item k="Date" v={new Date(b.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} />
              <Item k="Roll no." v={student.roll_no} />
            </dl>
            <div className="flex justify-center border-t border-dashed border-border p-5">
              <QRCodeSVG value={`${b.booking_code}|${student.roll_no}`} size={168} level="M" title={`QR code for booking ${b.booking_code}`} />
            </div>
            {showDir && (
              <p className="mx-5 mb-4 flex items-start gap-2 rounded-xl bg-secondary p-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><span><b>{b.room.name}:</b> {b.room.location_note || "Ask the front office."}</span></p>
            )}
            <div className="grid gap-3 p-5 pt-0">
              <Button variant="outline" size="tap" onClick={() => setShowDir((v) => !v)} aria-expanded={showDir}><MapPin aria-hidden="true" /> Get Directions</Button>
              {active && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="tap" disabled={m.isPending}><X aria-hidden="true" /> {m.isPending ? "Releasing…" : "Cancel Booking"}</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Release seat {b.seat.label}?</AlertDialogTitle>
                      <AlertDialogDescription>Someone else will be able to book it straight away.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="h-12">Keep booking</AlertDialogCancel>
                      <AlertDialogAction className="h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => m.mutate()}>Yes, release</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

function Item({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className={big ? "text-2xl font-extrabold tabular" : "font-semibold"}>{v}</dd>
    </div>
  );
}
