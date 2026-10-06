# CLEAR

Product status and the full specification are in `PRODUCT_SPEC.md`. Commit to `main` directly.

AI knows the answer. CLEAR helps you understand it.

CLEAR turns a question into one explanation document, then renders that document as an understandable lesson: a short account, a mental model, examples, and a follow-up that updates the same lesson.

## Run locally

```bash
npm install
copy .env.example .env.local
```

Add `GEMINI_API_KEY` to `.env.local`. CLEAR Free uses `gemini-3.5-flash-lite` and switches to `gemini-3.6-flash` when Gemini reports the first one busy. Then:

```bash
npm run dev
```

Open http://localhost:3000 for the landing page, or http://localhost:3000/ask to start a lesson. Ask a question, or choose **See an example** to open the mutex lesson without calling a model.

Set `CLEAR_PROVIDER=mock` if you want generated lessons without Gemini. The lesson is labeled as a local mock.

## Voice

Choose **Use your voice**, then **Speak a question** to dictate into the ask box. In a lesson, open **Voice Tutor** to listen to the lesson or speak a follow-up. **Teach it back** also accepts dictated text and can read the feedback aloud. Review the words before submitting them.

Speech input needs HTTPS or localhost and a browser with [speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Some browsers use a remote recognition service. Narration uses the browser's speech service. CLEAR stores submitted text, not raw audio. Unsupported browsers retain typed input and readable transcripts. Provider-native realtime audio is not connected yet; lesson turns continue through the selected explanation provider.

For a local voice check, open the sample lesson, listen and pause/resume/stop, switch narration sections, dictate a follow-up, review/edit it, and send. Check denied microphone permission and text fallback too. With the mock provider, the reply is a development fixture rather than model tutoring.

## Portable skill

Open **Skill** to choose learner level, depth, analogies, visuals, interview practice, recall checks, and writing style. The live preview shows all seven files. **Download CLEAR skill** creates a ZIP with your preferences; **Copy SKILL.md** copies the main instructions.

Unzip it and keep the `clear-explainer` folder together, then add it to the skill location supported by your agent. The package contains public teaching instructions and examples. It excludes conversations, uploads, learning memory, and provider keys. Exporting needs no account or API key; the host agent supplies its own model and tools.

## Sharing and lesson downloads

Guest lessons belong to the browser that created them. Return to their address in the same browser; clearing its site data removes access. With Supabase email sign-in configured, new signed-in lessons belong to your account and appear in **Library** across devices. Earlier guest lessons, connections and settings are not imported automatically. Earlier ownerless URLs remain read-only and offer **Make a private copy** to continue with the explanation alone. The copy starts future turns with CLEAR Free.

Open **Share & export** in a lesson. Review **Preview the shared explanation**, then explicitly create a share link. It publishes a frozen snapshot with eight read-only learning views, quizzes, and trusted interactive controls. Later follow-ups leave the snapshot unchanged. **Replace link with current lesson** invalidates the previous link; **Revoke link** removes access. Files already downloaded remain with their recipients.

Markdown, JSON, and PDF downloads contain canonical teaching content and quiz answers. Original uploads, conversation history, learning records, ownership identifiers, and provider keys are excluded. The explanation itself can contain material from your question or files. Provider/model names stay hidden unless the creator includes them. Public downloads follow that creator choice.

PDFs paginate text, examples, code, and diagram/interactive descriptions using an embedded DejaVu font. Common math symbols are supported; unsupported glyphs (including many Hindi/Chinese characters) use explicit Unicode notation with a notice. Markdown and JSON preserve their original text. PDF exports are limited to 500 pages.

For Supabase deployments, apply every migration in filename order **before deploying this version**. The current live project has received the Phase 11 SQL bundle and passed read-only schema/function/private-bucket checks. Hosted records, encrypted keys, usage budgets and original uploads persist in Supabase; the upload bucket stays private. Vercel refuses a local-storage fallback. Local development uses `.data` or `CLEAR_DATA_DIR` without Supabase. Configured public origins are checked on writes, and deployment proxies must overwrite forwarding headers. See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel/Supabase setup and remaining launch checks.

## Account library

**Account** offers email/password sign-in and account creation. After signing in, **Library** shows the latest 100 account lessons with title search, provider filters, favorites, rename, archive/restore and deletion. Deleting a lesson also removes its uploads and invalidates its share link. Provider keys, routing and opt-in learning memory use a separate private account scope. Sign-out returns to the guest browser identity. Custom mail and Sentry are deferred; Supabase's **Confirm Email** setting must be off for immediate signup without email. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Production controls

API requests have bounded bodies and rolling rate limits. Actual CLEAR Free model calls spend guest/account, network and global daily budgets; repairs and explicitly enabled fallback each spend a dispatch. BYOK uses admission/concurrency controls but does not spend CLEAR Free quota. Operational pauses and limits are configurable in `.env.example`. A missing quota store stops dispatch rather than bypassing limits.

Model responses are bounded, redirects are rejected, and raw provider error bodies are never returned. Lesson saves are transactional with stale revision detection. Every dynamic page receives a nonce-based content security policy. Optional Sentry error reporting strips private content and disables automatic telemetry. Database isolation and provider contracts have executable tests.

## Checks

```bash
npm test
npm run lint
npm run test:eval
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run check:deployment -- --remote
```

Browser regression tests use an isolated mock production build and temporary synthetic storage. CI builds with no provider or Supabase secrets and runs Chromium, Firefox, WebKit and mobile Chromium. Offline evals check the reference corpus and rubric; they do not establish live model quality. Billable live evals require explicit process flags and credentials; see the deployment guide. Deployed password sign-in and storage checks, microphone devices and an agreed live eval threshold remain launch gates; `PRODUCT_SPEC.md` lists them in order. Custom mail and monitoring are deferred.

## Where things live

- `app/page.tsx` and `components/landing` — the landing page; `app/ask` — the ask workspace
- `app/globals.css` — design tokens, view hues and motion; `components/ui` — shadcn/ui components (add more with `npx shadcn@latest add <name>`)
- `src/lib/explanation/schema.ts` — the canonical explanation document
- `src/lib/ai` — provider contract, Gemini adapter, local mock
- `src/lib/explanation` — validation, repair, generation, follow-up
- `supabase/migrations` — Postgres schema and row-level security
- `src/lib/auth` — verified email sessions and the account library
- `src/lib/security/limits` — durable atomic quotas, body limits and concurrency
- `src/lib/monitoring` — privacy-filtered error reporting
- `evals` and `tests/e2e` — prompt regression and browser/accessibility coverage
- Private records use Supabase when configured; `.data/` is a local-development store

Provider requests run on the server. Do not put API keys in `NEXT_PUBLIC_` variables.
