# Client Dashboard

A private portal for coaching clients, styled to match [raviraman.com](https://raviraman.com).

**Clients** sign in with a one-time email link and see:

- **Appointments** from Cal.com, both upcoming and past. They can **cancel** a session or **change its time** by picking from your live availability.
- **Program dates**: the start and end of their coaching program, with a progress bar.
- **Payments & subscription** from Stripe (optional, and currently off): their plan, renewal date and recent invoices, plus a **Manage billing** button that opens the Stripe Customer Portal. This section appears only when `STRIPE_SECRET_KEY` is set.

**You (the admin)** get:

- A **report** listing every client and their sessions (date and time), with totals for sessions, hours booked, completed, upcoming and cancelled. You can filter it by date range and export it as CSV.
- **Client management**: add or remove clients and set their program dates.
- A list of **people who booked but aren't clients yet**, with one click to add each one.

## How it works

| Piece | Choice |
| --- | --- |
| App | Next.js 16 (App Router, server components and server actions) |
| Hosting | Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare) |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Sign-in | [Better Auth](https://better-auth.com) magic links, with emails sent by [Resend](https://resend.com) |
| Scheduling | Cal.com API v2 (your API key; bookings are matched to clients by attendee email) |
| Billing | Stripe API and the Stripe Customer Portal (customers are matched by email, or pinned to a `cus_…` id) |

### Security

- **Invite-only sign-in.** Only emails you add as clients (or admins) can sign in. For any other address the form shows the same message but sends no email, so it never reveals who is a client.
- **Magic links** expire after 15 minutes, work only once, and are stored hashed. Link requests are limited to 3 per minute, and that limit is kept in D1 so it holds across Workers.
- **Sessions** last 7 days in an HttpOnly, SameSite=Lax cookie (Secure in production).
- **Every server action and page checks the user's role on the server.** Before any cancel or reschedule, the booking is re-read from Cal.com to confirm the signed-in client is an attendee. A client can't view or change another client's booking, even with a guessed booking ID.
- **Late changes are blocked.** Clients can't cancel or reschedule online within `CHANGE_CUTOFF_HOURS` (default 24) of a session. They're asked to contact you instead.
- **Secrets stay on the server.** API keys never reach the browser, and card details are only ever handled on Stripe's hosted portal.
- **Hardening.** Security headers are set (HSTS, X-Frame-Options DENY, nosniff). The CSV export guards against spreadsheet formula injection.

## Local development

```bash
npm install
cp .env.example .env.local            # fill in keys (Resend is optional locally)
npm run db:migrate:local              # creates the local D1 database
npm run admin:create -- you@ramancoaching.com "Ravi Raman"
npm run dev                           # http://localhost:3000
```

Without `RESEND_API_KEY`, sign-in links are printed in the terminal running `npm run dev`.

Other scripts: `npm test` (unit tests), `npm run lint`, `npm run typecheck`, `npm run preview` (runs the production Worker build locally).

## Deploying to Cloudflare

1. **Create the database** and paste the printed `database_id` into `wrangler.jsonc`:
   ```bash
   npx wrangler login
   npx wrangler d1 create client-dashboard
   npm run db:migrate:remote
   ```
2. **Set secrets** (each command prompts for the value):
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET   # openssl rand -base64 32
   npx wrangler secret put CALCOM_API_KEY
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put RESEND_API_KEY
   ```
3. **Check the `vars` in `wrangler.jsonc`**, especially `BETTER_AUTH_URL`, which must be the exact public URL of the portal (currently `https://client-dashboard.rraman.workers.dev`). To serve the portal from your own domain, add it under Workers → your Worker → Settings → Domains & Routes.
4. **Deploy and create your admin account:**
   ```bash
   npm run deploy
   npm run admin:create -- you@ramancoaching.com "Ravi Raman" --remote
   ```

### One-time setup in the other services

- **Stripe (only if you turn billing on):** turn on the Customer Portal (Settings → Billing → Customer portal) and choose what clients may do (update card, view invoices, cancel or switch plans).
- **Resend:** verify the domain you send from (for example ramancoaching.com) so sign-in emails reach inboxes.
- **Cal.com:** nothing to configure. Clients must book with the same email you add them under. If one of them uses a different address, change their email in the portal.

## Adding clients

Go to **Clients → Add a client** and enter their name and **sign-in email**. Optionally add the program name and its start and end dates. Then tell them to sign in at your portal URL with that email.

### When a client's email changes

A client has one **sign-in email** and any number of **other booking emails**. Cal.com sessions booked under any of these addresses show on the client's dashboard and count toward their totals in the report, and the client can cancel or reschedule them. Only the sign-in email can sign in.

If a client changes jobs, edit them and replace the sign-in email with their new address. The old address is **kept as a booking email automatically**, so their history stays with them, and it can no longer be used to sign in. Changing the sign-in email also signs them out everywhere.

If someone booked under an address you don't have for them, they appear under "Bookings from people who aren't clients yet" on the report. Add that address to the client's **Other booking emails**.

An address can belong to only one client.

When billing is turned on, the form also shows a **Stripe customer ID** field. Use it only if the client's Stripe email differs from their sign-in email.

Removing a client only takes away their portal access. It doesn't touch Cal.com or Stripe.

## Changing the database schema

Edit `src/db/schema.ts`, then run:

```bash
npm run db:generate         # writes a new SQL migration to ./drizzle
npm run db:migrate:local
npm run db:migrate:remote   # before pushing to main, so the live database is ready for the new code
```

Cloudflare's automatic deploys don't run migrations, so apply them to the live database before the code that needs them ships.
