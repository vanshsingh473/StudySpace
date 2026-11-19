import { describe, expect, it } from "vitest";
import { buildAvailability, computeStatus, mapDbError, normalizeRoll } from "@/lib/availability";

describe("availability status", () => {
  it("is FREE when more than 25% of seats are free", () => {
    expect(computeStatus(12, 0, false).status).toBe("FREE");
    expect(computeStatus(12, 8, false).status).toBe("FREE"); // 4/12 = 33%
  });
  it("shows N LEFT from 1 seat up to 25%", () => {
    expect(computeStatus(12, 9, false)).toMatchObject({ status: "FEW", label: "3 LEFT", free: 3 });
    expect(computeStatus(25, 24, false).label).toBe("1 LEFT");
  });
  it("is FULL at 0 seats", () => {
    expect(computeStatus(12, 12, false).status).toBe("FULL");
  });
  it("is UNAVAILABLE when blocked or inactive", () => {
    expect(computeStatus(20, 0, true).status).toBe("UNAVAILABLE");
    const [r] = buildAvailability([{ id: 1, name: "R", type: "classroom", location_note: "", is_active: true, total: 20, booked: 0, block_reason: "Class 10B" }]);
    expect(r?.status).toBe("UNAVAILABLE");
  });
  it("sorts free rooms first", () => {
    const base = { type: "classroom" as const, location_note: "", is_active: true, block_reason: null };
    const out = buildAvailability([
      { ...base, id: 1, name: "Full", total: 12, booked: 12 },
      { ...base, id: 2, name: "Free", total: 12, booked: 0 },
      { ...base, id: 3, name: "Few", total: 25, booked: 23 },
    ]);
    expect(out.map((r) => r.name)).toEqual(["Free", "Few", "Full"]);
  });
});

describe("double-booking prevention messages", () => {
  it("maps a seat conflict to 'Seat just taken'", () => {
    expect(mapDbError("SEAT_TAKEN")).toEqual({ code: "SEAT_TAKEN", message: "Seat just taken, pick another." });
  });
  it("maps a second booking in the same period to ALREADY_BOOKED", () => {
    expect(mapDbError("ALREADY_BOOKED").code).toBe("ALREADY_BOOKED");
  });
});

describe("roll number", () => {
  it("normalises valid roll numbers to uppercase", () => {
    expect(normalizeRoll(" 12a_42 ")).toBe("12A_42");
  });
  it("rejects invalid ones", () => {
    expect(normalizeRoll("10A_1")).toBeNull();
    expect(normalizeRoll("12A_123")).toBeNull();
  });
});
