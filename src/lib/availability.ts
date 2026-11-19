/** Pure, shared business rules for StudySpace (safe for client and server). */

export type RoomStatus = "FREE" | "FEW" | "FULL" | "UNAVAILABLE";

export interface RawRoom {
  id: number;
  name: string;
  type: "classroom" | "library";
  location_note: string;
  is_active: boolean;
  total: number;
  booked: number;
  block_reason: string | null;
}

export interface RoomAvailability extends RawRoom {
  free: number;
  status: RoomStatus;
  label: string;
}

/** FREE when > 25% free, "N LEFT" for 1 seat up to 25%, FULL at 0. Blocked/inactive = UNAVAILABLE. */
export function computeStatus(total: number, booked: number, unavailable: boolean): { free: number; status: RoomStatus; label: string } {
  const free = Math.max(0, total - booked);
  if (unavailable || total <= 0) return { free, status: "UNAVAILABLE", label: "UNAVAILABLE" };
  if (free === 0) return { free, status: "FULL", label: "FULL" };
  if (free / total > 0.25) return { free, status: "FREE", label: "FREE" };
  return { free, status: "FEW", label: `${free} LEFT` };
}

const ORDER: Record<RoomStatus, number> = { FREE: 0, FEW: 1, FULL: 2, UNAVAILABLE: 3 };

/** Adds status to each room and sorts: free first, then most seats free, then name. */
export function buildAvailability(rooms: RawRoom[]): RoomAvailability[] {
  return rooms
    .map((r) => ({ ...r, ...computeStatus(r.total, r.booked, !r.is_active || !!r.block_reason) }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.free - a.free || a.name.localeCompare(b.name));
}

export const ROLL_RE = /^(11|12)[A-Z]_\d{1,2}$/i;
export function normalizeRoll(input: string): string | null {
  const v = input.trim().toUpperCase();
  return ROLL_RE.test(v) ? v : null;
}

/** Maps database error codes to friendly messages. */
export const ERROR_MESSAGES: Record<string, string> = {
  SEAT_TAKEN: "Seat just taken, pick another.",
  ALREADY_BOOKED: "You already have a booking for this period.",
  PERIOD_PAST: "That period is over. Pick a current or later period.",
  INVALID_PERIOD: "That period can't be booked.",
  ROOM_UNAVAILABLE: "This room is not available right now.",
  ROOM_BLOCKED: "This room is being used by a class this period.",
  INVALID_SEAT: "That seat isn't available.",
  INVALID_ROLL: "Roll number looks wrong. Use a format like 12A_42.",
  INVALID_PIN: "PIN must be exactly 4 digits.",
  WRONG_LOGIN: "Roll number/email or password is wrong.",
  EMAIL_NOT_CONFIRMED: "Please confirm your email first — check your inbox for the link.",
  ROLL_TAKEN: "This roll number is already registered.",
  UNKNOWN_STUDENT: "We couldn't find that roll number. Ask the librarian to add you.",
  WRONG_PIN: "Wrong PIN. Try again.",
  NOT_FOUND: "Booking not found or already released.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  UNAUTHORIZED: "Your session has expired. Please log in again.",
  ADMIN_NOT_CONFIGURED: "Admin password is not set up yet.",
  WRONG_PASSWORD: "Wrong admin password.",
  INVALID_INPUT: "Some details are missing or invalid.",
  AI_UNAVAILABLE: "The suggestion helper is busy right now. Pick any room marked FREE below.",
  FEEDBACK_EMPTY: "Please write a short message first.",
};

export function mapDbError(message: string | undefined): { code: string; message: string } {
  const code = message && ERROR_MESSAGES[message] ? message : "SERVER_ERROR";
  return { code, message: ERROR_MESSAGES[code] ?? "Something went wrong. Please try again." };
}

/** Seconds from an IST "HH:MM:SS" now to an "HH:MM:SS" end time. */
export function secondsUntil(nowTime: string, endTime: string): number {
  const toS = (t: string) => {
    const [h, m, s] = t.split(":").map(Number);
    return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s || 0);
  };
  return Math.max(0, toS(endTime) - toS(nowTime));
}

// ---------- "Suggest a spot" ----------
/** Rooms that can actually be booked right now (FREE or a few seats left). */
export function bookableRooms(rooms: RoomAvailability[]): RoomAvailability[] {
  return rooms.filter((r) => r.status === "FREE" || r.status === "FEW");
}

/** Keeps the AI's pick only if it is a bookable room; otherwise falls back to the room with the most free seats. */
export function pickSuggestion(rooms: RoomAvailability[], aiRoomId: unknown): { room: RoomAvailability; fromAi: boolean } | null {
  const ok = bookableRooms(rooms);
  if (ok.length === 0) return null;
  const hit = ok.find((r) => r.id === Number(aiRoomId));
  if (hit) return { room: hit, fromAi: true };
  const best = [...ok].sort((a, b) => b.free - a.free || a.name.localeCompare(b.name))[0]!;
  return { room: best, fromAi: false };
}

// ---------- Feedback ----------
export const FEEDBACK_MAX = 1000;
/** Trims a feedback message; returns null when empty. Long messages are cut to FEEDBACK_MAX characters. */
export function cleanFeedback(message: unknown): string | null {
  const v = String(message ?? "").trim().slice(0, FEEDBACK_MAX);
  return v.length > 0 ? v : null;
}
