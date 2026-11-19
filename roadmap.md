# Roadmap

- [x] Check whether the app can run on Vercel against the existing Lovable Cloud database
  - Result: blocked — all booking/admin logic uses the service-role key (`supabaseAdmin`), which Lovable Cloud never exposes. No key can be given to Vercel.
- [ ] User decision: publish on Lovable (recommended) vs. own Supabase project + Vercel (bigger job, needs code changes)
