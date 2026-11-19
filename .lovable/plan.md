# StudySpace — student sign up & login with email, roll number and password

## What students will get
- **Sign up page**: name, class, email, roll number, password (+ confirm). 
  - Roll number must follow the school format (e.g. `11A_07`) and must **not already be used** by another account — clear message "This roll number is already registered".
  - Email must also be unique. Password minimum 8 characters, chosen by the student.
- **Login page**: email (or roll number) + password. Replaces the old roll no + 4-digit PIN login.
- **Forgot password** link → email with reset link → "Set new password" page.
- Log out button in the header; booking, My Bookings and slips only work when signed in.
- Staff admin panel keeps its current admin password login (unchanged).

## Steps
1. Bring your uploaded StudySpace app into this project (all pages, design, tests) and switch on Lovable Cloud for the database and accounts.
2. Recreate the database (rooms, seats, periods, blocks, bookings) with the existing demo rooms and timetable.
3. Link each student record to a real account: `students` gets `user_id` (unique) and `email`; `roll_no` stays unique so no two accounts share a roll number.
4. Build Sign up, Login, Forgot password and Reset password pages in the existing navy/amber style.
5. Update booking/my-bookings logic to use the signed-in student instead of the old PIN session.
6. Test: sign up → book a seat → see it in My Bookings; try signing up again with the same roll number and see it rejected.

## Technical details
- Email/password auth via Lovable Cloud (enable email auth). Signup calls a server function that first checks roll format + uniqueness, then `auth.signUp` with `emailRedirectTo`; a trigger/server step inserts the `students` row with `user_id = auth.uid()`. Unique constraint on `students.roll_no` and `students.user_id` is the final guard (race-safe), mapped to a friendly error.
- Login by roll number: server function resolves roll → email server-side only and signs in, never exposing emails to the browser.
- Replace custom token `sessions` / PIN (`student_login` RPC, `pin_hash`) with `requireSupabaseAuth` middleware; server functions look up the student by `userId`. Admin stays on its signed token + `ADMIN_PASSWORD` secret.
- RLS: students can read their own row; bookings stay server-only via the admin client after auth check. Grants added per table.
- Email confirmation stays on (default): after signup show "Check your email to confirm".
- Demo PIN students removed from seed (they can't log in without accounts).
- Vitest: roll-format and duplicate-roll rejection rules.
