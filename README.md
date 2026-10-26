# Coach Platform – Internal Portal

The staff-only side of the coaching software: who's signed up, who's on trial, who's paying, who has gone quiet, and notes on every coach.

The coach-facing app lives in the separate `coach-platform` repo. Both use the same Supabase project.

## What's in this version

- **Overview** – coaches, monthly recurring revenue, trials and trials ending, weekly sign-ups, usage, coaches who've gone quiet.
- **Coaches** – every account with plan, status, last sign-in and usage. Filter and search.
- **Coach detail** – usage counts, account settings (plan, status, trial end, price, source) and internal notes (support, feedback, calls, billing).

## Privacy

Staff see counts only. The portal cannot read a coach's clients, notes, sessions or invoices; that data stays protected by the coach app's security rules. This matters for coaching confidentiality and the ICF Code of Ethics.

## Access

Only people on the `staff` table can sign in. Staff use the same login as the coach app. To add someone, run the line at the bottom of `supabase/migrations/20261027000001_internal_portal.sql` in Supabase's SQL editor.

## Setup

1. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_APP_URL` to the coach app's address.
2. `npm install`, then `npm run dev`.
3. On Vercel, create a new project from this repo and add the three variables from `.env.example`.

The database changes are already applied to the live Supabase project.

## Next to build

- Stripe subscriptions, so plan and status update themselves
- Trial-ending and win-back emails
- Support inbox linked to coach notes
- Feature flags per coach
