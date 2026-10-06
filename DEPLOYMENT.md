# Deploy CLEAR to Vercel and Supabase

The new Vercel project is `devrajsinhjhalas-projects/clear`, connected to `Devrajsinh-Jhala/clear`. No deployment has been published. Git deployments are disabled in `vercel.json` until the production checks below pass.

## Database and private storage

The current CLEAR project already has the initial and sharing schema. The user successfully ran `supabase/setup-phase11.sql` on 2026-10-05; the read-only remote checker verified every expected table, server function and the private upload bucket. Do not run it again on this project.

For another existing project at the same previous schema, copy the file's entire contents into a new Supabase SQL Editor query and run it once. It bundles the five updates in one transaction and requires no access token. It preserves existing lessons and creates the private state, quota, account and upload infrastructure. Do not run it against a fresh project or one where these updates have already been applied. The source migrations are:

1. `20261005090000_durable_state_and_uploads.sql` — private credentials, learning, routing and comparison records; private upload bucket.
2. `20261005100000_usage_limits.sql` — atomic request budgets and provider concurrency leases.
3. `20261005110000_atomic_lesson_save.sql` — transactional lesson writes, revision conflict protection and immutable ownership.
4. `20261005120000_account_library.sql` — account library permissions and restricted browser writes.
5. `20261005130000_account_lesson_cleanup.sql` — atomic account deletion and durable media-cleanup jobs.

These migrations were tested together in PostgreSQL via PGlite and are now applied to the current live Supabase project. Browser roles cannot read credential, sharing or quota tables, or call privileged write functions. The app server uses the service key after verifying lesson ownership; the library uses a verified account session and row-level security. Manual SQL application does not update Supabase CLI migration history; reconcile that history before using `supabase db push` later.

The `clear-uploads` bucket must remain private. Original files have no public route or signed download URL. Vercel never falls back to local files. Local development uses `.data` or `CLEAR_DATA_DIR`; changing to Supabase does not import existing local records. Preserve the original encryption key when moving any encrypted credentials.

## Simple email/password sign-in

CLEAR now uses email and password for **Sign in** and **Create account**. Custom SMTP and Sentry are deferred at the user's request. For account creation without any confirmation email, open the Supabase Email auth provider settings and turn **Confirm Email** off. This is a dashboard setting, not part of the SQL file. It permits immediate sessions without verifying ownership of the email address. See [password authentication](https://supabase.com/docs/guides/auth/passwords).

The user switched confirmation off on 2026-10-05. Read-only Auth settings confirmed email sign-in and signup are enabled and `mailer_autoconfirm` is true. A bounded SDK smoke passed 18 checks for immediate signup, verified own claims, password sign-in, incorrect-password rejection and local sign-out with two synthetic accounts; both were deleted afterward. Application cookies and saved-library flows still need deployment verification.

If confirmation remains enabled, CLEAR reports that email confirmation is required and does not fabricate a signed-in session. Supabase's built-in mail restricts recipients; configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) when restoring email verification or adding password recovery. Password reset is not included in this simplified slice. Existing email-code endpoints remain for compatibility, while the account UI uses passwords.

Set the Supabase site URL to the final HTTPS application URL. Test account creation, incorrect passwords, sign-out, a second device and two different users. Sign-in creates an account library for new lessons. Earlier guest lessons, connections, memory and routing are not moved automatically. The library displays the latest 100 lessons.

## Vercel configuration

Use `.env.example` as the variable inventory. Set production variables in the project dashboard or CLI; never commit an environment file or paste secrets into an issue or chat.

`.vercelignore` excludes local data, environment files, Git/deployment metadata, fixtures and reports from source uploads. A CLI dry run must contain none of those paths before deployment; runtime skill Markdown and PDF fonts must remain included. Runtime tracing exclusions are an additional boundary, not a substitute for source-upload exclusions.

Required production values:

- `NEXT_PUBLIC_APP_URL`: the verified final HTTPS origin.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key).
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`): server only.
- `APP_ENCRYPTION_KEY`: a persistent, base64-encoded 32-byte key. Rotating it requires a credential migration and changes account learning identifiers.
- `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash-lite`. Leave `CLEAR_PROVIDER` blank. The other CLEAR Free model is `gemini-3.6-flash`. When the chosen one answers HTTP 503, CLEAR asks the other and labels the lesson with the model that answered; each attempt spends a dispatch. Google retired `gemini-2.5-flash` for this key and `gemini-3.5-flash` returned 503 for two days. If both current models start failing, list the key's models and update `src/lib/ai/models.ts`.
- `CLEAR_TRUSTED_IP_HEADER=x-vercel-forwarded-for`. Only use a header overwritten by the deployment edge. Unconfigured or malformed network headers share an unknown-network budget.
- Optional `CLEAR_ALLOWED_ORIGINS`: comma-separated extra origins that may send requests, such as `https://www.example.com`. `NEXT_PUBLIC_APP_URL` and the Vercel deployment, branch and production addresses are always accepted. A request from any other address gets HTTP 403.

Optional for later: `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`. Leave both blank for now; monitoring is not required by the configuration checker or `/api/health`. Client DSNs are public identifiers; provider and service keys are not.

Never set user BYOK credentials as application environment variables. Account and guest credentials are separately scoped, encrypted server records. Keep preview variables separate from production: use an isolated preview Supabase project or keep previews protected. `NEXT_PUBLIC_*` changes require rebuilding.

Vercel's Fluid compute supports the configured 300-second model routes on Hobby. Each provider dispatch still has its own 60-second timeout. The larger route allowance accommodates comparisons, one repair per generation, and explicitly enabled fallback; it does not add retries. See [function duration](https://vercel.com/docs/functions/configuring-functions/duration).

Upload batches are capped at 3 MiB on Vercel; multipart bodies at 4 MiB, up to three supported files, and at most 40 selected PDF pages by default. Selected-page text is bounded and extracted without sending other pages to the model. These caps account for Vercel's request-size limit.

## Admission and monitoring

Defaults are rolling limits per trusted network and browser/account identity. CLEAR Free also has UTC-day budgets: 20 attempts per guest, 100 per account, 20 per network and 1,000 globally. The network cap still applies to accounts. Repairs, comparisons and enabled fallback spend separate actual dispatch attempts; failed attempts are not refunded because they may incur provider cost. BYOK uses rate and concurrency controls but never spends CLEAR Free quota.

`CLEAR_AI_PAUSED=true` stops model dispatch; `CLEAR_FREE_PAUSED=true` stops only CLEAR Free. `CLEAR_PROVIDER_CONCURRENCY_LIMIT` defaults to eight active calls per provider. Limits fail closed if storage is unavailable. The environment example lists override names, including the separate email-auth limit of 12 network / 6 browser requests per ten minutes.

Sentry is initialized only when a valid DSN is present. It remains disabled while both DSNs are blank. When added later, reports contain generic error categories and allowlisted code locations. Questions, lesson text, files, email, cookies, IP addresses, identifiers and provider response bodies are excluded. Tracing, replay, breadcrumbs, logs, attachments and automatic request context are disabled. Verify one synthetic server error and one browser error arrive without private sentinel values before relying on monitoring.

## Release checks

```bash
npm ci
npm run lint
npm test
npm run test:eval
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run check:deployment -- --remote
```

Browser tests need an isolated mock production build with blank Supabase and monitoring variables and `NEXT_PUBLIC_APP_URL=https://localhost:3100`. CI provides this. Its test-only HTTPS proxy uses an ephemeral OpenSSL certificate, and only the browser test contexts ignore certificate validation; system trust and production Secure cookies stay unchanged. Its server uses a fresh temporary data directory and synthetic records; never point the harness at a production database. Tests cover Chromium, Firefox, WebKit and a 390-pixel mobile Chromium viewport.

Offline prompt checks validate reviewed reference material and the rubric, **not live model quality**. For billable live checks, explicitly supply `CLEAR_EVAL_LIVE=1`, `CLEAR_EVAL_ACK_COST=1`, `CLEAR_EVAL_PROVIDER`, `CLEAR_EVAL_MODEL` and `CLEAR_EVAL_API_KEY` in the process environment, then run `npm run test:eval:live`. Add `CLEAR_EVAL_EXTENDED=1` for follow-up and teach-back checks. Reports live under ignored `.data/evals` and record prompt versions, selected cases and failures. Optional `CLEAR_EVAL_CASES` narrows a diagnostic; a subset is not a full launch pass. The rubric uses bounded lexical checks and does not replace human review.

`check:deployment --remote` checks configuration, schema discovery, server functions and bucket privacy without writing learner data or printing secrets. Missing Sentry values are labeled `OPTIONAL` and do not fail the check. `/api/health` exposes only required configuration readiness; it does not test database connectivity, sign-in, model quality or telemetry delivery.

Before public launch, require a full live eval that meets the launch gate (no critical failure, perfect schema validity and consistency, mean score at least 0.85, no case below 0.70; see `LAUNCH_GATE` in `evals/score.ts`), a read of the lessons generated during the preview check, actual Supabase password sign-in/storage/share checks with two users and real microphone tests on target devices. SMTP delivery and Sentry receipt are explicitly deferred; validate them when those services are added. Latest live checks (2026-10-06): a lesson and a follow-up were generated locally against live Gemini and Supabase. The full 12-case live eval on `gemini-3.5-flash-lite` gave 12 schema-valid lessons, average 0.865, and 1 of 12 at the strict 1.0 on every dimension. That run predates the launch gate set on 2026-10-06 and did not record critical failures per case, so run it once more before launch.

Once the database, password-auth setting and environment are configured, publish a protected preview for those live checks. Complete the remaining launch gates and production smoke checks before promoting it publicly. Enable Git deployments only after the database and environment are ready. Donations, sponsors and billing remain the last launch item.

The production dependency audit (2026-10-06) reports two low-severity advisories: KaTeX GHSA-238p-pmpm-9mq7, reached through Mermaid. The only offered fix downgrades Mermaid across a major version, so it is tracked instead. CLEAR renders Mermaid with `securityLevel: "strict"` and sanitizes the SVG. The development lint dependency chain still has five high-severity advisories with no compatible upstream fix identified in this run. They are not part of the production runtime; track their upstream updates rather than forcing a breaking framework downgrade.
