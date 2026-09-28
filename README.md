# Aegis SOC Console — Next.js + Prisma

A Next.js (App Router) SOC dashboard backed by a **real Prisma database**.
There is no hardcoded sample/demo alert data anywhere in this app — the
database starts with zero alerts, and every alert, timeline entry, and
report is created for real, either by the live simulation writing to the
DB or by an analyst's own actions in the UI.

## Architecture

```
app/
  page.js                              Renders <SocConsole />
  api/
    simulate/tick/route.js             POST — generates ONE real event server-side;
                                        if it crosses the risk threshold, creates a
                                        real Alert row (+ auto-emails if severe)
    ingest/ssh-bruteforce/route.js     POST — accepts a REAL detected brute-force
                                        burst from agent/ssh_bruteforce_watcher.py,
                                        running on an actual victim VM
    incidents/route.js                 GET — correlated incidents (FR-09), each
                                        with its member alerts and computed severity
    alerts/route.js                    GET  — list all alerts with relations
    alerts/[id]/route.js               PATCH — status change / reassignment / note
                                        (each appends a real TimelineEntry row)
    alerts/[id]/report/route.js        POST — manually send the incident email
    endpoints/route.js                 GET  — endpoint stats aggregated from real alerts
    analysts/route.js                  GET list / POST upsert (used by login)
    reports/route.js                   GET list / POST generate (from real alert counts)
agent/
  ssh_bruteforce_watcher.py            Runs ON a real victim VM. Zero dependencies
                                        (stdlib only). Tails the real SSH auth log and
                                        reports genuine brute-force bursts to the API.
components/                            UI only — no data lives in React state beyond
                                        what's been fetched from the API
lib/
  prisma.js                            Prisma Client singleton
  simulation.js                        Event generator + display helpers (no DB access)
  mailer.js                            Nodemailer wrapper (unchanged from before)
  reportIncident.js                    Shared "send + record" email logic used by
                                        both the manual button and the auto-email path
prisma/
  schema.prisma                        Endpoint, Analyst, Alert, TimelineEntry, Report
  seed.js                              Seeds ONLY the 20 endpoints + starter analyst
                                        roster. Zero Alert rows are seeded.
```

**Why this is a "real" simulation and not a demo fixture:** the live feed
you see running doesn't generate fake data in the browser and throw it
away on refresh. Every ~2-3 seconds the client asks the server
(`POST /api/simulate/tick`) to generate and score one event; the *server*
decides whether it's a threat, and if so, writes a real `Alert` row (with
its own `TimelineEntry`) to the SQLite database. Refresh the page, or open
it in a second browser tab, and the alerts are still there — because
they're real rows, not client memory.

## Incidents (FR-09 — correlation)

Every real Alert, right after it's created (by the simulator or the live
agent), is run through `lib/correlate.js`. If there's another alert on the
**same endpoint within the last 10 minutes**, both get grouped into a real
`Incident` row — the system's version of "correlate related security
events... into a potential incident." A lone alert with nothing else
nearby stays standalone; no Incident is created for it.

Open the **Incidents** tab in the sidebar to see them: each one expands to
show its member alerts, with severity and status (Open/Resolved) computed
live from those alerts rather than stored (so they can never drift out of
sync as you work the case). Click any alert inside an incident to open the
same case-detail drawer as everywhere else in the app.

To see one form for real: run two attacks against the same victim VM
within a few minutes of each other (e.g. an `nmap` port scan followed by a
Hydra brute-force attempt) — or just leave the synthetic simulator running
long enough for it to (occasionally) pick the same endpoint twice in a
row.

## Setup

```bash
npm install          # also runs `prisma generate` via postinstall
npm run db:migrate    # creates dev.db and applies the schema (prompts for a migration name the first time — anything works, e.g. "init")
npm run dev
```

Open http://localhost:3000, sign in with any email, and watch the Alert
queue - it starts empty and fills in as the live feed detects real
threats.

Useful extras:
```bash
npm run db:studio     # opens Prisma Studio - browse/edit the real data in a GUI
npm run db:reset       # wipes the DB and re-seeds (endpoints + analysts only)
```

## ⚠️ One thing to know before you run this

I built and wrote every file below in a sandboxed environment whose
network policy blocks `binaries.prisma.sh` (the CDN Prisma downloads its
query/schema engine binaries from). That means **I could not actually run
`prisma generate` or `prisma migrate dev` myself** to verify the database
layer end-to-end - I confirmed this is a hard network block (tried three
times, including the documented `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING`
workaround, and checked for alternate mirrors - none available).

What I *did* verify in that environment:
- `npm install` completes cleanly with **0 vulnerabilities** (had to pin
  `prisma`/`@prisma/client` to `7.10.0` and add `overrides` for two
  transitive CVEs the first resolved versions pulled in)
- `next build` gets all the way through compiling and type-checking every
  route and component with **zero errors** - it only fails at the very
  last step (`Failed to load external module @prisma/client... Cannot
  find module '.prisma/client/default'`), which is *exactly* and *only*
  the missing generated client, i.e. the one thing that needs a normal
  internet connection to `binaries.prisma.sh` to produce
- The Prisma schema, all seven API routes, and the seed script are
  reviewed carefully for correct Prisma Client API usage, but this is the
  one part of the project I'm asking you to be the first to actually run

On a normal machine this should just work with `npm install && npm run
db:migrate && npm run dev`. If something doesn't - paste me the error and
I'll fix it fast; I'd rather tell you this up front than claim I tested
something I couldn't.

## Email reporting

Unchanged from before - **Nodemailer**, since "mail.js" isn't a real
library. Two paths, both now backed by real DB writes:

1. **Automatic** - any alert the simulation creates with risk \u2265 90 gets
   an email sent (or simulated) immediately, server-side, before the
   response even reaches the browser (`SEVERE_EMAIL_THRESHOLD` in
   `lib/simulation.js`).
2. **Manual** - the "\ud83d\udce7 Send incident report email" button in any
   alert's case drawer, which hits `POST /api/alerts/[id]/report`.

Without `SMTP_*` configured, the email is logged to the **server
terminal** and the alert's `emailStatus` is set to `simulated` - both
in the database, not just in the UI. Copy `.env.local.example` to
`.env.local` and fill in real SMTP credentials to send for real (see that
file for Gmail/Mailtrap/SendGrid examples).

## Real attack ingestion (optional)

Everything above runs on the built-in synthetic simulator. If you've set up
the VirtualBox attacker/victim lab (Kali + Metasploitable2 or a plain
Ubuntu Server), you can feed **genuine** detected attacks into this same
dashboard instead of - or alongside - the synthetic ones.

**How it works:** `agent/ssh_bruteforce_watcher.py` runs *on the victim
VM*. It's a small, dependency-free Python script (standard library only)
that tails the VM's real `/var/log/auth.log` - the exact log `fail2ban`
and every real intrusion-detection tool watches - looking for
`Failed password` lines. When it sees a burst of real failed SSH logins
from the same source IP within a rolling window, it POSTs that real
detection to `POST /api/ingest/ssh-bruteforce` on this dashboard. The
route scores it on the same 0-100 risk scale as the simulator, and if it
crosses the threshold, creates a real `Alert` row tagged
`source: "live-agent"` (shown with a green "Live attack" badge in the UI,
vs. "Simulated" for the built-in feed) with the real attacker IP recorded.

**Setup:**

1. Add `INGEST_API_KEY` to your `.env.local` (see `.env.local.example`) -
   pick any random string.
2. Make sure the dashboard is reachable from your victim VM. Since both
   VMs sit on VirtualBox's isolated host-only network, and Next's dev
   server binds to `localhost` only by default, run:
   ```bash
   npm run dev:lan
   ```
   This binds to `0.0.0.0` so the host-only network can reach it. Find
   your host machine's IP on that network (VirtualBox usually assigns the
   host `192.168.56.1` - check via the Host Network Manager, or run
   `ip a` / `ipconfig` on the host and look for the adapter named
   something like `vboxnet0`).
3. Copy `agent/ssh_bruteforce_watcher.py` onto the victim VM (e.g. via
   `scp`, or just paste its contents into a new file with a text editor
   over SSH/console).
4. On the victim VM, run it:
   ```bash
   SOC_URL=http://192.168.56.1:3000/api/ingest/ssh-bruteforce \
   INGEST_KEY=<the same random string from .env.local> \
   ENDPOINT_CODE=EP-001 \
   python3 ssh_bruteforce_watcher.py
   ```
   Leave it running - it prints every failed login it sees in real time,
   and logs when it reports a burst to the dashboard.
5. From the Kali VM, run a real attack against the victim, e.g.:
   ```bash
   hydra -l msfadmin -P /usr/share/wordlists/rockyou.txt ssh://<victim-ip>
   ```
6. Watch the agent's terminal detect the real failed logins, and watch the
   Alert queue in your browser pick up the real alert within a few
   seconds - no page refresh needed, it's the same live-updating UI as the
   synthetic feed.

Full config options (window size, report threshold, cooldown, which auth
log path) are documented at the top of `agent/ssh_bruteforce_watcher.py`.

I validated the agent's actual detection logic directly (regex parsing of
a real sshd log line, sliding-window counting, threshold crossing,
per-source-IP tracking, and cooldown behavior all pass) rather than just
writing it and assuming it works - but I could not run the full live
VM-to-dashboard round trip myself, since that needs the real VirtualBox
lab and a running Prisma-generated server, neither of which exist in the
sandbox I built this in.

Only SSH brute-force is wired up to real detection right now (it's the
easiest real signal to get from a victim's own logs with zero extra
tooling). Port scans, malware-like CPU spikes, and data exfiltration stay
simulated unless you want to extend this further - e.g. port-scan
detection is very doable by having the victim VM log dropped connections
via `iptables` LOG rules and watching that log the same way; ask if you'd
like that built out too.

## Using a real database server instead of SQLite

SQLite (`DATABASE_URL="file:./dev.db"` in `.env`) is the zero-setup
default. To point this at Postgres/MySQL instead:

1. Change `provider` in `prisma/schema.prisma`'s `datasource db` block
   (e.g. `"postgresql"`)
2. Update `DATABASE_URL` in `.env` to that database's connection string
3. Run `npm run db:migrate` again
