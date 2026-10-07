# CLEAR — session handoff (2026-10-06)

Read this first if you are picking the project up in a new session. `PRODUCT_SPEC.md` (progress section at the top) stays the source of truth for product status; this file explains what the last session did, why, how to work in a cloud container, and what is left. Screenshots of the current UI are in [`docs/handoff/screenshots/`](docs/handoff/screenshots/).

## Where things stand

| | |
| --- | --- |
| Branch | `main` (the repo rule in `AGENTS.md`: commit to `main` and push; the session branch `claude/exciting-fermi-ghq5io` mirrors it) |
| Last code commit | `1f799f3` (follow-up typing fix). Later commits are docs only. |
| CI | GitHub Actions run 10 on `1f799f3` is **green end to end**: lint, unit tests, offline evals, production build, all 40 Playwright scenarios (Chromium, Firefox, WebKit, mobile Chromium) and the password-form suite. Before this session CI had been red at the unit-test step for several pushes. |
| Deployed | **Production is live** at https://clear-explainer.vercel.app since 2026-10-07. Git deployments are on: a push to `main` deploys to production. Health check ready; a real lesson and a follow-up were generated there through the API. Signed-in flows on production are not yet verified. |
| Local checks | 355 unit tests in 37 files, lint, `tsc --noEmit`, `next build`, and the 20 Chromium + mobile-Chromium browser scenarios pass in the cloud container. |

## What this session did (newest first)

| Commit | Change |
| --- | --- |
| `ce7878c` | Spec note: first fully green CI run. |
| `1f799f3` | **WebKit bug:** text typed into the follow-up box before the lesson page hydrated left **Send** disabled. Fixed in `components/lesson/LessonWorkspace.tsx` (see Gotchas). Mermaid colours aligned with the new tokens. |
| `ce514c5` | **CI unblocked:** CI exports `NEXT_PUBLIC_APP_URL` and `CLEAR_PROVIDER=mock` for its browser steps; unit tests inherited them (403 origin rejections, a mock answer where a provider failure was expected). `tests/setup.ts` now clears deployment settings before each test file. |
| `6eae4e5` | Phone fixes for the new design (hero texture overflowed by 16 px, preview clipping, scroll fade on the lesson tab row), normalised checkboxes, regenerated Open Graph / Twitter card from `components/brand/og-card.tsx`. |
| `a4f0a7e` | **Professional redesign** (the owner said the first redesign looked "vibe coded"). Details below. |
| `54eeaf8` | **Eval launch gate** decided and implemented (the owner delegated the call). Details below. |
| `cf028c3` | First polish pass on the earlier redesign: themed selects/checkboxes/radios, theme radio group, restyled quiz/widgets/verify/concepts, Mermaid theming, progress empty state, **Buy Me a Chai** support link. |
| `01eded1` | (previous session) First redesign and the dedicated landing page at `/`, ask page at `/ask`. |

### The professional design system

Direction: spec section 29 — calm, technical, typography-first, subtle borders, minimal gradients. See the before/after screenshots below.

- **Tokens** live in `app/globals.css` (`:root` light, `.dark` dark): neutral greys with one indigo `--primary`; `--success`, `--warning`, `--destructive` carry meaning. Colour is never decoration. `--radius` is 0.5 rem.
- **Type:** Geist for everything (`--font-heading` is Geist; Bricolage Grotesque and Instrument Serif were removed from `app/layout.tsx`). Headings are `font-semibold tracking-tight`; page titles `text-3xl sm:text-4xl`.
- **Shared classes** (in `@layer components`): `.surface-panel` (card), `.field-control` (inputs; selects draw their own chevron), `.button-primary`, `.button-secondary`, `.eyebrow` (small primary label, sentence case), `.badge`, `.chai-button`, `.focus-card` (focus ring around a card such as the composer), `.loading-beam`, `.dot-grid`. Checkboxes and radios are styled globally in `@layer base` (native controls return under forced colours).
- **Legacy aliases:** `.tone-text`, `.tone-bg`, `.tone-border`, `.tone-dot` now all map to the primary colour. The per-view `hue-*` classes and rainbow colours are gone.
- **Landing page motion (owner request, 2026-10-07):** the landing page is animated; every other screen stays still. Motion classes live in the "Landing page motion" block of `app/globals.css` (`.rise`, `.pop`, `.draw`, `.mask-line`, `.marker`, `.reveal`, `.sheet`, `.glow-lines`, `.dot-spot`). Client pieces are in `components/landing`: `hero-prompt.tsx`, `product-preview.tsx`, `document-views.tsx`, `level-demo.tsx`, `pointer-glow.tsx` and the `motion.ts` hooks. Rules: keep the neutral palette and one indigo accent, animate only `transform`, `opacity` and SVG strokes, make the finished state the default so reduced motion and no-script visitors see a complete page, and never dim text with opacity (the accessibility scan checks contrast inside decorative previews too).
- **Launch video (2026-10-07):** `docs/launch/` holds the README preview GIF and the 720p video. They are exports; the editable sources live only in the git-ignored `.data/launch/` folder on the owner's machine (`capture.mjs` takes production screenshots, `video.html` is the edit, `render.mjs` renders it through Playwright into ffmpeg, `music.py` synthesises the track). To change the video, edit those, re-render, then re-export both files in `docs/launch/`. In the hero preview diagram, keep the moving dot before the boxes in the SVG so it passes behind them.
- **CLEAR Free has five Gemini models (2026-10-07).** The list and its order are in `src/lib/ai/models.ts`; `clearFreeProvider` in `src/lib/ai/router.ts` walks it on 503, 429 or a 60-second timeout and stops starting attempts after 70 seconds. To see what a key can use, list `v1beta/models` and send each text model one tiny JSON request; on the free tier expect the Flash models to answer 503 much of the time. Only Flash-Lite 3.5 has passed the full eval.
- **Removed on purpose:** gradient/italic accent headings, aurora blobs, grid backgrounds, spectrum lines, glows, count-up animation, the question marquee and the stats strip. Do not bring these back without the owner asking. (A quiet scroll rise returned with the 2026-10-07 landing page.)
- **Landing page:** `app/page.tsx` (hero) + `components/landing/sections.tsx` (steps, ten-view grid, providers/privacy, portable skill, FAQ, closing CTA) + `components/landing/product-preview.tsx` (quiet preview that steps through six views; static under reduced motion; `aria-hidden` with a text description beside it).
- **Lesson layout:** `components/lesson/LessonTabs.tsx` is shared by the private lesson (`LessonWorkspace.tsx`) and the shared snapshot (`ReadOnlyLesson.tsx`). On `lg` and up the ten views are a vertical list in the left sidebar with learning goals under it; on phones they are an underlined, horizontally scrolling tab row. Either pair of arrow keys moves between tabs. Tab labels keep Title Case (`Mental Model`, `Deep Dive`, `Voice Tutor`) because the browser tests address them by name.
- **Mermaid:** `components/diagrams/MermaidDiagram.tsx` uses the `base` theme with hex `themeVariables` that mirror the tokens (Mermaid cannot read CSS variables). Keep them in sync if the palette changes.
- **Header theme switch:** `components/theme-toggle.tsx` is a three-option radio group (System, Light, Dark). The accessibility test selects it by role `radiogroup` named "Color theme".

### Eval launch gate (decided this session)

`evals/score.ts` exports `LAUNCH_GATE`, `meetsLaunchCase` and `launchGate`; `evals/suite.test.ts` asserts them for live runs.

- Every case: no critical failure (prohibited claim, fabricated verification, unsafe widget or Mermaid, and now also **a wrong known-answer quiz key**), and perfect `schemaValidity` and `internalConsistency`, and a case score of at least **0.70**.
- Whole corpus: every case passes and the mean score is at least **0.85**.
- Why: the old bar required 1.0 on every dimension, but coverage checks are lexical and fail correct lessons that word things differently. Exact checks stay strict; lexical ones are averaged. The strict all-1.0 count is still reported.
- Status: **passed on 2026-10-07** (`gemini-3.5-flash-lite`, prompt v4, repair v3, rubric v2: 12/12, mean 0.891, lowest 0.79, no critical failures). The report is in `.data/evals/latest-live.json` on the owner's machine. Rerun it after any prompt, schema or model change.

### Support link (owner-requested exception to the "support comes last" rule)

`components/support/chai-button.tsx` links to `https://buymeachai.ezee.li/Devraj` in a new tab from the footer, the landing FAQ and the About page; the privacy page mentions it. It is a plain outbound link styled like CLEAR's secondary buttons. The official button image was **not** used: this container could not reach that host, and hotlinking would need a CSP change and send every visitor's IP to the site. `AGENTS.md` records the exception. Billing, Stripe and in-app payment collection are still not built.

## What is left (and who does it)

| Step | Who | Notes |
| --- | --- | --- |
| Set Vercel production (and preview) variables | Owner | `NEXT_PUBLIC_APP_URL` (final https origin), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the existing `APP_ENCRYPTION_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `CLEAR_TRUSTED_IP_HEADER=x-vercel-forwarded-for`. Leave `CLEAR_PROVIDER` and Sentry blank. Full list: `DEPLOYMENT.md`. |
| Supabase Site URL | Owner | Authentication → URL Configuration → the same https origin. |
| Turn on deployments | Done 2026-10-07 | `git.deploymentEnabled` is true. Every push to `main` now reaches users, so check CI and the site after each push. |
| Two-account smoke test | Done 2026-10-07 | `npm run test:live` passes on production: all guest checks (run by the agent) and the two-account check (run by the owner). Rate limiting was also confirmed there. |
| Live eval on the launch model | Done 2026-10-07 | Passed the launch gate; see above. Command below for reruns. |
| Raise the Gemini quota | Owner | The live key returns HTTP 429 after about a dozen lesson requests in a minute. Enable billing or request a higher limit before sharing the site widely. |
| Real microphone test | Owner | Phone and laptop. |
| BYOK providers | Owner | Test each with a real key, or say in the launch notes which are untested. |
| Demo video | Agent, after deploy or with a key | Offered: script and record a 60–90 s 1080p walkthrough (ask → lesson views → quiz → teach-back → share) with Playwright `recordVideo` on real lessons. |

Not built and not launch blockers: quiz results do not write learning memory, lessons do not stream while generating, no provider-native realtime voice. Deferred by the owner: custom SMTP (no email verification or password reset) and Sentry.

## Working in a cloud container

### Environment facts

- Chromium only: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (also `/opt/pw-browsers/chromium`). Firefox and WebKit run in GitHub Actions.
- Network: `api.vercel.com` and `buymeachai.ezee.li` are blocked; `generativelanguage.googleapis.com` is reachable. No Vercel CLI or token is present.
- `cn` in `package.json` is shadcn's official class-merging package, not a typo.

### Run the app locally (mock provider, no keys)

```bash
npm ci
CLEAR_PROVIDER=mock CLEAR_DATA_DIR=/tmp/clear-data \
APP_ENCRYPTION_KEY="BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=" \
NEXT_PUBLIC_APP_URL=http://localhost:3000 npx next dev -p 3000
```

"See an example" on `/ask` opens the built-in mutex lesson without calling a model. Without `GEMINI_API_KEY`, Settings says CLEAR Free is not available; that is expected locally. The round "N" in dev screenshots is Next's dev indicator.

### Checks

```bash
npx eslint && npx tsc --noEmit -p . && npx vitest run      # lint, types, 355 unit tests
npx vitest run --config evals/vitest.config.ts              # offline prompt/rubric checks
```

Browser tests need an isolated mock **production** build whose origin is `https://localhost:3100`:

```bash
CLEAR_PROVIDER=mock NEXT_PUBLIC_APP_URL=https://localhost:3100 NEXT_PUBLIC_SUPABASE_URL= \
NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SENTRY_DSN= SENTRY_DSN= npx next build
```

Then run only the Chromium projects with a throwaway config (do not commit it):

```ts
// playwright.local.config.ts (repo root)
import base from "./playwright.config";
import { defineConfig } from "@playwright/test";
const executablePath = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
export default defineConfig({
  ...base,
  projects: (base.projects ?? []).filter((p) => p.name === "chromium" || p.name === "mobile-chromium")
    .map((p) => ({ ...p, use: { ...p.use, launchOptions: { executablePath } } })),
});
```

```bash
npx playwright test --config playwright.local.config.ts
```

For the password-form suite put the same kind of wrapper **inside `tests/e2e/`** (its reporter path is relative to the config file), importing `./auth-ui.config`, and run `npx playwright test --config tests/e2e/auth-ui.local.config.ts`.

Live eval (billable; needs a key in the environment):

```bash
CLEAR_EVAL_LIVE=1 CLEAR_EVAL_ACK_COST=1 CLEAR_EVAL_PROVIDER=gemini CLEAR_EVAL_MODEL=gemini-3.5-flash-lite \
CLEAR_EVAL_API_KEY="$GEMINI_API_KEY" npm run test:eval:live
```

The report lands in `.data/evals/latest-live.json` with the `launchGate` result.

## Gotchas learned this session

- **Run `npm run test:live -- guest` after a deploy** (see `tests/live/README.md`). It found two production-only bugs on its first run. Reads must never call `ensureLearnerId()`: two concurrent first requests that each mint an identity race, and the browser can keep the one that does not own its lesson. Copy a `FileList` before clearing its input; Chrome and Safari empty the same object. A lesson's `updatedAt` from Supabase is the raw Postgres text (offset and microseconds) because it is the revision token; never validate it with a `Z`-only date check.

0. **Flash-Lite returns broken JSON in about one response in four**, even with a JSON response type. `src/lib/explanation/validate.ts` hands unparseable text to the repair pass; do not parse it to `{}` first. Lessons that needed a repair take roughly twice as long.

1. **Do not initialise React state from the DOM during the first render if any rendered attribute depends on it.** The follow-up box read its typed text in `useState(() => …)`, so the client rendered `Send` enabled while the server HTML had it disabled; React does not repair attribute mismatches after hydration, so the button stayed disabled. The fix hydrates with the server's empty draft and picks up early text in a mount effect (`LessonWorkspace.tsx`). `AskComposer.tsx` still initialises from the DOM, which is safe only because nothing but the textarea's own value depends on the question.
2. **Unit tests must not inherit deployment settings.** `tests/setup.ts` deletes them; tests use `vi.stubEnv` for what they need.
3. **A production build is pinned to its `NEXT_PUBLIC_APP_URL`.** The e2e build accepts requests only from `https://localhost:3100`, so use `next dev` on port 3000 for manual screenshots.
4. **`pkill -f "next dev"` inside a Bash call kills that shell** (the pattern matches its own command line). Find PIDs with `ps -eo pid,args` and kill them in a separate call.
5. **Full-page Playwright screenshots with the sticky header** can show the header mid-page after scrolling; use viewport screenshots for review.
6. **Keep helper scripts out of commits.** Delete throwaway `.mjs` and `*.local.config.ts` files before `git add -A`.

## Screenshots

All taken on 2026-10-06 against the mock dev server (desktop 1440×900, phone 390×844). Files are in `docs/handoff/screenshots/`.

### Before (first redesign, commit `01eded1`) — what "vibe coded" meant

| Landing | Lesson |
| --- | --- |
| ![First redesign landing](docs/handoff/screenshots/00-before-landing-first-redesign.png) | ![First redesign lesson](docs/handoff/screenshots/00-before-lesson-first-redesign.png) |

### After (current)

| Screen | Image |
| --- | --- |
| Landing, light, full page | ![](docs/handoff/screenshots/01-landing-desktop-light-full.png) |
| Landing, dark | ![](docs/handoff/screenshots/02-landing-desktop-dark.png) |
| Ask, light | ![](docs/handoff/screenshots/03-ask-desktop-light.png) |
| Ask, dark | ![](docs/handoff/screenshots/04-ask-desktop-dark.png) |
| Lesson · Understand (sidebar views) | ![](docs/handoff/screenshots/05-lesson-understand-desktop-light.png) |
| Lesson · Mental model | ![](docs/handoff/screenshots/06-lesson-mental-model-desktop-light.png) |
| Lesson · Visual (Mermaid), dark | ![](docs/handoff/screenshots/07-lesson-visual-desktop-dark.png) |
| Lesson · Interactive | ![](docs/handoff/screenshots/08-lesson-interactive-desktop-light.png) |
| Lesson · Verify | ![](docs/handoff/screenshots/09-lesson-verify-desktop-light.png) |
| Lesson · Quiz result | ![](docs/handoff/screenshots/10-lesson-quiz-result-light.png) |
| Share & export panel | ![](docs/handoff/screenshots/11-share-export-desktop-light.png) |
| Shared read-only lesson | ![](docs/handoff/screenshots/12-shared-lesson-desktop-light.png) |
| Settings, full page | ![](docs/handoff/screenshots/13-settings-desktop-light-full.png) |
| Portable skill | ![](docs/handoff/screenshots/14-skill-desktop-light.png) |
| Progress (memory off), dark | ![](docs/handoff/screenshots/15-progress-desktop-dark.png) |
| Library (guest), dark | ![](docs/handoff/screenshots/16-library-desktop-dark.png) |
| About with support card | ![](docs/handoff/screenshots/17-about-desktop-light.png) |
| Landing, phone | ![](docs/handoff/screenshots/18-landing-phone-light.png) |
| Lesson, phone (scrolling tab row) | ![](docs/handoff/screenshots/19-lesson-phone-light.png) |
| Menu, phone, dark | ![](docs/handoff/screenshots/20-menu-phone-dark.png) |
| Ask, phone, dark | ![](docs/handoff/screenshots/21-ask-phone-dark.png) |
| Open Graph / Twitter card | ![](docs/handoff/screenshots/22-share-card-og.png) |
| Animated landing hero, light (production, 2026-10-07) | ![](docs/handoff/screenshots/23-landing-hero-light.png) |
| Animated landing hero, dark | ![](docs/handoff/screenshots/23-landing-hero-dark.png) |
| Landing: ten views beside one document | ![](docs/handoff/screenshots/24-landing-views-explorer.png) |
| Landing: learner level and one-question check | ![](docs/handoff/screenshots/25-landing-level-and-quiz.png) |
| Animated landing, phone, dark | ![](docs/handoff/screenshots/26-landing-phone-dark.png) |
