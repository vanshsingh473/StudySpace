import { describe, expect, it } from "vitest";
import { buildAvailability, cleanFeedback, pickSuggestion, FEEDBACK_MAX, type RawRoom } from "@/lib/availability";

const raw = (id: number, total: number, booked: number, extra: Partial<RawRoom> = {}): RawRoom => ({
  id, name: `Room ${id}`, type: "classroom", location_note: "", is_active: true, total, booked, block_reason: null, ...extra,
});

describe("pickSuggestion", () => {
  const rooms = buildAvailability([raw(1, 12, 12), raw(2, 20, 2), raw(3, 25, 5), raw(4, 12, 0, { block_reason: "Class" })]);
  it("keeps the AI's pick when that room is bookable", () => {
    expect(pickSuggestion(rooms, 2)).toEqual({ room: expect.objectContaining({ id: 2 }), fromAi: true });
  });
  it("rejects a full room and falls back to the room with most free seats", () => {
    expect(pickSuggestion(rooms, 1)).toEqual({ room: expect.objectContaining({ id: 3 }), fromAi: false });
  });
  it("rejects a blocked room", () => {
    expect(pickSuggestion(rooms, 4)?.fromAi).toBe(false);
  });
  it("returns null when nothing is bookable", () => {
    expect(pickSuggestion(buildAvailability([raw(1, 10, 10)]), 1)).toBeNull();
  });
});

describe("cleanFeedback", () => {
  it("rejects empty or blank messages", () => {
    expect(cleanFeedback("   ")).toBeNull();
    expect(cleanFeedback(undefined)).toBeNull();
  });
  it("trims and caps at 1000 characters", () => {
    expect(cleanFeedback("  hi  ")).toBe("hi");
    expect(cleanFeedback("x".repeat(1500))).toHaveLength(FEEDBACK_MAX);
    expect(FEEDBACK_MAX).toBe(1000);
  });
});
