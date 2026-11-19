# Roadmap

- [x] Check whether the app can run on Vercel against the existing Lovable Cloud database
  - Result: blocked — all booking/admin logic uses the service-role key (`supabaseAdmin`), which Lovable Cloud never exposes. No key can be given to Vercel.
- [ ] User decision: publish on Lovable (recommended) vs. own Supabase project + Vercel (bigger job, needs code changes)
- [x] Public home page (see free rooms without login; login asked only to book)
- [x] AI "Suggest a spot" button (built-in AI, with "may contain mistakes" note)
- [x] Feedback button on every screen, saved with time, readable in Admin → Feedback
