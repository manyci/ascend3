# LOOKSMAX → ASCEND — PROJECT STATUS

> **Current stage: 3.7 (Post-Audit Visual Alignment of Home & Progress, `LM.VERSION = 0.4.6-redesign`) complete. Barrett (4), AI (8-10), PWA (11) are NOT started.**
> Stage 3.7 follows the comparative audit against `design-reference/ascend-ui-mockup.png` across mobile (`390×844`) and desktop (`1440×900`): restructures `Home` (open enlarged hero without Barrett, header without date, Level card without streak chip, `36px` single-line ellipsis tasks, desktop `780px` symmetry), moves secondary `Home` widgets into `#/tasks`, refines `Progress` to strictly 4 primary blocks (`7D/30D/90D/1Y` pills, clean smooth bezier chart without X-axis date labels and strictly real user data, `Серия`/`Уровень`, `Привычки` with `6px` bars) plus `#/progress/{photos,history,methods}` sub-routes, and keeps storage/XP/achievements/IndexedDB/backups completely untouched.

> Read this file first when continuing the project in a new session or account.
> Do NOT rewrite the app from scratch and do NOT change the approved visual design.

## Project
Gamified self-improvement web app (looks, skin, hair, body, style, grooming, health) inspired by Duolingo.
Premium minimalist dark graphite & orange UI (plus WCAG-checked warm mineral light theme). v1 is personal-use, no backend, no account.

## Tech
Plain HTML + CSS + JavaScript. No build step, no dependencies. Fonts bundled in `fonts/` (OFL).
Data: `localStorage` (progress, settings, avatar) + `IndexedDB` (photos).

## File structure
```
index.html            shell, loads scripts in order
css/styles.css        all styling, design tokens in :root (dark + light theme)
fonts/                Inter Variable (Cyrillic + Latin WOFF2), Barlow, Barlow Condensed, JetBrains Mono + licenses
assets/cats/          7 dark studio category photographs
assets/guides/        8 dark studio guide photographs (15 distinct photos mapped across 28 guides)
js/i18n.js            i18n core: LM.t / LM.tn / LM.I18n (language saved in state.settings.language, default ru)
js/i18n/ru.js, en.js  complete RU & EN dictionaries: all UI chrome, 7 categories, 28 guides, 28 interactive practices, 20 demos, 18 tasks, 16 achievements, sheets, toasts, errors
js/backup.js          export/import: validation, atomic apply with rollback (LM.Backup)
js/data.js            CONTENT ONLY: categories, 28 guides, 18 habit tasks, XP table, 16 achievements
js/practices.js       Stage 3.3 interactive routines for all 28 guides, 20 articulated SVG motion demos, PracticeStore (`ascend.practice`)
js/store.js           persistence: LM.Store (localStorage), LM.Photos (IndexedDB), image resize helper
js/game.js            rules: XP, levels, streak, daily tasks (seeded by date), achievements, stats
js/ui.js              helpers: SVG icons, escaping, toasts, level-up overlay, sheets, confirm dialog
js/views.js           screens as HTML strings: home, guides, guide detail, interactive practice, progress, profile, settings
js/app.js             hash router, practice timer loop, click delegation, settings sheets, photo flow, reminders, boot
PROJECT_STATUS.md     this file
```
Script order matters: data -> practices -> i18n/en,ru -> i18n -> store -> backup -> game -> ui -> views -> app. Everything hangs off `window.LM`.

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
- Default avatar is an initial on a circle badge; Barrett integration (Stage 4) and future character evolution remain unstarted.

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
Stage 2 — Chat UX & Management (message edit + AI reply truncation/regeneration, delete message/dialog with confirmation, rename, archive/restore, copy, duplicate-safe regenerate, global & in-thread search with match stepping, pin/unpin & pinned list sheet, 3-dot context menus, RU/EN localization, `ascend.chat.v1` persistence). Before: Stage 1 Chat Integration Foundation, Stage 4.1 Barrett Backend, Stage 3.7 (`LM.VERSION = 0.4.6-redesign`).

## Stage 2 (Chat UX & Management) — what changed
- Extended `ASCEND/js/chat-store.js` (`ascend.chat.v1`) with `customTitle`, `archived`, `editedAt`, `getThreadTitle`, `editUserMessage` (with `truncateAfter` & pin pruning), `truncateAfter`, `isPinned`, `togglePin` (max 25), `getPinnedMessages`, `renameThread`, `archiveThread`, `deleteThread`, and `searchMessages`, while excluding archived threads from global `totalUnread()`.
- Extended `ASCEND/js/chat-api.js` (`LM.ChatAPI`) with `editAndResendBarrett(userMsgId, newText)` and `regenerateBarrett(assistantMsgId)` reusing `dispatchBarrett`, Stage 1 `inFlight` duplicate-click locking, `AbortController` timeout, and retryable error recovery.
- Extended `ASCEND/js/ui.js` (`dots`, `pin`, `copy`, `archive`, `restore` icons), `ASCEND/js/chat-views.js`, `ASCEND/js/app.js`, `ASCEND/css/styles.css`, and `ASCEND/js/i18n/{en,ru}.js` with 3-dot message & dialog context sheets, edit modal, rename modal, archive collapsible section + 1-tap restore, clipboard copy + fallback, pinned banner + pinned messages sheet (jump & unpin), and live global & in-thread search with XSS-safe `<mark class="chat-hl">` highlighting and focus preservation.
- Added `ASCEND/tests/stage-2-chat-management.test.js`.

## Next step
Proceed to Stage 3 — Shared Memory System & Onboarding Flows (after user review/approval).

## How to run
`npm run dev` (starts `server.js` on port `3000`, serving `ASCEND/` and `/api/barrett/*`).
Data lives in the browser profile of the active origin (`ascend.state`, `ascend.chat.v1`, IndexedDB `ascend-photos`). Use Settings > Data > Export backup before moving between origins/devices.

## Rules for the next developer/Claude
- Keep the visual language: Obsidian/Graphite dark & Warm Mineral light, orange accents (`#ff6b1a` dark / `#c2410c` light), Inter Variable / Barlow / JetBrains Mono, hex achievement badges.
- Content changes go in `js/data.js`; rules in `js/game.js`; don't scatter XP numbers.
- Keep state shape backward compatible (`LM.Store` merges new defaults into old saves; bump `VERSION` for migrations).
- Update this file after each stage.

