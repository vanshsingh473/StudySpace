import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, LogOut, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hm } from "@/components/ss/Countdown";
import {
  adminAddBlock, adminCancelBooking, adminDeleteBlock, adminLogin, adminOverview, adminSavePeriods, adminSaveRoom,
  type AdminRoom, type Period,
} from "@/lib/studyspace.functions";
import { errorText, getAdminToken, setAdminToken, unwrap } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff admin — StudySpace" },
      { name: "description", content: "Manage rooms, timetable, blocks and bookings for StudySpace." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Staff admin — StudySpace" },
      { property: "og:description", content: "Staff panel for StudySpace." },
    ],
  }),
  component: AdminPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const card = "rounded-2xl bg-card p-4 shadow-card";
const selectCls = "h-11 rounded-xl border border-input bg-card px-3 text-base";

function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setToken(getAdminToken()); setReady(true); }, []);
  if (!ready) return <div className="p-4"><Skeleton className="h-40 w-full" /></div>;
  return token ? <Panel token={token} onLogout={() => { setAdminToken(null); setToken(null); }} /> : <AdminLogin onDone={setToken} />;
}

function AdminLogin({ onDone }: { onDone: (t: string) => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { const r = unwrap(await login({ data: { password: pw } })); setAdminToken(r.token); onDone(r.token); }
    catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className={cn(card, "space-y-4 p-6")}>
        <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Staff admin</h1>
        <div className="space-y-2"><Label htmlFor="pw">Admin password</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12 rounded-xl" autoComplete="current-password" /></div>
        {err && <p role="alert" className="text-sm font-medium text-full-strong">{err}</p>}
        <Button size="tap" className="w-full" disabled={busy || !pw}>{busy ? "Checking…" : "Log in"}</Button>
      </form>
    </main>
  );
}

function Panel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const fn = useServerFn(adminOverview);
  const q = useQuery({ queryKey: ["admin"], queryFn: async () => unwrap(await fn({ data: { token } })), refetchInterval: 30000 });
  useEffect(() => { if (q.error && (q.error as { code?: string }).code === "UNAUTHORIZED") onLogout(); }, [q.error, onLogout]);
  const d = q.data;

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div><p className="text-xl font-bold">StudySpace Admin</p><p className="text-sm opacity-80">{d ? `Today ${d.info.today}` : "Loading…"}</p></div>
          <Button variant="ghost" size="tap" className="hover:bg-primary-foreground/10" onClick={onLogout}><LogOut aria-hidden="true" /> Log out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        {!d ? (q.isError ? <p role="alert" className="text-full-strong">{errorText(q.error)}</p> : <Skeleton className="h-64 w-full rounded-2xl" />) : (
          <Tabs defaultValue="dashboard">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-secondary p-1">
              {["dashboard", "rooms", "timetable", "blocks", "bookings"].map((t) => (
                <TabsTrigger key={t} value={t} className="h-10 rounded-lg px-4 capitalize">{t}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="dashboard"><Dashboard d={d} /></TabsContent>
            <TabsContent value="rooms"><Rooms token={token} rooms={d.rooms} seatCounts={d.seatCounts} /></TabsContent>
            <TabsContent value="timetable"><Timetable token={token} periods={d.periods} /></TabsContent>
            <TabsContent value="blocks"><Blocks token={token} d={d} /></TabsContent>
            <TabsContent value="bookings"><Bookings token={token} d={d} /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

type Overview = NonNullable<Awaited<ReturnType<typeof adminOverview>>["data"]>;

function Dashboard({ d }: { d: Overview }) {
  const periods = d.periods.filter((p) => !p.is_break);
  const counted = d.bookings.filter((b) => b.status !== "cancelled");
  const cell = (roomId: number, periodId: number) => counted.filter((b) => b.room.id === roomId && b.period.id === periodId).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat k="Active now" v={d.bookings.filter((b) => b.status === "active").length} />
        <Stat k="Total today" v={counted.length} />
        <Stat k="Cancelled" v={d.bookings.length - counted.length} />
      </div>
      <div className={cn(card, "overflow-x-auto")}>
        <h2 className="mb-3 text-lg font-bold">Utilisation by period</h2>
        <table className="w-full min-w-[640px] text-sm tabular">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Room</th>{periods.map((p) => <th key={p.id} className="p-2">{p.name}</th>)}</tr></thead>
          <tbody>
            {d.rooms.map((r) => {
              const total = d.seatCounts[r.id] ?? 0;
              return (
                <tr key={r.id} className="border-t border-border">
                  <th className="p-2 text-left font-semibold">{r.name}</th>
                  {periods.map((p) => {
                    const n = cell(r.id, p.id);
                    const pct = total ? Math.round((n / total) * 100) : 0;
                    return <td key={p.id} className={cn("p-2", pct >= 100 ? "font-bold text-full-strong" : pct >= 75 ? "text-few-strong" : "")}>{n}/{total} <span className="text-muted-foreground">({pct}%)</span></td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Stat({ k, v }: { k: string; v: number }) {
  return <div className={card}><p className="text-sm text-muted-foreground">{k}</p><p className="text-3xl font-extrabold tabular">{v}</p></div>;
}

function useSaver<T>(fn: (x: T) => Promise<{ data?: unknown; error?: { code: string; message: string } | undefined }>, msg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (x: T) => unwrap(await fn(x)),
    onSuccess: () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(errorText(e)),
  });
}

function Rooms({ token, rooms, seatCounts }: { token: string; rooms: AdminRoom[]; seatCounts: Record<number, number> }) {
  const save = useServerFn(adminSaveRoom);
  const m = useSaver((room: Partial<AdminRoom> & { seats: number }) => save({ data: { token, room } }), "Room saved");
  const [draft, setDraft] = useState<(Partial<AdminRoom> & { seats: number }) | null>(null);
  return (
    <div className="space-y-3">
      <Button size="tap" onClick={() => setDraft({ name: "", type: "classroom", location_note: "", is_active: true, seats: 12 })}><Plus aria-hidden="true" /> Add room</Button>
      {draft && !draft.id && <RoomForm draft={draft} setDraft={setDraft} onSave={() => m.mutate(draft, { onSuccess: () => setDraft(null) })} busy={m.isPending} />}
      {rooms.map((r) => draft?.id === r.id ? (
        <RoomForm key={r.id} draft={draft} setDraft={setDraft} onSave={() => m.mutate(draft, { onSuccess: () => setDraft(null) })} busy={m.isPending} />
      ) : (
        <div key={r.id} className={cn(card, "flex flex-wrap items-center gap-3", !r.is_active && "opacity-60")}>
          <div className="flex-1">
            <p className="font-bold">{r.name} <span className="text-sm font-normal text-muted-foreground">· {r.type} · {seatCounts[r.id] ?? 0} seats</span></p>
            <p className="text-sm text-muted-foreground">{r.location_note}</p>
          </div>
          {!r.is_active && <span className="rounded-full bg-unavail-soft px-2.5 py-1 text-xs font-bold">INACTIVE</span>}
          <Button variant="outline" size="tap" onClick={() => setDraft({ ...r, seats: seatCounts[r.id] ?? 0 })}>Edit</Button>
          <Button variant="secondary" size="tap" disabled={m.isPending} onClick={() => m.mutate({ ...r, is_active: !r.is_active, seats: seatCounts[r.id] ?? 0 })}>{r.is_active ? "Deactivate" : "Activate"}</Button>
        </div>
      ))}
    </div>
  );
}

function RoomForm({ draft, setDraft, onSave, busy }: { draft: Partial<AdminRoom> & { seats: number }; setDraft: (d: (Partial<AdminRoom> & { seats: number }) | null) => void; onSave: () => void; busy: boolean }) {
  return (
    <form className={cn(card, "grid gap-3 sm:grid-cols-2")} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <div className="space-y-1"><Label htmlFor="rn">Name</Label><Input id="rn" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 rounded-xl" /></div>
      <div className="space-y-1"><Label htmlFor="rt">Type</Label>
        <select id="rt" className={cn(selectCls, "w-full")} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as AdminRoom["type"] })}>
          <option value="classroom">Classroom</option><option value="library">Library</option></select></div>
      <div className="space-y-1"><Label htmlFor="rs">Seats (labels A1, A2… auto-generated)</Label><Input id="rs" type="number" min={0} max={200} value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: Number(e.target.value) })} className="h-11 rounded-xl" /></div>
      <div className="space-y-1"><Label htmlFor="rl">Location note</Label><Input id="rl" value={draft.location_note} onChange={(e) => setDraft({ ...draft, location_note: e.target.value })} className="h-11 rounded-xl" /></div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" size="tap" onClick={() => setDraft(null)}>Cancel</Button>
        <Button size="tap" disabled={busy}>{busy ? "Saving…" : "Save room"}</Button>
      </div>
    </form>
  );
}

function Timetable({ token, periods }: { token: string; periods: Period[] }) {
  const save = useServerFn(adminSavePeriods);
  const m = useSaver((p: Period[]) => save({ data: { token, periods: p } }), "Timetable saved");
  const [rows, setRows] = useState(periods);
  useEffect(() => setRows(periods), [periods]);
  const upd = (i: number, patch: Partial<Period>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={cn(card, "space-y-2")}>
      {rows.map((p, i) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2">
          <Input aria-label="Period name" value={p.name} onChange={(e) => upd(i, { name: e.target.value })} className="h-11 w-24 rounded-xl" />
          <Input aria-label={`${p.name} start`} type="time" value={hm(p.start_time)} onChange={(e) => upd(i, { start_time: e.target.value })} className="h-11 w-32 rounded-xl" />
          <span aria-hidden="true">–</span>
          <Input aria-label={`${p.name} end`} type="time" value={hm(p.end_time)} onChange={(e) => upd(i, { end_time: e.target.value })} className="h-11 w-32 rounded-xl" />
          <label className="flex h-11 items-center gap-2 px-2"><input type="checkbox" className="h-5 w-5" checked={p.is_break} onChange={(e) => upd(i, { is_break: e.target.checked })} /> Break</label>
        </div>
      ))}
      <Button size="tap" disabled={m.isPending} onClick={() => m.mutate(rows)}>{m.isPending ? "Saving…" : "Save timetable"}</Button>
    </div>
  );
}

function Blocks({ token, d }: { token: string; d: Overview }) {
  const add = useServerFn(adminAddBlock);
  const del = useServerFn(adminDeleteBlock);
  const mAdd = useSaver((x: { roomId: number; periodId: number; weekdays: number[]; reason: string }) => add({ data: { token, ...x } }), "Block added");
  const mDel = useSaver((id: number) => del({ data: { token, id } }), "Block removed");
  const [roomId, setRoomId] = useState(d.rooms[0]?.id ?? 0);
  const [periodId, setPeriodId] = useState(d.periods.find((p) => !p.is_break)?.id ?? 0);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [reason, setReason] = useState("");
  const roomName = (id: number) => d.rooms.find((r) => r.id === id)?.name ?? "?";
  const periodName = (id: number) => d.periods.find((p) => p.id === id)?.name ?? "?";
  return (
    <div className="space-y-3">
      <form className={cn(card, "grid gap-3")} onSubmit={(e) => { e.preventDefault(); mAdd.mutate({ roomId, periodId, weekdays: days, reason }, { onSuccess: () => setReason("") }); }}>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Room" className={selectCls} value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>{d.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <select aria-label="Period" className={selectCls} value={periodId} onChange={(e) => setPeriodId(Number(e.target.value))}>{d.periods.filter((p) => !p.is_break).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <Input aria-label="Reason" placeholder="Reason, e.g. Class 10B Physics" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 flex-1 rounded-xl" required />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Weekdays">
          {DAYS.map((name, i) => {
            const on = days.includes(i + 1);
            return <button key={name} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i + 1) : [...days, i + 1])}
              className={cn("h-11 w-14 rounded-xl text-sm font-semibold", on ? "bg-primary text-primary-foreground" : "bg-secondary")}>{name}</button>;
          })}
        </div>
        <Button size="tap" className="w-fit" disabled={mAdd.isPending || !days.length}><Plus aria-hidden="true" /> Add block</Button>
      </form>
      <div className={card}>
        {d.blocks.length === 0 ? <p className="text-muted-foreground">No blocks.</p> : (
          <ul className="divide-y divide-border">
            {d.blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <span className="flex-1"><b>{roomName(b.room_id)}</b> · {periodName(b.period_id)} · {DAYS[b.weekday - 1]} — {b.reason}</span>
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Remove block" onClick={() => mDel.mutate(b.id)}><Trash2 aria-hidden="true" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Bookings({ token, d }: { token: string; d: Overview }) {
  const cancel = useServerFn(adminCancelBooking);
  const m = useSaver((id: number) => cancel({ data: { token, bookingId: id } }), "Booking force-cancelled");
  const [qStr, setQ] = useState("");
  const list = useMemo(() => {
    const s = qStr.trim().toUpperCase();
    return d.bookings.filter((b) => !s || b.booking_code.includes(s) || b.student?.roll_no.includes(s));
  }, [qStr, d.bookings]);

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [["Code", "Roll no", "Name", "Room", "Seat", "Period", "Start", "End", "Date", "Status"],
      ...d.bookings.map((b) => [b.booking_code, b.student?.roll_no ?? "", b.student?.name ?? "", b.room.name, b.seat.label, b.period.name, hm(b.period.start_time), hm(b.period.end_time), b.date, b.status])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `studyspace-bookings-${d.info.today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Search by roll number or code" placeholder="Roll number or code (e.g. 12A_09, SS004)" value={qStr} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-xl pl-10" />
        </div>
        <Button variant="outline" size="tap" onClick={exportCsv}><Download aria-hidden="true" /> Export CSV</Button>
      </div>
      <div className={cn(card, "overflow-x-auto")}>
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Code</th><th className="p-2">Student</th><th className="p-2">Room · Seat</th><th className="p-2">Period</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className={cn("border-t border-border", b.status !== "active" && "text-muted-foreground")}>
                <td className="p-2 font-bold tabular">{b.booking_code}</td>
                <td className="p-2">{b.student?.roll_no} <span className="text-muted-foreground">{b.student?.name}</span></td>
                <td className="p-2">{b.room.name} · {b.seat.label}</td>
                <td className="p-2">{b.period.name}</td>
                <td className="p-2 uppercase">{b.status}</td>
                <td className="p-2 text-right">{b.status === "active" && (
                  <Button variant="destructive" size="sm" className="h-10" disabled={m.isPending}
                    onClick={() => { if (confirm(`Force-cancel ${b.booking_code}?`)) m.mutate(b.id); }}>Force cancel</Button>
                )}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No bookings found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
