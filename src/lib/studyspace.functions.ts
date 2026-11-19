// Server functions (the StudySpace API). Every response is { data } or { error: { code, message } }.
import { createServerFn } from "@tanstack/react-start";
import { buildAvailability, normalizeRoll, type RawRoom, type RoomAvailability } from "./availability";

export type Res<T> = { data?: T | undefined; error?: { code: string; message: string } | undefined };

export interface Period { id: number; name: string; start_time: string; end_time: string; is_break: boolean; sort_order: number }
export interface PeriodInfo { now: string; today: string; weekday: number; current: Period | null; next: Period | null; bookable: Period[] }
export interface Seat { id: number; label: string; is_active: boolean; taken: boolean }
export interface BookingRow {
  id: number; booking_code: string; status: "active" | "cancelled" | "expired"; date: string; created_at: string;
  room: { id: number; name: string; location_note: string }; seat: { label: string }; period: Period;
  student?: { roll_no: string; name: string };
}

const isInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
const tok = (d: unknown) => (d as { token?: unknown })?.token;

const BOOKING_SELECT = "id,booking_code,status,date,created_at,room:rooms(id,name,location_note),seat:seats(label),period:periods(*),student:students(roll_no,name)";

// ---------- Auth ----------
export const checkSignup = createServerFn({ method: "POST" })
  .validator((d: { roll: string; email: string }) => ({ roll: String(d?.roll ?? "").slice(0, 10), email: String(d?.email ?? "").trim().toLowerCase().slice(0, 255) }))
  .handler(async ({ data }): Promise<Res<{ rollTaken: boolean; emailTaken: boolean }>> => {
    const h = await import("./ss.server");
    try {
      const roll = normalizeRoll(data.roll);
      if (!roll) throw new h.AppError("INVALID_ROLL");
      await h.rateLimit(`signup-check:${h.clientIp()}`, 30, 60);
      const [r, e] = await Promise.all([
        h.db.from("students").select("id", { count: "exact", head: true }).eq("roll_no", roll),
        h.db.from("students").select("id", { count: "exact", head: true }).eq("email", data.email),
      ]);
      return { data: { rollTaken: (r.count ?? 0) > 0, emailTaken: (e.count ?? 0) > 0 } };
    } catch (e) { return h.fail(e); }
  });

/** Sign in with roll number + password; the email is looked up server-side and never returned. */
export const loginWithRoll = createServerFn({ method: "POST" })
  .validator((d: { roll: string; password: string }) => ({ roll: String(d?.roll ?? "").slice(0, 10), password: String(d?.password ?? "").slice(0, 200) }))
  .handler(async ({ data }): Promise<Res<{ access_token: string; refresh_token: string }>> => {
    const h = await import("./ss.server");
    try {
      const roll = normalizeRoll(data.roll);
      if (!roll) throw new h.AppError("INVALID_ROLL");
      await h.rateLimit(`login:${roll}`, 8, 300);
      await h.rateLimit(`login-ip:${h.clientIp()}`, 40, 300);
      const { data: st } = await h.db.from("students").select("email").eq("roll_no", roll).maybeSingle();
      if (!st?.email) throw new h.AppError("WRONG_LOGIN");
      const c = await h.anonAuthClient();
      const { data: s, error } = await c.auth.signInWithPassword({ email: st.email, password: data.password });
      if (error || !s.session) throw new h.AppError(error?.message?.toLowerCase().includes("confirm") ? "EMAIL_NOT_CONFIRMED" : "WRONG_LOGIN");
      return { data: { access_token: s.session.access_token, refresh_token: s.session.refresh_token } };
    } catch (e) { return h.fail(e); }
  });

export const getMe = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<Res<{ id: number; roll_no: string; name: string; class_label: string }>> => {
    const h = await import("./ss.server");
    try { return { data: await h.currentStudent(data.token) }; } catch (e) { return h.fail(e); }
  });

export const adminLogin = createServerFn({ method: "POST" })
  .validator((d: { password: string }) => ({ password: String(d?.password ?? "").slice(0, 200) }))
  .handler(async ({ data }): Promise<Res<{ token: string }>> => {
    const h = await import("./ss.server");
    try {
      await h.rateLimit(`admin:${h.clientIp()}`, 10, 300);
      const expected = process.env["ADMIN_PASSWORD"];
      if (!expected) throw new h.AppError("ADMIN_NOT_CONFIGURED");
      if (data.password !== expected) throw new h.AppError("WRONG_PASSWORD");
      return { data: { token: await h.rpc<string>("create_admin_session") } };
    } catch (e) { return h.fail(e); }
  });

// ---------- Periods & availability ----------
export const getPeriodInfo = createServerFn({ method: "POST" }).handler(async (): Promise<Res<PeriodInfo>> => {
  const h = await import("./ss.server");
  try { return { data: await h.rpc<PeriodInfo>("current_period_info") }; } catch (e) { return h.fail(e); }
});

export const getAvailability = createServerFn({ method: "POST" })
  .validator((d: { token: string; periodId?: number }) => d)
  .handler(async ({ data }): Promise<Res<{ info: PeriodInfo; periodId: number | null; rooms: RoomAvailability[]; myActive: BookingRow | null }>> => {
    const h = await import("./ss.server");
    try {
      const studentId = await h.requireStudent(data.token);
      await h.rpc("expire_bookings");
      const info = await h.rpc<PeriodInfo>("current_period_info");
      const periodId = data.periodId && isInt(data.periodId) ? data.periodId
        : info.current && !info.current.is_break ? info.current.id : info.next?.id ?? null;
      const rooms = periodId ? buildAvailability(await h.rpc<RawRoom[]>("get_availability", { p_period_id: periodId, p_date: info.today })) : [];
      const { data: mine } = await h.db.from("bookings").select(BOOKING_SELECT).eq("student_id", studentId)
        .eq("date", info.today).eq("status", "active").order("created_at").limit(1);
      return { data: { info, periodId, rooms, myActive: (mine?.[0] as unknown as BookingRow) ?? null } };
    } catch (e) { return h.fail(e); }
  });

export const getRoomSeats = createServerFn({ method: "POST" })
  .validator((d: { token: string; roomId: number; periodId: number }) => d)
  .handler(async ({ data }): Promise<Res<{ room: { id: number; name: string; type: string; location_note: string; is_active: boolean } | null; block_reason: string | null; seats: Seat[] }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireStudent(data.token);
      if (!isInt(data.roomId) || !isInt(data.periodId)) throw new h.AppError("INVALID_INPUT");
      const info = await h.rpc<PeriodInfo>("current_period_info");
      return { data: await h.rpc("get_room_seats", { p_room_id: data.roomId, p_period_id: data.periodId, p_date: info.today }) };
    } catch (e) { return h.fail(e); }
  });

// ---------- Bookings ----------
export const createBooking = createServerFn({ method: "POST" })
  .validator((d: { token: string; roomId: number; seatId: number; periodId: number }) => d)
  .handler(async ({ data }): Promise<Res<BookingRow>> => {
    const h = await import("./ss.server");
    try {
      const studentId = await h.requireStudent(data.token);
      if (![data.roomId, data.seatId, data.periodId].every(isInt)) throw new h.AppError("INVALID_INPUT");
      await h.rateLimit(`book:${studentId}`, 10, 60);
      const b = await h.rpc<{ id: number }>("book_seat", { p_student_id: studentId, p_room_id: data.roomId, p_seat_id: data.seatId, p_period_id: data.periodId });
      const { data: row } = await h.db.from("bookings").select(BOOKING_SELECT).eq("id", b.id).single();
      return { data: row as unknown as BookingRow };
    } catch (e) { return h.fail(e); }
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .validator((d: { token: string; bookingId: number }) => d)
  .handler(async ({ data }): Promise<Res<{ id: number }>> => {
    const h = await import("./ss.server");
    try {
      const studentId = await h.requireStudent(data.token);
      if (!isInt(data.bookingId)) throw new h.AppError("INVALID_INPUT");
      await h.rateLimit(`book:${studentId}`, 10, 60);
      await h.rpc("cancel_booking", { p_booking_id: data.bookingId, p_student_id: studentId });
      return { data: { id: data.bookingId } };
    } catch (e) { return h.fail(e); }
  });

export const getBooking = createServerFn({ method: "POST" })
  .validator((d: { token: string; bookingId: number }) => d)
  .handler(async ({ data }): Promise<Res<{ booking: BookingRow; now: string }>> => {
    const h = await import("./ss.server");
    try {
      const studentId = await h.requireStudent(data.token);
      await h.rpc("expire_bookings");
      const { data: row } = await h.db.from("bookings").select(BOOKING_SELECT).eq("id", data.bookingId).eq("student_id", studentId).maybeSingle();
      if (!row) throw new h.AppError("NOT_FOUND");
      const info = await h.rpc<PeriodInfo>("current_period_info");
      return { data: { booking: row as unknown as BookingRow, now: info.now } };
    } catch (e) { return h.fail(e); }
  });

export const myBookings = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<Res<BookingRow[]>> => {
    const h = await import("./ss.server");
    try {
      const studentId = await h.requireStudent(data.token);
      await h.rpc("expire_bookings");
      const info = await h.rpc<PeriodInfo>("current_period_info");
      const { data: rows } = await h.db.from("bookings").select(BOOKING_SELECT).eq("student_id", studentId).eq("date", info.today).order("created_at", { ascending: false });
      return { data: (rows ?? []) as unknown as BookingRow[] };
    } catch (e) { return h.fail(e); }
  });

// ---------- Admin ----------
export interface AdminRoom { id: number; name: string; type: "classroom" | "library"; total_seats: number; location_note: string; is_active: boolean }
export interface AdminBlock { id: number; room_id: number; period_id: number; weekday: number; reason: string }

export const adminOverview = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<Res<{ info: PeriodInfo; rooms: AdminRoom[]; periods: Period[]; blocks: AdminBlock[]; bookings: BookingRow[]; seatCounts: Record<number, number> }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireAdmin(tok(data));
      await h.rpc("expire_bookings");
      const info = await h.rpc<PeriodInfo>("current_period_info");
      const [rooms, periods, blocks, bookings, seats] = await Promise.all([
        h.db.from("rooms").select("*").order("id"),
        h.db.from("periods").select("*").order("sort_order"),
        h.db.from("room_blocks").select("*").order("weekday"),
        h.db.from("bookings").select(BOOKING_SELECT).eq("date", info.today).order("created_at", { ascending: false }),
        h.db.from("seats").select("room_id").eq("is_active", true),
      ]);
      const seatCounts: Record<number, number> = {};
      for (const s of seats.data ?? []) seatCounts[s.room_id] = (seatCounts[s.room_id] ?? 0) + 1;
      return { data: { info, rooms: (rooms.data ?? []) as AdminRoom[], periods: periods.data ?? [], blocks: blocks.data ?? [], bookings: (bookings.data ?? []) as unknown as BookingRow[], seatCounts } };
    } catch (e) { return h.fail(e); }
  });

const clean = (s: unknown, max = 120) => String(s ?? "").replace(/[<>]/g, "").trim().slice(0, max);

export const adminSaveRoom = createServerFn({ method: "POST" })
  .validator((d: { token: string; room: Partial<AdminRoom> & { seats: number } }) => d)
  .handler(async ({ data }): Promise<Res<{ id: number }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireAdmin(data.token);
      const r = data.room;
      const name = clean(r.name, 60);
      const seats = Number(r.seats);
      if (!name || !["classroom", "library"].includes(String(r.type)) || !Number.isInteger(seats) || seats < 0 || seats > 200) throw new h.AppError("INVALID_INPUT");
      const row = { name, type: r.type as "classroom" | "library", location_note: clean(r.location_note), is_active: r.is_active !== false };
      let id = r.id;
      if (id) {
        const { error } = await h.db.from("rooms").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await h.db.from("rooms").insert(row).select("id").single();
        if (error) throw error;
        id = ins.id;
      }
      await h.rpc("set_room_seats", { p_room_id: id, p_count: seats });
      return { data: { id: id! } };
    } catch (e) { return h.fail(e); }
  });

export const adminSavePeriods = createServerFn({ method: "POST" })
  .validator((d: { token: string; periods: Period[] }) => d)
  .handler(async ({ data }): Promise<Res<{ ok: true }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireAdmin(data.token);
      const t = /^\d{2}:\d{2}(:\d{2})?$/;
      for (const p of data.periods ?? []) {
        if (!isInt(p.id) || !t.test(p.start_time) || !t.test(p.end_time) || p.start_time >= p.end_time) throw new h.AppError("INVALID_INPUT");
        const { error } = await h.db.from("periods").update({ name: clean(p.name, 20), start_time: p.start_time, end_time: p.end_time, is_break: !!p.is_break }).eq("id", p.id);
        if (error) throw error;
      }
      return { data: { ok: true } };
    } catch (e) { return h.fail(e); }
  });

export const adminAddBlock = createServerFn({ method: "POST" })
  .validator((d: { token: string; roomId: number; periodId: number; weekdays: number[]; reason: string }) => d)
  .handler(async ({ data }): Promise<Res<{ ok: true }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireAdmin(data.token);
      const days = (data.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
      if (!isInt(data.roomId) || !isInt(data.periodId) || !days.length) throw new h.AppError("INVALID_INPUT");
      const { error } = await h.db.from("room_blocks").insert(days.map((weekday) => ({ room_id: data.roomId, period_id: data.periodId, weekday, reason: clean(data.reason) })));
      if (error) throw error;
      return { data: { ok: true } };
    } catch (e) { return h.fail(e); }
  });

export const adminDeleteBlock = createServerFn({ method: "POST" })
  .validator((d: { token: string; id: number }) => d)
  .handler(async ({ data }): Promise<Res<{ ok: true }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireAdmin(data.token);
      const { error } = await h.db.from("room_blocks").delete().eq("id", data.id);
      if (error) throw error;
      return { data: { ok: true } };
    } catch (e) { return h.fail(e); }
  });

export const adminCancelBooking = createServerFn({ method: "POST" })
  .validator((d: { token: string; bookingId: number }) => d)
  .handler(async ({ data }): Promise<Res<{ ok: true }>> => {
    const h = await import("./ss.server");
    try {
      await h.requireAdmin(data.token);
      await h.rpc("cancel_booking", { p_booking_id: data.bookingId, p_student_id: null });
      return { data: { ok: true } };
    } catch (e) { return h.fail(e); }
  });
