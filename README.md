# Farm Workforce Platform

A job marketplace that connects agricultural workers and farm employers across Nigeria. Workers build a profile and apply for jobs for free. Employers post jobs with clear pay, review applicants and shortlist them. Moderators handle reports and verify employers.

**Stack:** React 19 + Vite (web) · Fastify 5 + Drizzle ORM (API) · PostgreSQL 17 · Docker Compose · Caddy (automatic HTTPS) · GitHub Actions

| Doc                                          | What's in it                                                      |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system fits together, key design decisions                |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)     | Putting it live on a server with HTTPS, backups, updates          |
| [docs/SECURITY.md](docs/SECURITY.md)         | Security controls and the pre-launch checklist                    |
| [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md) | The six interface languages and how to review or add translations |
| [docs/prototype/](docs/prototype/index.html) | The original static prototype, kept as a design reference         |

## Features

- **Workers:** register, build a profile (skills, experience, location), search and filter jobs, apply with a message, track and withdraw applications, get SMS (and email) updates in their own language.
- **Employers:** organisation profile, post/edit/close jobs (with drafts), view applicants, shortlist, hire or decline. A summary of new applicants by email or SMS: straight away for the first, then at most once a day, in daytime.
- **Privacy by design:** an applicant's phone and email are revealed only once they're shortlisted. Users can download all their data or delete their account.
- **Trust & safety:** one-tap job reporting, a moderation queue, job takedown, verified-employer badges, and an audit log of security and moderation events.
- **Accounts:** sign up with just a mobile number, verified by SMS code (email optional). Sign in with phone or email. Password reset by SMS code or email link, password change (signs out other devices), rate-limited sign-in.
- **Six languages:** English, Naijá (Pidgin), Hausa, Yorùbá, Igbo and French. Switch from the header, mobile menu or footer; signed-in users keep their choice on every device.
- **Made to be shared:** a WhatsApp button on every job, rich link previews (title, pay, place) on WhatsApp and social apps, and a sitemap of open jobs for search engines.
- **Operations:** jobs close after 30 days with a reminder to renew, a moderation console (overview, reports, user suspension, failed messages), off-site backups with a heartbeat, and optional Sentry error tracking.
- **Built for phones on slow networks:** mobile-first layout, code-split bundles, a light/dark theme that follows the device, and accessible forms and navigation.

## Quick start: run the whole stack in Docker

You need Docker Desktop (or Docker Engine with Compose v2).

```bash
docker compose up --build -d --wait
docker compose exec api node dist/cli.js seed --force   # optional demo data
```

Open <http://localhost:8080>. The demo accounts all use the password `demo-password-123`:

| Email                               | Role                    |
| ----------------------------------- | ----------------------- |
| `worker@demo.farmworkforce.ng`      | Worker                  |
| `greenfields@demo.farmworkforce.ng` | Employer (verified)     |
| `northstar@demo.farmworkforce.ng`   | Employer (not verified) |

To create a moderator account, run the command below. It prints a one-time password.

```bash
docker compose exec api node dist/cli.js create-admin --email you@example.com --name "Your Name"
```

If port 8080 is already in use, run `PORT=8090 docker compose up -d --wait` and open <http://localhost:8090>. Stop the stack with `docker compose down`, or `docker compose down -v` to also delete the data.

In this mode, emails (for example password-reset links) aren't sent. They're printed in the API log instead: `docker compose logs api | grep mail`.

## Local development (hot reload)

You need Node.js 24 or later and Docker (for PostgreSQL).

```bash
npm install
cp .env.example .env
npm run db:up          # PostgreSQL in Docker (also creates the test database)
npm run db:migrate
npm run db:seed        # optional demo data
npm run dev            # API on :3000, web on http://localhost:5173
```

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | API (tsx watch) and web (Vite) together                              |
| `npm test`            | All tests (API integration tests run against the real test database) |
| `npm run check`       | Format check, lint, typecheck and tests — the same checks CI runs    |
| `npm run build`       | Production builds of the API and web app                             |
| `npm run db:generate` | Create a migration after editing `apps/api/src/db/schema.ts`         |
| `npm run db:migrate`  | Apply migrations                                                     |
| `npm run db:down`     | Stop the development database                                        |

## Project layout

```text
apps/
  api/              Fastify REST API
    src/routes/     Route handlers by area (auth, me, jobs, applications, admin)
    src/db/         Drizzle schema + client;  drizzle/ holds SQL migrations
    src/plugins/    Session authentication
    src/lib/        Errors, validation, password hashing, mail, audit log
    src/cli.ts      Operational commands (seed, create-admin)
    test/           Integration tests (real PostgreSQL)
  web/              React single-page app
    src/pages/      Screens, code-split by area
    src/components/ Layout and shared UI
    src/lib/        API client, auth context, form handling
packages/
  shared/           Zod schemas, constants and types used by BOTH api and web
deploy/             nginx, Caddy, PostgreSQL init, backup/restore scripts
Dockerfile          Multi-target build: --target api | web
compose.yaml        Local full stack;  compose.prod.yaml adds production settings + HTTPS
compose.dev.yaml    Database only, for `npm run dev`
```

## Going live

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short: get a Linux server and a domain, copy `.env.production.example` to `.env` and fill it in, then run the command below. Before launching to the public, complete the checklist in [docs/SECURITY.md](docs/SECURITY.md). It includes items that code can't solve, such as legal review of the privacy notice and terms.

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build --wait
```
