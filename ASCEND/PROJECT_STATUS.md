# LOOKSMAX → ASCEND — PROJECT STATUS

> **Current stage: Vercel Preview Preparation (after Stage 4.3 Barrett Memory — locally built & verified in Node suites + HTTP smoke test; Preview deployment NOT yet run, NOT Production-ready, `LM.VERSION = 0.4.6-redesign`).**
> Stage 3.7 follows the comparative audit against `design-reference/ascend-ui-mockup.png` across mobile (`390×844`) and desktop (`1440×900`): restructures `Home` (open enlarged hero with Barrett portrait, header without date, Level card without streak chip, `36px` readable tasks, desktop `780px` symmetry), moves secondary `Home` widgets into `#/tasks`, refines `Progress` to strictly 4 primary blocks (`7D/30D/90D/1Y` pills, clean smooth bezier chart without X-axis date labels and strictly real user data, `Серия`/`Уровень`, `Привычки`), and keeps storage/XP/achievements/IndexedDB/backups completely untouched.

> Read this file first when continuing the project in a new session or account.
> Do NOT rewrite the app from scratch and do NOT change the approved visual design.

## Project
Gamified self-improvement web app (looks, skin, hair, body, style, grooming, health) inspired by Duolingo, with AI mentor Barrett (`/api/barrett/*`).
Premium minimalist dark graphite & orange UI (plus WCAG-checked warm mineral light theme). User progress/chats remain local-first in the browser (no account/DB), paired with a stateless Node/Express API proxy for Barrett AI.

## Tech
Frontend (`ASCEND/`): Plain HTML + CSS + JavaScript (no frontend bundler; fonts bundled in `ASCEND/fonts/`, OFL).
Backend (root `server.js` + `server/`): Node.js + Express (`^5.3.0`) + `@google/genai` (`^3.6.1`) + REST fallback to Cloudflare Workers AI.
Data: `localStorage` (`ascend.state`, `ascend.chat.v1`, `ascend.practice`) + `IndexedDB` (`ascend-photos`).

## File structure
```
package.json                        Node scripts, dependencies (express, @google/genai), and Vercel engines.node (22.x)
.vercelignore                       Excludes archive/, tests/, exports/, docs/, design-reference/, benchmark/ from Vercel
scripts/build-public.js             Reproducible build script: copies ASCEND runtime into public/ & verifies 51 static links
public/                             Generated Vercel CDN static output (index.html, css/, js/, fonts/, assets/; ~7.0 MB)
archive/aistudio-assets/            Archived legacy AI Studio uploads moved out of public/ (excluded from deploy)
server.js                           Root Express entrypoint (exports app, mounts /api/barrett, serves ASCEND/ with public/ fallback)
server/barrett.js                   Barrett API router (/health, /chat, /analyze, /guide), schemas, safety, rate guard
server/ai-provider-router.js        Provider router (Gemini primary + opt-in Cloudflare Workers AI fallback + budget/retry)
ASCEND/index.html                   Shell, loads frontend scripts in strict order using root-relative / paths
ASCEND/css/styles.css               All styling, design tokens in :root (dark + light theme, /fonts/ URLs)
ASCEND/fonts/                       Inter Variable (Cyrillic + Latin WOFF2), Barlow, Barlow Condensed, JetBrains Mono + licenses
ASCEND/assets/avatars/              Barrett, Chico, Duo chat avatars + barrett-portrait.png (Home hero portrait)
ASCEND/assets/brand/                Approved ASCEND/Barrett icons & favicons
ASCEND/assets/cats/                 7 dark studio category photographs
ASCEND/assets/guides/               8 dark studio guide photographs (mapped across 28 guides)
ASCEND/design-reference/            Original design mockups & portraits (excluded from public/ & Vercel deploy)
ASCEND/js/data.js                   CONTENT ONLY: categories, 28 guides, 18 habit tasks, XP table, 16 achievements
ASCEND/js/practices.js              Stage 3.3 interactive routines for all 28 guides, PracticeStore (`ascend.practice`)
ASCEND/js/demos.js                  Articulated SVG motion/posture demo renderer (`LM.demoSVG`)
ASCEND/js/i18n.js                   i18n core: LM.t / LM.tn / LM.I18n (default ru)
ASCEND/js/i18n/ru.js, en.js         Complete RU & EN dictionaries (UI, guides, practices, chat, errors)
ASCEND/js/store.js                  Persistence: LM.Store (localStorage), LM.Photos (IndexedDB), image resize helper
ASCEND/js/backup.js                 Export/import: validation, atomic apply with rollback (LM.Backup)
ASCEND/js/game.js                   Rules: XP, levels, streak, daily tasks (seeded by date), achievements, stats
ASCEND/js/ui.js                     Helpers: SVG icons, escaping, toasts, level-up overlay, sheets, confirm dialog
ASCEND/js/views.js                  Main screens: home, tasks, guides, guide detail, practice, progress, profile, settings
ASCEND/js/chat-store.js             Chat persistence (`ascend.chat.v1`): threads, pins, archive, Barrett long-term memory
ASCEND/js/chat-api.js               Frontend proxy client (`/api/barrett/chat`, `/api/barrett/health`) + memory sync
ASCEND/js/chat-views.js             Chat list, search, Barrett/Chico/Duo thread views, attachment & retry UI
ASCEND/js/app.js                    Hash router, practice timer loop, click delegation, settings/consent sheets, boot
ASCEND/tests/stage-1-*.test.js      Stage 1 Barrett intelligence & chat integration suites
ASCEND/tests/stage-2-*.test.js      Stage 2 chat management & multimodal chat suites
ASCEND/tests/stage-4-1-api.test.js  Stage 4.1 Barrett backend API, rate guard & safety suite
ASCEND/tests/stage-4-2-cloudflare-fallback.test.js  Stage 4.2 Cloudflare opt-in fallback, timeout & isolation suite
ASCEND/tests/stage-4-3-memory-and-resilience.test.js Stage 4.3 Barrett long-term memory & isolation suite
ASCEND/tests/stage-a.test.js        Playwright v1->v3 migration suite (requires Playwright + OLD_ROOT)
ASCEND/PROJECT_STATUS.md            This file
```
Script order in `ASCEND/index.html` matters: `data -> practices -> demos -> i18n/en,ru -> i18n -> store -> backup -> game -> ui -> views -> chat-store -> chat-api -> chat-views -> app`. Everything hangs off `window.LM`.

## Game rules (implemented in js/game.js, numbers in js/data.js `LM.XP`)
- Level N -> N+1 costs `100 + 25*(N-1)` XP. Cumulative XP to reach level L = `100(L-1) + 12.5(L-1)(L-2)`.
- XP: habit task 10–25 (per task), perfect day bonus 25, photo check-in 15 (max once/day). **No XP for reading / marking a guide as studied** (LM.XP.guideStudy = guideTask = 0, decision of Stage A); the studied status is kept separately (`state.studied`). No XP for attractiveness ratings.
- Daily tasks: 1 guide task + 3 habit tasks, generated deterministically from the local date, persisted. Guide task completes when that guide is marked studied. Tasks cannot be un-completed (prevents XP farming).
- Streak: counts once per local calendar day, on the first XP-earning action (opening the app does not count). Missing a whole day resets the current streak to 0; best streak is kept.
- Achievements are checked after every XP/favorite/photo event.

## Implemented and checked
- 5-tab navigation (HOME, GUIDES, PROGRESS, PROFILE, SETTINGS) with hash routing and guide detail pages; mobile bottom bar with safe-area padding and 248px desktop left rail
- HOME: greeting + date + Settings gear, avatar + level/XP bar, streak with flame, dynamic headline, daily tasks, weekly mini-chart + stats, guide of the day, 7 categories + ALL shortcut
- GUIDES: search, scrollable category/SAVED filter chips, 7 category overview cards with real studied counts + "Browse all 28 guides" toggle, filtered guide list, detail with all 10 required fields + evidence scale + risks (sticky desktop metadata column + Stage 6-7 extension comment)
- PROGRESS: level/XP, vertical-bar primary `LM.trendChartSVG` (7D/30D from `LM.Game.lastDays`, zero days anchored on baseline), current/best streak, today/week/total stats, achievements, before/after compare, photo gallery, completed methods, task history with "show more"
- PROFILE: `.avatar-ring` progress wrapper around `LM.avatarHTML('lg')`, nickname, achievements, stats, links to favorites/photos/overview, Settings gear
- SETTINGS: direct RU/EN segmented cards + full language selector (`[data-k="lang"]`), 1-tap Dark Mode switch + Appearance sheet (`[data-k="look"]`), notifications, nickname, avatar, privacy (blur photos), data (export/import JSON, erase all), bottom Reset Progress action, about (`LM.VERSION = 0.4.2-stage3.2`)
- Stage 3.2 verification run: `node --check` on modified JS modules, offline asset/external-URL audit, `compile_applet` + `lint_applet`, HTTP 200 checks (incl. all 7 `assets/cats/*.jpg` images), Node VM rendering/rules & `T11/T12/T14/T15` DOM contract checks across EN/RU, and programmatic WCAG AA (>= 4.5:1) contrast checks on Dark & Light tokens.

## Known limitations / not verified
- Web notifications only fire while the page is open (no service worker / push). Real push needs the Android app or a PWA service worker.
- Stage 3.2 has not yet been executed in Playwright/Chromium (`tests/stage-a.test.js` requires Playwright + `OLD_ROOT`, neither installed in this environment), nor visually inspected on a rendered Chromium canvas, real phones, or Firefox/Safari.
- Live headless Chromium verification in Playwright completed for Stage 3.7 (`390×844` and `1440×900`, Dark & Light, RU & EN) with zero console errors, zero failed requests, and zero horizontal overflow across `#/home`, `#/tasks`, `#/guides`, `#/guide/:id`, `#/progress`, `#/progress/{photos,history,methods}`, `#/profile`, and `#/settings`. Full `OLD_ROOT` migration suite (`tests/stage-a.test.js`) still requires `OLD_ROOT` path from the original LOOKSMAX 0.1.0 build.
- i18n layer supports complete Russian (default) and English UI & catalog translation with dynamic switching and zero leftover untranslated UI strings.
- Guide texts are educational summaries; they should be reviewed by a qualified person before any public release.
- Default user avatar is an initial on a circle badge (`LM.avatarHTML`); Barrett AI chat, multimodal image support, long-term memory, and Home portrait are implemented (Stages 4.1–4.3), while Chico/Duo backend AI wiring and character evolution remain future work.

## Storage schema v3 (Stage A + Stage 2)
- Schema history: v1 = LOOKSMAX 0.1.0; v2 = language + history refs (Stage A); v3 = rebrand: untouched default nickname `LooksMaxxer` -> `Ascender` (a chosen nickname is never changed).
- New keys: localStorage `ascend.state`, IndexedDB `ascend-photos`, marker `ascend.migration`, `ascend.lastReminder`.
- Legacy keys (`looksmax.v1`, `looksmax-photos`, `looksmax.lastReminder`) are the SOURCE of the one-time migration and are never deleted by it.
- Migration order: parse -> automatic backup -> upgrade in memory -> copy photos (IDB->IDB) -> write new state -> verify field by field + SHA of photos in tests -> write marker -> switch. Any failure removes the new data and the app runs on the legacy keys ("compatibility mode"), writing the EXACT v1 shape (version 1, no settings.language, no history.ref; language kept in `ascend.language`), so LOOKSMAX 0.1.0 can still read it. Next start retries.
- Future schema changes: add `MIGRATIONS[n]` in store.js, bump VERSION; a `pre-schema` backup is made automatically.
- Automatic backups (progress only, last 3 per kind, `pre-migration` never rotated): pre-migration, pre-import, pre-reset, pre-restore, pre-schema. Restore from Settings > Data.
- Backup file format 2 (`app:'ascend'`); files from LOOKSMAX (`app:'looksmax'`, format 1) are accepted. Import is validate-first and atomic (photos in one IndexedDB transaction, snapshot rollback).
- "Erase all data" removes everything incl. legacy keys, both photo DBs and all automatic backups.

## Tests
`OLD_ROOT=<original looksmax folder> SCRATCH=<dir> node tests/stage-a.test.js` (Playwright, isolated browser contexts; the original app creates real v1 data through its UI, the new one migrates it). 15 scenarios (T1-T13 Stage A, T14-T15 rebrand), see file header.

## Stage 2 (rebrand) — what changed
- Name ASCEND everywhere in the UI: title, noscript, desktop poster, About, notifications (title `ASCEND`, tag `ascend`), Settings row, error log. Slogan `BECOME YOUR BEST VERSION.` (ru: СТАНЬ ЛУЧШЕЙ ВЕРСИЕЙ СЕБЯ.) via `brand.slogan`.
- Icons: `assets/brand/` = the approved Barrett base image (1254x1254, original kept) + plain downscales (favicon-32, apple-touch-icon-180, icon-192, icon-512). No cropping/recolouring. PWA manifest comes in Stage 11.
- Deliberately NOT renamed (would break data/behaviour): legacy storage keys `looksmax.v1`, `looksmax-photos`, `looksmax.lastReminder`; daily-plan seed string `looksmax:`; `app:'looksmax'` accepted in old backups. Guide texts are untouched (health-mind still mentions "looksmaxxing communities").

## Approved decisions
- Guide->practice map approved with 5 amendments (docs/GUIDES_PRACTICE_MAP.md).
- Stage 7 rule: studying a guide is not a completed practice and must not count toward Perfect Day; the bonus needs ALL scheduled practices and habits. (Today the guide task still counts; remove in Stage 7.)

## Stage 3 (redesign) — what changed
- Restyled `css/styles.css` with Graphite & Orange dark palette (`#09090b` / `#131316` / `#ff6b1a`), Warm Mineral light palette (`#f4f4f1` / `#ffffff` / `#c2410c`), Film Grain + Reduce Motion preserved, rounded cards, tabular numerals, mobile safe-area bottom clearance, 248px desktop left rail + `#nav`, and centered desktop `.sheet` dialogs.
- Updated `views.js`, `ui.js`, `app.js`, `index.html`, and `i18n/en.js` + `i18n/ru.js` (6 new flat keys): Home 2-column desktop layout + Settings gear; Guides category overview cards + `"Browse all 28 guides"` toggle + empty-state reset; Guide Detail 2-column sticky layout + Stage 6-7 boundary comment; Progress `LM.trendChartSVG` vertical daily XP chart + 2-column desktop grid; Profile `.avatar-ring` wrapper (leaving `LM.avatarHTML` unchanged); Settings contracts and `T1-T15` selectors preserved.
- Protected files untouched: `data.js`, `game.js`, `store.js`, `backup.js`, `i18n.js`, `tests/stage-a.test.js`, brand/barrett/font assets.

## Stage 3.1 (visual alignment) — what changed
- Refined `css/styles.css`, `js/views.js`, `js/ui.js`, and `js/app.js` (`LM.VERSION = 0.4.1-stage3.1`) to align all 5 main screens with `design-reference/ascend-ui-mockup.png`: calm `Barlow` Sentence/Title Case headings & nav labels (keeping `Barlow Condensed` for large tabular numbers), mobile `.home-brand` header + pill CTA on Home, uncluttered watermark `.catcard` grid & `gcat` `showAll` fix on Guides, `7D`/`30D` pill selector + `.xpcard` + paired `.duo` Streak & Level + `.glyph.sm` methods + desktop `.ba` `max-width: 520px` on Progress, centered `.pf-hero` + accented `--ring-track` on Profile, muted Settings row icons + `.ok` green positive deltas.
- Protected files verified untouched: `data.js`, `game.js`, `store.js`, `backup.js`, `i18n.js`, `i18n/en.js`, `i18n/ru.js`, `tests/*`, `fonts/*`, `assets/*`, `design-reference/*`.

## Stage 3.2 (visual composition overhaul) — what changed
- Redesigned layout composition and visual hierarchy across `css/styles.css`, `js/views.js`, `js/ui.js`, `js/app.js` (`LM.VERSION = 0.4.2-stage3.2`), and `index.html`, adding 7 custom local dark studio category stills (`assets/cats/{face,skin,hair,body,style,grooming,health}.jpg`):
  - **Home**: Open greeting `.home-welcome` (`hello` preserves nickname for `T14`), unified `.level-card` combining level/XP/bar + inline streak chip, single primary anchor `.card.tasks-focal` with dominant orange pill CTA, quiet secondary rail (`weekly` + `gotd`), and clean horizontal `.catpills` row replacing the 8-square grid.
  - **Guides**: Capsule search bar (`#gq`) + header focus trigger, horizontal filter pills (`#gchips`), and tall photographic `.catcard` showcases (`assets/cats/*.jpg` + smooth dark left scrim + CSS fallback) replacing watermark code cards.
  - **Progress**: Full-width `.seg.prog-seg` (`7D`/`30D`), upgraded `LM.trendChartSVG` with amber-orange vertical gradient bars, subtle area/curve & peak dots (zeros anchored visibly on baseline, no fabricated data), paired `.duo` (`Streak` + `Level`), real-data `.habits-card` (`Daily rhythm` progress bars for today's tasks), `.trio`, and clean hairline `.mrow` / `.hist` sections.
  - **Profile**: Open centered `.pf-hero` (`.avatar-ring` around untouched `LM.avatarHTML('lg')`), 3-cell `.pf-trio`, 2-column desktop `.pf-grid` with orange-accent icon `.pf-links` + `.hexrow` + `.statgrid` (no Barrett quote — reserved for Stage 4).
  - **Settings**: Back header, direct `RU`/`EN` `.seg-cards` + preserved `[data-k="lang"]` (`T11`), 1-tap `Dark Mode` toggle switch inside `.look-card` + preserved `[data-k="look"]` (`T15`), muted grouped cards, and centered bottom `Reset Progress` action button.
- **Stage 3.3 (Interactive Guides & Exercise Demonstrations)** — what changed:
  - Created `js/practices.js` (`LM.PRACTICES`, `LM.guidePractice`, `LM.PracticeStore` in `'ascend.practice'`, `LM.demoSVG` with 20 articulated vector motion/posture diagrams and CSS keyframe animations that respect Pause and Reduce Motion).
  - Upgraded `.gitem` guide cards with `.gitem-cover` (`assets/cats/<cat>.jpg` + dark scrim + play cue), duration label, step count, and practiced count.
  - Upgraded `V.guide(id)` with practice duration/step count, **"Start practice"** / **"Resume practice"** CTA (`[data-act="practice-start"]`), interactive exercise preview stage (`.gd-demo-card` + `.gd-demo-tabs` `[data-act="gd-demo"]`), structured step timings & cues, and preserved `[data-act="study"]` at `0 XP` without `"XP"` text (`T12`).
  - Added `V.practice(id)` (`#/practice/:id` route, `LM.VERSION = 0.4.3-stage3.3`) featuring central animated SVG demo, stage track, drift-corrected timer loop updating `#pr-time` / `#pr-ring` / `#pr-bar` in-place without flashing SVG animations, Pause/Resume/Restart/Prev/Next controls, automatic resume-state saving (`ascend.practice`), completion summary (`0 XP`), and Settings `Reset Progress` reset integration.
  - Safe evidence-aligned framing across all 28 routines (e.g. `face-tongue` framed strictly as passive nasal breathing & jaw relaxation, no bone-remodeling or TMJ clenching claims).
  - Protected files verified untouched: `data.js`, `game.js`, `store.js`, `backup.js`, `i18n.js`, `i18n/en.js`, `i18n/ru.js`, `ui.js`, `tests/*`, `fonts/*`, `assets/*`, `design-reference/*`.

- **Stage 3.4 (Full Russian Localization & Reference Alignment)** — what changed:
  - Expanded `js/i18n/ru.js` (980+ keys) and `js/i18n/en.js` with full parity covering every screen, toast, modal sheet, error, notification, category, 28 guides (`guide.<id>.*`), 28 practice routines (`practice.<id>.*`), 20 SVG demo badges & box-breathing cue, 18 habits (`task.t-*`), and 16 achievements (`ach.a-*`).
  - Localized `js/views.js`, `js/app.js` (`LM.VERSION = 0.4.4-stage3.4`), `js/ui.js`, `js/practices.js`, and `index.html`; updated blurred photo overlay in `css/styles.css` (`content: attr(data-blur-label)`), localized `document.title`, nav labels, and dynamic date/number formatting.
  - Visual alignment with `ascend-ui-mockup.png`: 4 primary `#nav` tabs (`Главная`/`Home`, `Гайды`/`Guides`, `Прогресс`/`Progress`, `Профиль`/`Profile` with Settings on the top-right gear), single clean checklist + orange CTA inside `.tasks-focal` on Home, 2-line left typography + `studied/total` pill badge on Guides `.catcard`, pill range tabs (`.prog-seg-pills`) and glowing orange area curve + circular data nodes on Progress (`LM.trendChartSVG`), centered `.pf-hero` on Profile, and Settings back header + `RU`/`EN` cards + 1-tap Dark Mode switch + preserved `.sr-only` `About ASCEND` hook for `T15`.
  - Protected files untouched: `data.js`, `game.js`, `store.js`, `backup.js`, `i18n.js`, `tests/*`, `fonts/*`, `assets/*`, `design-reference/*`.

- **Stage 3.5 (Navigation & Guides Visual Correction, `0.4.5-stage3.5`)** and **Stage 3.6 (Full Reference Visual Redesign, `LM.VERSION = 0.4.6-redesign`)** — what changed:
  - Added local offline `Inter Variable` WOFF2 fonts (`inter-{cyrillic,cyrillic-ext,latin,latin-ext}-wght-{normal,italic}.woff2`, `100 900`) as primary `--display` and `--body` typography; old `Barlow` / `Barlow Condensed` / `JetBrains Mono` files kept on disk.
  - Added 8 studio photographs in `assets/guides/` (`dental-smile`, `fragrance-wood`, `nutrition-bowl`, `posture-rings`, `running-track`, `skincare-spf`, `sleep-linen`, `tailor-shirt`) and mapped all 28 guides cleanly via `GUIDE_PHOTO` so zero guides in any category share a photo.
  - **Home**: Structural `.home-hero` / `.home-hero-canvas` dark vignette scaffold prepared for Stage 4 (zero Barrett imagery/quote/placeholders), overlaid with `ASCEND`, date, gear icon, greeting, compact `.level-card`, single `.tasks-focal` checklist + dominant pill CTA, weekly mini-card, GOTD, and horizontal topic pills.
  - **Guides**: Collapsible `#gsearch-wrap` toggled by header search icon `[data-act="toggle-search"]` (`#gq` preserved in DOM), photographic `.catcard` grid on root, and `.gitem.gitem-photo` cards inside categories while keeping Stage 3.3 Simple Design Ltd. interactive demos/practices (`#/guide/:id`, `#/practice/:id`) intact.
  - **Progress**: Full-width 4-segment `.prog-seg` (`7D/30D/90D/1Y` -> `7/30/90/365` days), `LM.trendChartSVG` rewritten with Catmull-Rom smooth Bezier curve + orange gradient area + circular data nodes (flat dotted empty baseline when `0 XP`, strict real user data only), compact paired `.duo` (`Streak` + `Level`), external `Привычки` header above `.habits-card` with open orange category icons + progress bar + circular checkbox.
  - **Profile**: Centered `.avatar-ring.solid-ring`, nickname + edit pencil, `Level · XP` + wide bar, 3 separate rounded `.pf-stat-c` cards (`День серии` / real `Выполнение %` / `Всего XP`), single-line `.lrow` menu, restrained `.pf-quote-slot` empty-ready slot for Stage 4, and hex achievements + 4-card stats below fold (`.pf-fold`).
  - **Settings**: Back header + `RU`/`EN` `.seg-cards` + preserved `[data-k="lang"]` (`T11`), 1-tap `Dark Mode` toggle row, single-line grouped cards (with `.sr-only` `" About ASCEND"` preserved for `T15`), and bottom `Reset Progress` button.
  - Protected files verified untouched: `store.js`, `backup.js`, `game.js`, `data.js`, `i18n.js`, `tests/*`, old font files, and IndexedDB/migration schemas.

- **Stage 3.7 (Post-Audit Visual Alignment of Home & Progress, `LM.VERSION = 0.4.6-redesign`)** — updated after independent visual audit:
  - **Home (`V.home`, `css/styles.css`)**: Integrated existing Barrett portrait (`design-reference/barrett/barrett-01.png`) directly into `.home-hero` with monochrome treatment and smooth `--bg` radial/linear dissolve (Dark & Light, zero surrounding card border on mobile & desktop); adjusted `.level-card` height/proportions (`~77px`); removed ellipsis cutoff on `.home .task .t` so task titles remain readable while keeping compact row rhythm and tight CTA alignment above `#nav`.
  - **Progress (`V.progress`, `LM.trendChartSVG`, `css/styles.css`)**: Reduced `.xpcard` height to `~195–197px` (`33px` main XP figure, `320×96` SVG chart viewBox); aligned `.duo` (`Серия`/`Уровень`) and `Привычки` vertically; added subtle dividers and real period completion progress (`habitPeriodPct(s, t, n)` computed strictly from `s.history` & `s.days` for the selected `7D/30D/90D/1Y` range, `0%` on empty state); kept `.prog-links` cleanly below the initial `390×844` fold (`margin-top: 172px` on `<900px`) with zero bottom-nav clipping while preserving full scroll access to `#/progress/{photos,history,methods}`, photo upload, and achievements.
  - **Bottom Nav (`renderNav` in `app.js`)**: Active `Home` and `Guides` tab icons render solid-filled in accent orange to match the reference active state.
  - Protected files verified untouched: `store.js`, `backup.js`, `game.js`, `data.js`, `i18n.js`, `practices.js`, `tests/*`, `index.html`.
  - Live Chromium verification (`390×844` and `1440×900`, Dark & Light, RU & EN, empty & multi-day active history): zero console/network errors and zero horizontal overflow across all routes.

## Last completed stage
Vercel Preview Preparation (following Stage 4.3 — Barrett Long-Term Memory & Strict Provider Isolation). Locally built and tested across Node suites and local HTTP smoke checks; Preview deployment NOT yet executed, NOT Production-ready.

## Stage 4.1, 4.2, 4.3 & Vercel Preview Preparation — what changed
- `server.js` + `server/barrett.js`: Express API routes (`/api/barrett/health`, `/api/barrett/chat`, `/api/barrett/analyze`, `/api/barrett/guide`) with server-only `GEMINI_API_KEY`, client disconnect `AbortController`, zero photo retention, dual-layer in-memory rate guard (per-IP, per-clientId, concurrency, daily cost cap), `<18` minor safety guardrails (forbidding abrasive scrubs, strong acids, retinoids, extreme lifting/diets), Looksmaxxing community neutrality/respect rules, ASCEND module grounding, anti-hallucination guardrails (no fabricated commercial SKUs such as `Lux Max`), informal Russian `"ты"` tone anchors in both primary & compact fallback instructions, Russian declension matching in `PLAN_TRIGGER_RE`, static `SCHEMA_TYPE` constants + live-only SDK pre-warming, `validatorSpec` enforcement on `/chat`, `/analyze`, and `/guide`, non-secret `timeouts` visibility in `/api/barrett/health` & diagnostics, and `3600`-char chat reply limit.
- `server/ai-provider-router.js`: Persona-independent AI router (primary `@google/genai`, default `gemini-3.5-flash-lite`; opt-in backup Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via REST `result.response`) with hard total request budget, Vercel Hobby `8500 / 4500 / 3500` + `[250, 500]` defaults, bounded retries, JSON Schema 7 `response_format`, and non-PII lifecycle telemetry.
- **Stage 4.3 — Barrett Long-Term Memory & Isolation (`ASCEND/js/chat-store.js`, `ASCEND/js/chat-api.js`, `server/ai-provider-router.js`, `server/barrett.js`)**:
  - `ChatStore` (`ascend.chat.v1`): `memory.barrettSummary` (`<= 600` chars), sanitization, empty/sentinel overwrite guard, legacy compatibility, and `isSharedMemoryEnabled()` / `setSharedMemoryEnabled()` / `getBarrettSummary()` / `setBarrettSummary()` / `clearBarrettSummary()`.
  - `ChatAPI.dispatchBarrett`: Transmits `memorySummary` and `updateSummary: true` only when `sharedEnabled` is enabled; saves `updatedSummary` only from Gemini when `sharedEnabled` remains `true` on completion.
  - **Strict Isolation**: `fallbackResponseSchema` and `fallbackSystemInstruction` completely exclude `memorySummary`, `updateSummary`, and `updatedSummary` from Cloudflare payloads/schemas; `/analyze` and `/guide` never use Barrett memory or Cloudflare.
- **Vercel Preview Preparation — what changed**:
  - **Reproducible `public/` build (`scripts/build-public.js`, `package.json`, `.vercelignore`)**: Archived legacy `public/assets/aistudio/` into `archive/aistudio-assets/` (excluded via `.vercelignore`). `npm run build` runs syntax checks + `node scripts/build-public.js`, rebuilding clean `public/` (`~7.0 MB`: `index.html`, `css/`, `js/`, `fonts/`, `assets/`), excluding `tests/`, `exports/`, `docs/`, `design-reference/`, and `*.md`, and verifying all 51 runtime links.
  - **Barrett portrait & root-relative paths (`ASCEND/assets/avatars/barrett-portrait.png`, `ASCEND/index.html`, `ASCEND/css/styles.css`, `ASCEND/js/views.js`, `ASCEND/js/chat-store.js`)**: Copied `barrett-01.png` -> `ASCEND/assets/avatars/barrett-portrait.png` (original preserved in `design-reference/`). Switched HTML, CSS `@font-face` (`url('/fonts/...')`), avatars, category images, guide images, and Home portrait to root-relative `/...` paths so local Express, Vercel `public/` CDN, and nested SPA fallback URLs all resolve assets reliably.
  - **Single Express entrypoint (`server.js`)**: Kept root `server.js` zero-config Express entrypoint without adding `api/index.js` or `vercel.json`; uses `ASCEND/` locally with fallback to `public/`, and excludes `/api/` from SPA HTML fallback.
  - **Vercel Hobby payload safety (`ASCEND/js/chat-api.js`, `server/barrett.js`, `ASCEND/js/i18n/{ru,en}.js`, `ASCEND/tests/stage-2-multimodal-chat.test.js`)**: Lowered max binary image size from `3,500,000` to `3,000,000` bytes (`3 MB`, keeping Base64 JSON under Vercel Hobby's `4.5 MB` request body cap) and `express.json` limit to `'4.5mb'`, with synchronized RU/EN messages and boundary tests (`3,000,000` accepted / `3,000,001+` rejected with `413 IMAGE_TOO_LARGE`).
  - **Runtime pin (`package.json`)**: Added `"engines": { "node": "22.x" }` (verified on Node `v22.23.5` with `@google/genai` `^3.6.1` and `express` `^5.3.0`).
- **Privacy & Consent (`ASCEND/js/store.js`, `app.js`, `chat-api.js`, `chat-views.js`, `i18n/{en,ru}.js`)**: `settings.privacy.cloudflareFallback` defaults to `false`; enabling requires `LM.confirm` disclosure; images, `/analyze`, and `/guide` never route to Cloudflare; `Chico` and `Duo` chats stay strictly local.
- **Automated Verification Results (Post-Vercel-Preview-Preparation — 96/96 passing)**:
  - `npm run build` (`compile_applet`): **passed** (`[build-public] Built public/ from ASCEND/ (51 runtime references verified, 0 broken, 0 design-reference links)`).
  - `npm run lint` (`lint_applet`): **passed** (`node --check` on server, build script, and client JS modules).
  - `ASCEND/tests/stage-4-3-memory-and-resilience.test.js`: **6 passed, 0 failed**.
  - `ASCEND/tests/stage-4-1-api.test.js`: **18 passed, 0 failed**.
  - `ASCEND/tests/stage-4-2-cloudflare-fallback.test.js`: **19 passed, 0 failed**.
  - `ASCEND/tests/stage-1-barrett-intelligence.test.js`: **9 passed, 0 failed**.
  - `ASCEND/tests/stage-1-chat-integration.test.js`: **13 passed, 0 failed**.
  - `ASCEND/tests/stage-2-chat-management.test.js`: **9 passed, 0 failed**.
  - `ASCEND/tests/stage-2-multimodal-chat.test.js`: **12 passed, 0 failed** (including exact `3,000,000` allowed & `>3,000,000` rejected boundary checks).
  - `benchmark/tests/benchmark.test.js`: **10 passed, 0 failed**.
  - **Local HTTP Smoke Test (`server.js` + `public/`)**: **passed** (`GET /`, SPA fallback `GET /nested/deep/route/here`, `/api/barrett/health`, validation on `/chat`, `/analyze`, `/guide`, `/api/barrett/unknown-route` -> `404`, all 51 static links -> `200` from both `server.js` and `public/`, forbidden files `tests/`/`exports/`/`design-reference/`/`PROJECT_STATUS.md`/`assets/aistudio/` -> `404` in `public/`).
- **Explicitly NOT Executed / Pending**:
  - **Vercel Preview deployment has NOT been executed yet** (and project is **NOT Production-ready**).
  - **Playwright headless Chromium tests were NOT executed** (`playwright` is not installed in this environment; note legacy `ASCEND/tests/stage-chat-stage2.test.js` & `ASCEND/tests/server.js` mount `/new/` subpath and should be checked/updated if used with root-relative `/` paths).
  - **Live HTTP requests with real Gemini/Cloudflare API keys** (`/api/barrett/chat`, `/api/barrett/analyze`, `/api/barrett/guide`) were **NOT executed** after these changes.
  - **ZIP re-export & GitHub push** were **NOT executed**.

## Next step
Run Vercel Preview deployment with live `GEMINI_API_KEY` + Cloudflare env vars, verify CDN static delivery (`public/`) vs Express `/api/barrett/*` routing on a live Preview URL (and confirm whether zero-config `server.js` needs a minimal `vercel.json` only if Preview routing shows a conflict), execute live `/analyze` + `/guide` + Playwright Chromium smoke checks, and then rebuild the export ZIP before any Production release.

## How to run
`npm run dev` (starts `server.js` on port `3000`, serving `ASCEND/` and `/api/barrett/*`).
Data lives in the browser profile of the active origin (`ascend.state`, `ascend.chat.v1`, IndexedDB `ascend-photos`). Use Settings > Data > Export backup before moving between origins/devices.

## Rules for the next developer/Claude
- Keep the visual language: Obsidian/Graphite dark & Warm Mineral light, orange accents (`#ff6b1a` dark / `#c2410c` light), Inter Variable / Barlow / JetBrains Mono, hex achievement badges.
- Content changes go in `js/data.js`; rules in `js/game.js`; don't scatter XP numbers.
- Keep state shape backward compatible (`LM.Store` merges new defaults into old saves; bump `VERSION` for migrations).
- Update this file after each stage.

