import { describe, expect, it } from "vitest";
import { validateSignup } from "@/lib/signup-rules";

const ok = { name: "Aarav Sharma", email: "Aarav@School.in", roll: "12a_07", password: "secret123", confirm: "secret123" };

describe("student signup rules", () => {
  it("accepts a valid form and normalises roll + email", () => {
    expect(validateSignup(ok)).toEqual({ ok: true, name: "Aarav Sharma", email: "aarav@school.in", roll: "12A_07" });
  });
  it("rejects a roll number in the wrong format", () => {
    expect(validateSignup({ ...ok, roll: "10A_07" }).ok).toBe(false);
  });
  it("rejects passwords shorter than 8 characters", () => {
    expect(validateSignup({ ...ok, password: "short1", confirm: "short1" }).ok).toBe(false);
  });
  it("rejects mismatched passwords", () => {
    expect(validateSignup({ ...ok, confirm: "different1" }).ok).toBe(false);
  });
});
