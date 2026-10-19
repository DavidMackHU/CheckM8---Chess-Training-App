# CLAUDE_START_HERE.md — OpeningDrill (working name)

> A chess opening trainer with spaced repetition, inspired by Chessreps' feature set.
> **Build our own product:** original name, logo, copy, and course content. Do not copy Chessreps' text, images, branding, or their GM-authored courses.

---

## Session Start Instructions

Before doing anything else:
1. Read every existing file in this project to understand what has been built
2. Read this entire document top to bottom
3. Report back:
   - What has been completed so far
   - Which Build Order step we are on
   - What you recommend building next
4. Wait for my confirmation before writing a single line of code

---

## Progress Tracker

| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 1 | Project setup (React + TS + Vite, Express + TS, Prisma, Tailwind) | ✅ | Monorepo: `/client`, `/server`. `npm run dev` starts both. Prisma targets PostgreSQL locally too (SQLite cannot store move lists) |
| 2 | Docker + Docker Compose | ✅ | Dev: `npm run db:up` then `npm run dev`. Full stack: `npm run docker:up`, open localhost:8080 |
| 3 | Auth (register, login, JWT) | ✅ | Now Firebase Authentication: email/password, Google, password reset, verification email. The server swaps Firebase's token for its own httpOnly cookie (same-origin through the site's address). Pre-Firebase password accounts move over on first login. Run `npm run db:push` after schema changes |
| 4 | Chess board core (chess.js + react-chessboard) | ✅ | Move validation, flip board, arrows, sounds. Try it at `/analysis` (free board, no engine yet) |
| 5 | Data models + course generator + seed | ✅ | `npm run generate-course` → `content/*.json` → `npm run db:seed`. 5 starter courses generated (60 lines each, ~10 moves deep). **Still to do by hand:** prune lines, write pitch, description and comments (see `content/README.md`) |
| 6 | Course catalog + course detail pages | ✅ | Cards with board thumbnail, side, line count. Catalog on `/` and `/openings`, detail on `/course/:slug`, enroll works. The detail page lists lines with filters (type: main/sideline/checkmate/punish, style: tactical/positional, variation, your progress, search) and checkboxes; "Train selected" opens `/train/lines/:courseId?ids=...` (new lines taught, learned ones reviewed) |
| 7 | Learn mode | ✅ | The move stays hidden until the user taps **Show hint** (arrow, move name, comment). Guests: `/course/:slug/try`. Members: `/train/learn/:courseId`, 5 lines per session with "Learn more" to continue. No daily limit (removed 2026-10-19) |
| 8 | Spaced repetition engine (ts-fsrs) | ✅ | One card per line. Learned lines are due next day; `POST /api/train/result` grades and reschedules. Logic in `server/src/srs/scheduler.ts` |
| 9 | Review mode (due queue) | ✅ | From memory; a wrong move or a hint counts as a mistake → "Again". A wrong move no longer reveals the answer. `/train/review` serves due lines across all courses, most overdue first, 30 per session |
| 10 | Progress dashboard | ✅ | Due today, mastered %, streak, heatmap. `/dashboard`, fed by `GET /api/stats/me`. Days follow the player's own time zone (browser sends `X-Time-Zone`; saved on the user for leaderboard streaks) |
| 11 | XP, streaks + leaderboards | ✅ | Weekly + all-time at `/leaderboards`. XP: 5 per learned line; review 4/8/10/12 for Again/Hard/Good/Easy. Week resets Monday 00:00 UTC |
| 12 | Course creator (PGN import + move-tree editor) | ✅ | Private by default. `/creator/new` and `/creator/:id`. Owners can view, enroll in and train their own private courses |
| 13 | Community courses (publish, browse, filter) | ✅ | `/community`. Publish from the editor (needs 3 lines and a pitch), one upvote per user. No moderation or reporting yet |
| 14 | "Human moves" mode (Lichess opening explorer) | ✅ | Opponent picks moves by real-game frequency. `/train/human/:courseId`; `GET /api/explorer` is a cached proxy and needs `LICHESS_TOKEN` on the server |
| 15 | Analysis board (Stockfish WASM) | ✅ | Runs in browser, no server cost. First/back/forward/last buttons and arrow keys. Single-threaded lite build, copied into `client/public/stockfish` before dev and build. Stockfish is GPLv3: credited with a licence link in the footer |
| 16 | Testing (Jest + Playwright) | ✅ | `npm test`: 87 unit tests. `npm run test:e2e`: 42 browser tests on their own ports (5273 and 3101), so a running `npm run dev` never interferes; starts `e2e/fake-auth.mjs` in place of Firebase. Needs `npm run db:up` and seeded courses. `npm run check`: types, lint, unit tests |
| 17 | CI/CD (GitHub Actions) | ✅ | `.github/workflows/ci.yml`: checks, browser tests, Docker build. First run on GitHub passed all three jobs (33 browser tests) |
| 18 | Deployment (Vercel + Render + Supabase) | ✅ | Live: site https://check-m8-chess-training-app.vercel.app, API https://checkm8-api.onrender.com, database on Supabase. Firebase sign-in verified live (API end to end; Google pop-up by David). CI on the Firebase commit was held up by a GitHub Actions outage on 2026-10-19 |
| 19 | Polish (responsive, PWA, loading/error states, dark theme) | ✅ | Phone menu; installable app (manifest, icons, service worker: pages network-first, built files cached, API never cached); crash fallback page; "server is waking up" notice after 4s; days in local time; analysis stepping; footer credits. Dark theme only, by design |

Status key: ⬜ not started · 🟨 in progress · ✅ done

---

## Rules Claude Must Follow

- Never skip steps
- Always ask before starting next step
- Update progress tracker after each step
- Never delete working code without telling me first
- If blocked, stop and explain before trying workaround
- Files max 300 lines
- Always use TypeScript
- Run app after each step to confirm it works
- "status" = report progress table
- "stop" = halt immediately

## Edit & Undo Commands

- "undo" — revert last change
- "undo last [n]" — revert last N changes
- "revert [filename]" — restore specific file
- "show diff" — show what changed before applying
- "preview before changing" — ask permission first
- "checkpoint" — git commit current state
- "restore checkpoint" — git checkout to last save
- "what did you change" — list all modified files
- "fix only [filename]" — only edit specified file

**Before Making Any Edit:**
1. Tell me which file you are about to change
2. Tell me what you are changing and why
3. Wait for my confirmation

---

## Tech Stack ($0)

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, React Router, TanStack Query
- **Chess:** `chess.js` (rules/PGN/FEN), `react-chessboard` (board UI, MIT), `stockfish` WASM (analysis board, runs client-side)
- **Spaced repetition:** `ts-fsrs` (FSRS algorithm, same family Anki uses)
- **Scripts:** `tsx` (runs the course generator and seed script directly from TypeScript)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL in Docker (local) → Supabase PostgreSQL (production)
- **ORM:** Prisma
- **Auth:** Firebase Authentication (email/password + Google; free tier) → app's own JWT in an httpOnly cookie
- **External data:** Lichess Opening Explorer API (move frequencies), Lichess `chess-openings` dataset (CC0, ECO names)
- **Containerization:** Docker + Docker Compose
- **Deployment:** Vercel (frontend) + Render (backend)
- **Testing:** Jest + Playwright
- **CI/CD:** GitHub Actions
- **Total cost: $0**

---

## PRD

### Overview
A web app that helps chess players memorize opening repertoires. Users pick a course (e.g. London System for White), learn its lines move by move, then review them on a spaced-repetition schedule until the moves are automatic. Users can also build their own courses from PGN and share them.

**Target user:** Club and online players (~600–2000 rating) who keep forgetting their prep.

### Core Features

1. **Course catalog** — Grid of courses: board thumbnail at the key position, title, one-line pitch, author, side (White/Black), line count. Filters: side, first move (1.e4 / 1.d4 / other), difficulty, official vs community.
2. **Try the first line (guest mode)** — Any visitor can play line 1 of any course without signing up. Signup prompt after completing it.
3. **Learn mode** — For each new line the user plays their side; the move is hidden until they tap **Show hint**, which draws the arrow and shows the author's comment. Hints are free here. Opponent's moves auto-play with a short delay. Line ends with a summary.
4. **Review mode (spaced repetition)** — Queue of due lines across all enrolled courses. User must play their side from memory. Grading:
   - Any wrong move or a hint → rating = Again (the move is only shown after a hint)
   - Clean, slow (> 5s on any move) → Hard
   - Clean → Good
   - Clean + fast (< 2s avg) → Easy
   FSRS schedules the next due date. New lines have no daily limit; learn sessions hold 5 at a time.
5. **Dashboard** — Lines due today, new lines available, mastered %, current streak, 12-week activity heatmap, per-course progress bars.
6. **XP, streaks, leaderboards** — XP per reviewed line (more for clean). Daily streak if ≥ 1 review. Weekly and all-time leaderboards.
7. **Course creator** — Import PGN (with variations/comments) or build the move tree by playing on the board. Choose side. Each leaf = one line. Private by default; publish to community.
8. **Community courses** — Browse/filter published courses, enroll, upvote.
9. **"Human moves" mode** — When training a course with branching, the opponent picks among course branches weighted by how often humans play them at the user's rating (Lichess explorer). Out-of-book positions show "Opponent left your prep."
10. **Analysis board** — Free board with Stockfish eval, PGN/FEN import/export, "open in analysis" from any drill.

### Content Pipeline (how official courses are made)

All official courses are generated from public data and annotated by us. We never copy another platform's courses, comments, or line selections.

1. **Generate** — `scripts/generate-course.ts` walks the opening tree from a key position:
   - *User's side:* most-played move by masters (Lichess Masters DB), falling back to 2200+ Lichess games
   - *Opponent's side:* branches on every reply played in ≥ 5% of games (and ≥ 100 games) at 1400–2000 ratings
   - Lines stop at `--max-ply` (default 20) or when no replies qualify, and always end on the user's move
   - Output: `content/<slug>.pgn` (for review in any chess GUI) and `content/<slug>.json` (for seeding)
   - Explorer responses are cached in `.explorer-cache/` (git-ignored); optional `LICHESS_TOKEN` env var if the API requires auth
2. **Review** — open the PGN, prune lines that are too long, redundant, or unplayable; target 25–60 lines per course.
3. **Annotate** — add a one-line comment at key moments in each line (the plan, the trap, the pawn break). An LLM may draft comments from engine evals; a human edits every one.
4. **Write the pitch** — one punchy sentence + 2-sentence description per course, in our own voice.
5. **Punish common mistakes** — `npm run find-traps -- --course <slug> --write` looks up the opponent replies real players make at every course position (Lichess, 1000-1200 by default) and asks Stockfish (in Node) about each one the course does not cover. "Checkmate: ..." lines play a forced mate to the end (checked to be mate); "Punish: ..." lines show the user's best three moves after a mistake that costs at least 1.5 pawns. Appended after the generated lines, with a comment on the mistake.
6. **Seed** — `prisma/seed.ts` reads every `content/*.json` and upserts `Course` + `Line` rows by slug (idempotent, safe to re-run).

**Starter courses (v1):**
```bash
npx tsx scripts/generate-course.ts --name "London System"   --side white --moves "d4 d5 Bf4"    --out content/london-system
npx tsx scripts/generate-course.ts --name "Italian Game"    --side white --moves "e4 e5 Nf3 Nc6 Bc4" --out content/italian-game
npx tsx scripts/generate-course.ts --name "Vienna Game"     --side white --moves "e4 e5 Nc3"    --out content/vienna-game
npx tsx scripts/generate-course.ts --name "Caro-Kann"       --side black --moves "e4 c6"        --out content/caro-kann
npx tsx scripts/generate-course.ts --name "Queen's Gambit Declined" --side black --moves "d4 d5 c4 e6" --out content/qgd
```

**Content JSON shape** (output of the generator, input to the seed):
```json
{
  "title": "London System",
  "side": "WHITE",
  "startFen": "<standard start FEN>",
  "keyMoves": ["d4", "d5", "Bf4"],
  "lineCount": 42,
  "lines": [
    { "order": 1, "name": "Queen's Pawn Game: Accelerated London", "moves": ["d4","d5","Bf4","Nf6","e3"], "finalFen": "..." }
  ]
}
```
Hand-added fields (merged by the seed if present): `slug`, `description`, `pitch`, `difficulty`, and per-line `comments: { "<ply>": "text" }`.

### Project Structure
```
/client                 React + Vite app
/server                 Express API
/server/prisma          schema.prisma, seed.ts
/scripts                generate-course.ts (and future content tools)
/content                generated + annotated course JSON/PGN (committed)
/.explorer-cache        Lichess API cache (git-ignored)
```

### User Flow
1. Landing → browse catalog → "Try the first line" (guest)
2. Finish line → prompt to sign up to save progress
3. Sign up → enroll in course → Learn a session of 5 new lines (more if they like)
4. Next day → dashboard shows due lines → Review → XP + streak
5. Later → create own course from PGN → publish to community

### Pages & Components
**Pages:** `/` (landing + catalog), `/openings`, `/course/:slug`, `/train/learn/:courseId`, `/train/review`, `/dashboard`, `/leaderboards`, `/community`, `/creator/new`, `/creator/:id`, `/analysis`, `/u/:username`, `/login`, `/signup`
**Components:** `Board`, `MoveList`, `CommentPanel`, `CourseCard`, `CourseFilters`, `DrillController`, `ReviewSummary`, `ProgressRing`, `Heatmap`, `LeaderboardTable`, `PgnImporter`, `MoveTreeEditor`, `EngineEvalBar`, `Navbar`, `AuthForm`

### API Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/firebase` | Swap a Firebase ID token for the login cookie; creates or links the account |
| GET | `/api/auth/username-available?username=` | Checked before a Firebase sign-up |
| GET | `/api/auth/providers` | Whether the server has a Firebase project set |
| POST | `/api/auth/login` | Pre-Firebase password login, only to move old accounts onto Firebase |
| POST | `/api/auth/logout` | Clear cookie |
| GET | `/api/auth/me` | Current user |
| GET | `/api/courses?side=&first=&q=&community=` | Catalog / search |
| GET | `/api/courses/:slug` | Course detail + lines |
| GET | `/api/courses/:slug/first-line` | Guest preview |
| POST | `/api/courses/:id/enroll` | Enroll |
| GET | `/api/train/learn/:courseId` | Next N new lines |
| GET | `/api/train/review` | Due lines queue |
| GET | `/api/train/lines/:courseId?ids=` | Chosen lines, and which are already learned |
| POST | `/api/train/result` | Submit result `{lineId, mistakes, avgMs}` → FSRS update, XP |
| GET | `/api/stats/me` | Dashboard numbers + heatmap |
| GET | `/api/leaderboards?period=week\|all` | Rankings |
| POST | `/api/creator/courses` | Create course (PGN body) |
| PUT | `/api/creator/courses/:id` | Update tree/metadata |
| POST | `/api/creator/courses/:id/publish` | Publish |
| POST | `/api/courses/:id/upvote` | Upvote |
| GET | `/api/explorer?fen=&ratings=` | Cached proxy to Lichess explorer |

### Data Models (Prisma)
```
User        id, email (unique), username (unique), firebaseUid (unique),
            passwordHash (pre-Firebase accounts only), xp, streak,
            lastActiveDate, timeZone (default UTC), createdAt
Course      id, slug (unique), title, pitch, description, side (WHITE|BLACK),
            difficulty (BEGINNER|INTERMEDIATE|ADVANCED), keyMoves (string[]),
            keyFen (thumbnail position), source (GENERATED|PGN|MANUAL),
            authorId → User, isOfficial, isPublic, startFen, upvotes, createdAt
Line        id, courseId → Course, order, name, moves (string[] SAN),
            comments (Json: {ply: text}), finalFen, tags (string[]: type + style, set on seed/save)
Enrollment  userId, courseId, createdAt   (composite PK)
Card        id, userId, lineId, due, stability, difficulty, elapsedDays,
            scheduledDays, reps, lapses, state, lastReview  (unique userId+lineId)
ReviewLog   id, userId, lineId, rating, mistakes, avgMs, xpEarned, reviewedAt
ExplorerCache fen + ratingBucket (PK), json, fetchedAt
```

### Non-goals (v1)
- Payments / premium tier (add Stripe in v2 if traction)
- Native mobile apps (PWA only)
- Multiple languages
- Paid GM-authored content
- Copying or scraping any other platform's courses, comments, or line selections
- Importing user games from Lichess/Chess.com to find prep gaps (v2 idea)

### Success Metrics
- 30% of guests who finish "first line" create an account
- Day-7 retention ≥ 25% of signups
- Median user reviews ≥ 3 days/week
- ≥ 20 community courses published in first 2 months

---

## Build Order

1. Project setup (React + TS + Vite, Express + TS, Prisma, Tailwind)
2. Docker + Docker Compose
3. Auth (register, login, JWT)
4. Chess board core
5. Data models + course generator + seed
6. Course catalog + course detail pages
7. Learn mode
8. Spaced repetition engine
9. Review mode
10. Progress dashboard
11. XP, streaks + leaderboards
12. Course creator
13. Community courses
14. "Human moves" mode
15. Analysis board
16. Testing (Jest + Playwright)
17. CI/CD (GitHub Actions)
18. Deployment (Vercel + Render + Supabase)
19. Polish

Start with step 1. Ask me before moving to each next step.

---

## Deployment Guide

**Services needed (all free):**
- Supabase: supabase.com — PostgreSQL database
- Render: render.com — backend hosting
- Vercel: vercel.com — frontend hosting
- Firebase: console.firebase.google.com — sign-in (project `checkm8-db030`, Email/Password + Google enabled)
- GitHub: github.com — code storage
- Lichess: free personal API token (lichess.org/account/oauth/token) → `LICHESS_TOKEN`, only needed if the explorer returns 401; used locally by the generator and on Render by `/api/explorer`

**Steps:**
1. Push repo to GitHub
2. Supabase → new project → copy Session Pooler connection string → `DATABASE_URL`
3. Locally, in PowerShell: set `$env:DATABASE_URL` and `$env:DATABASE_SSL="true"`, run `npm run db:push`, then `npm run db:seed` (loads every `content/*.json`)
4. Render → New → Blueprint → pick the repo (reads `render.yaml`) → enter `DATABASE_URL` and `LICHESS_TOKEN`; `JWT_SECRET` is generated
5. Put the Render URL in `client/vercel.json`, push, then Vercel → import repo → Root Directory `client`
6. No CORS and no `VITE_API_URL`: Vercel forwards `/api` to Render, so the login cookie stays first-party
7. Firebase → Authentication → enable Email/Password and Google → add the Vercel domain under Authorized domains
8. Render env: `FIREBASE_PROJECT_ID`. Vercel env: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`. Locally: `FIREBASE_PROJECT_ID` in `server/.env`, the three `VITE_` values in `client/.env.local` (not `server/.env`)
9. Schema changes reach Supabase only by hand: point `$env:DATABASE_URL` at it and run `npx prisma db push` from `/server` **before** pushing code that needs them

**Common deployment fixes:**
1. Render deploys — move `@types/*` packages to `dependencies`, not `devDependencies`
2. Supabase connection — use the Session Pooler URL (not direct connection) for Render
3. Prisma — run `npx prisma db push` locally first; remove it from the build command
4. Supabase WebSocket — `import WebSocket from 'ws'` with an `as any` cast
5. Context limits — say `checkpoint` every 2–3 steps
6. Cold starts — Render free tier sleeps after 15 min; first request takes ~50s
7. Supabase inactivity — free tier pauses after 1 week of no use
8. Stockfish WASM — serve the worker file from `/client/public` and set COOP/COEP headers in `vercel.json` if using the multithreaded build (or use the single-threaded build to skip this)
9. Windows PowerShell blocks `npm` ("running scripts is disabled") — run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or type `npm.cmd`
10. Prisma refuses `db push --accept-data-loss` from Claude without explicit consent in that conversation; adding a unique column triggers it

---

## How to Resume a Session

```
Read CLAUDE_START_HERE.md, check the Progress Tracker,
scan existing project files, and tell me where we left off.
Do not build anything until I confirm.
```
