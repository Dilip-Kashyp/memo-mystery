# The Memo Mystery: a ZCQL detective game on Zoho Catalyst

Memo, the mascot of **ReactHyderabad**, has been kidnapped at Meetup #42. Players solve the case by writing
**ZCQL** queries against a **Catalyst Data Store**, and along the way they learn how Catalyst works:
system columns (`ROWID`, `CREATEDTIME`…), foreign keys, the `*`/`?` wildcards, `LIMIT offset, count`,
joins on `ROWID`, `GROUP BY` with aggregates, and how a Catalyst function runs ZCQL through the SDK.

The format is inspired by Knight Lab's SQL Murder Mystery. The story, data and code here are original.

```
client/                      Web Client Hosting (static HTML/CSS/JS)
functions/zcql_api/          Advanced I/O function (Node.js 20 + Express + zcatalyst-sdk-node)
  index.js                   routes: /schema /query /check /admin/*
  lib/schema.js              table definitions (single source of truth)
  lib/guard.js               read-only query validation + table whitelist
  lib/game.js                answer checking (kept server-side, so no spoilers in the browser)
  lib/seeder.js              loads seed data, resolving foreign keys to live ROWIDs
  data/seed-data.json        the evidence (generated)
dev/                         local simulator: SQLite that emulates ZCQL rules
scripts/generate-seed.js     regenerates seed-data.json (deterministic)
scripts/verify-solution.js   plays the case end to end and asserts a unique solution (HOST ONLY: spoilers)
scripts/seed-catalyst.sh     seeds the real Data Store through the deployed function
```

---

## 1. Play it locally (no Catalyst account needed)

Requires Node.js 22.13 or newer (it uses the built-in `node:sqlite`).

```bash
node dev/server.js          # → http://localhost:3000
node scripts/verify-solution.js   # sanity check: one kidnapper, one mastermind
node scripts/verify-guided.js     # verify guided queries and decoy choices
node scripts/verify-arena.js      # verify all 30 arena questions and scoring
```

The badge in the top-right shows **local simulator**. The simulator enforces the main ZCQL rules
(`*` wildcards, FK→ROWID joins, max 4 joins and 5 WHERE conditions), but the real Catalyst project is
the source of truth.

Click **Start investigation** to enter the play arena. Each timed round has three tile-built
queries from one of ten cases (30 questions total). Only the current question’s tables are shown.
Each beginner question uses one table, at most ten answer tiles, and two decoys. Prompts focus on
showing, filtering, sorting, limiting, or counting records without joins or grouped totals.
Tap tiles in order to build a formatted query, then **Run query** to see records and feedback.
Each question gets one scored attempt; continue after a right or wrong answer. Three correct
queries earn **Master Detective**. The timer stops after the third answer is checked.
**Exit game** discards an active round without recording a score. Each new game asks for a fresh
detective name; names are not prefilled from the previous game.

Cases rotate in a shuffled queue without repeating until all ten have been played. The queue
and local leaderboard are stored in IndexedDB (`memo-detective-bureau`). The leaderboard shows
the top ten completed rounds at any score, ranked by score and then fastest time. They stay on this browser and device. An active round survives
refresh in session storage, and its timer keeps running while away. If browser storage is
blocked, the game remains playable and explains that scores cannot be saved. The academy
keeps its manual carousel and opens unranked tile practice for each lesson.

The current question bank and grading live in `functions/zcql_api/lib/arena.js`.
`GET /arena` returns question tiles and their schemas, without solutions. `POST /arena/query`
executes the read-only query and grades the assembled tile order on the server. The original
long-form mystery’s backend and host walkthrough remain available for reference.

## 2. Deploy to Zoho Catalyst

### 2.1 Create the project and CLI link
1. Create a project in the [Catalyst console](https://console.catalyst.zoho.com).
2. Install and log in to the CLI: `npm install -g zcatalyst-cli` then `catalyst login`.
3. In this folder, link the project. Run `catalyst init`, choose the existing project, and **do not
   overwrite** the existing `functions/` or `client/` folders. This creates `.catalystrc`.

### 2.2 Create the Data Store tables
In **Cloud Scale → Data Store**, create these 8 tables **in this order** (foreign keys need their parent
table to exist first). Column names are case-sensitive. ROWID, CREATORID, CREATEDTIME and
MODIFIEDTIME are added automatically.

| Table | Columns (name: type) |
|---|---|
| **Persons** | full_name: VarChar(100), address_number: Int, address_street: VarChar(100), area: VarChar(60), company: VarChar(100), github_handle: VarChar(60) |
| **Meetup_Events** | event_name: VarChar(120), event_date: Date, venue: VarChar(120), city: VarChar(60) |
| **Incident_Reports** | incident_date: Date, city: VarChar(60), incident_type: VarChar(60), details: Text |
| **Event_Checkins** | event_id: Foreign Key → Meetup_Events, person_id: Foreign Key → Persons, badge_type: VarChar(30), checkin_time: DateTime, checkout_time: DateTime |
| **Witness_Statements** | person_id: Foreign Key → Persons, statement_date: Date, transcript: Text |
| **Cab_Rides** | person_id: Foreign Key → Persons, ride_date: Date, pickup_location: VarChar(120), drop_location: VarChar(120), vehicle_type: VarChar(30), vehicle_number: VarChar(20), fare: Double |
| **Commit_Logs** | person_id: Foreign Key → Persons, repo_name: VarChar(120), commit_message: VarChar(255), committed_at: DateTime |
| **UPI_Payments** | payer_id: Foreign Key → Persons, payee_id: Foreign Key → Persons, amount: Double, txn_note: VarChar(120), txn_date: Date |

The exact definitions live in [functions/zcql_api/lib/schema.js](functions/zcql_api/lib/schema.js).

### 2.3 Deploy
Pushes to `master` deploy automatically (see [Continuous deployment](#continuous-deployment)).
To deploy by hand:

```bash
openssl rand -hex 24 > .admin-key          # once; .admin-key is git-ignored
ADMIN_KEY="$(cat .admin-key)" ./scripts/deploy.sh
```
`catalyst-config.json` always keeps the placeholder `"ADMIN_KEY": "change-me"`. **Never commit a real
key.** `deploy.sh` swaps the key in only while it deploys. Without a key, the `/admin/*` routes stay
disabled.

Live app: https://memo-mystery-60097076678.development.catalystserverless.in/app/index.html

### 2.4 Load the evidence
```bash
APP_URL=https://<your-app-domain> ADMIN_KEY="$(cat .admin-key)" ./scripts/seed-catalyst.sh
# re-seed from scratch:
RESET=1 APP_URL=... ADMIN_KEY=... ./scripts/seed-catalyst.sh
```
Seeding goes one table per request. The parents go first, and each child row's foreign key is resolved
to the parent's real `ROWID`. The final status call should show these counts: Persons 130,
Meetup_Events 7, Incident_Reports 36, Event_Checkins 239, Witness_Statements 19, Cab_Rides 156,
Commit_Logs 146, UPI_Payments 172.

Open the app URL. The badge now reads **Catalyst Data Store**.

### 2.5 Before your event
- Play the case once on Catalyst using the queries in `scripts/verify-solution.js` (ROWIDs will differ
  from the simulator's). This confirms that real ZCQL behaves the way the hints describe.
- Point players at the ZCQL 101 cards. As a bonus round, have them run the same queries in the
  **ZCQL console** inside the Catalyst web console.

## Continuous deployment
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) keeps Catalyst in sync with `master`:

| Event | What runs |
|---|---|
| Pull request, or push to any branch | Syntax checks, a check that seed data is up to date, and a full playthrough of the case (`verify-solution.js`) |
| Push to `master`, or a manual run (Actions → *Deploy to Catalyst* → Run workflow) | All of the above, then a deploy to Catalyst Development and a smoke test of the live app |

It needs two repository secrets (Settings → Secrets and variables → Actions):
- `CATALYST_TOKEN`: from `catalyst token:generate` (run it while logged in to the IN data centre).
  Revoke it with `catalyst token:list` / `catalyst token:revoke <id>`.
- `ADMIN_KEY`: the same value as your local `.admin-key`.

The deploy changes **code only**. It doesn't touch Data Store tables or rows. If you change the story
data, re-seed by hand:
`RESET=1 APP_URL=https://memo-mystery-60097076678.development.catalystserverless.in ADMIN_KEY="$(cat .admin-key)" ./scripts/seed-catalyst.sh`

## How the game stays safe
The function runs ZCQL with admin scope, so [lib/guard.js](functions/zcql_api/lib/guard.js) is the gate:
a single `SELECT` only, no write or DDL keywords outside string literals, no comments, and only the 8 game
tables. Answers are checked server-side in [lib/game.js](functions/zcql_api/lib/game.js), and the
`/admin/*` routes require the `x-admin-key` header.

## Changing the story
Edit `scripts/generate-seed.js`, then run:
```bash
node scripts/generate-seed.js && node scripts/verify-solution.js
```
If you change the answers or the solution path, also update `lib/game.js`, the hints in `client/app.js`
and the asserts in `verify-solution.js`. Then re-seed Catalyst with `RESET=1`.

## Solution (spoilers)
<details><summary>Show</summary>

Kidnapper: **Vikram Chowdary**. He was a Speaker who checked out of Meetup #42 at 20:46, took an auto
with plate TS09UB4417 that night, and pushed a "relocate memo" commit during the Hooks workshop.

Mastermind: **Rhea Kapoor**. She paid Vikram ₹21,000 in November and was an Organizer at Meetups #40, #41
and #42. Kiran Kumar is a red herring: he paid the same total but was never an organizer.
</details>
