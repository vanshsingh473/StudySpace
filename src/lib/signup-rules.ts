import { normalizeRoll } from "./availability";

export type SignupInput = { name: string; email: string; roll: string; password: string; confirm: string };
export type SignupCheck = { ok: true; name: string; email: string; roll: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client + test-side rules for the student signup form. */
export function validateSignup(f: SignupInput): SignupCheck {
  const name = f.name.trim();
  const email = f.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your full name." };
  if (!EMAIL_RE.test(email) || email.length > 255) return { ok: false, error: "Enter a valid email address." };
  const roll = normalizeRoll(f.roll);
  if (!roll) return { ok: false, error: "Roll number looks wrong. Use a format like 12A_42." };
  if (f.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (f.password !== f.confirm) return { ok: false, error: "The two passwords don't match." };
  return { ok: true, name, email, roll };
}
