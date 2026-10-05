# Deploy CLEAR to Vercel and Supabase

The new Vercel project is `devrajsinhjhalas-projects/clear`, connected to `Devrajsinh-Jhala/clear`. No deployment has been published. Git deployments are disabled in `vercel.json` until the production checks below pass.

## Database and private storage

Back up an existing project before applying migrations. Apply every file in `supabase/migrations` in filename order, using a linked Supabase CLI project or the SQL editor. The existing CLEAR project already has the initial and sharing schema; the new files for this phase are:

1. `20261005090000_durable_state_and_uploads.sql` — private credentials, learning, routing and comparison records; private upload bucket.
2. `20261005100000_usage_limits.sql` — atomic request budgets and provider concurrency leases.
3. `20261005110000_atomic_lesson_save.sql` — transactional lesson writes, revision conflict protection and immutable ownership.
4. `20261005120000_account_library.sql` — account library permissions and restricted browser writes.
5. `20261005130000_account_lesson_cleanup.sql` — atomic account deletion and durable media-cleanup jobs.

These migrations were tested together in PostgreSQL via PGlite. They have **not** been applied to the live Supabase project. Browser roles cannot read credential, sharing or quota tables, or call privileged write functions. The app server uses the service key after verifying lesson ownership; the library uses a verified account session and row-level security.

The `clear-uploads` bucket must remain private. Original files have no public route or signed download URL. Vercel never falls back to local files. Local development uses `.data` or `CLEAR_DATA_DIR`; changing to Supabase does not import existing local records. Preserve the original encryption key when moving any encrypted credentials.

## Email sign-in

Enable email authentication in Supabase. Set the signup and magic-link templates to display `{{ .Token }}`: CLEAR accepts an email code rather than a magic-link callback. Configure a production SMTP service and verify delivery to an address outside the project team. The default Supabase mail service restricts recipients; see [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Set the Supabase site URL to the final HTTPS application URL. Test expired and incorrect codes, resend, sign-out, a second device, and two different users. Sign-in creates an account library for new lessons. Earlier guest lessons, connections, memory and routing are not moved automatically. The library displays the latest 100 lessons.

## Vercel configuration

Use `.env.example` as the variable inventory. Set production variables in the project dashboard or CLI; never commit an environment file or paste secrets into an issue or chat.

Required production values:

- `NEXT_PUBLIC_APP_URL`: the verified final HTTPS origin.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key).
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`): server only.
- `APP_ENCRYPTION_KEY`: a persistent, base64-encoded 32-byte key. Rotating it requires a credential migration and changes account learning identifiers.
- `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash`. Leave `CLEAR_PROVIDER` blank. The configured key could not access Gemini 2.5 Flash; selecting that model still reports its own failure.
- `CLEAR_TRUSTED_IP_HEADER=x-vercel-forwarded-for`. Only use a header overwritten by the deployment edge. Unconfigured or malformed network headers share an unknown-network budget.
- `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`: valid HTTPS Sentry DSNs for error reports. Client DSNs are public identifiers; provider and service keys are not.

Never set user BYOK credentials as application environment variables. Account and guest credentials are separately scoped, encrypted server records. Keep preview variables separate from production: use an isolated preview Supabase project or keep previews protected. `NEXT_PUBLIC_*` changes require rebuilding.

Vercel's Fluid compute supports the configured 300-second model routes on Hobby. Each provider dispatch still has its own 60-second timeout. The larger route allowance accommodates comparisons, one repair per generation, and explicitly enabled fallback; it does not add retries. See [function duration](https://vercel.com/docs/functions/configuring-functions/duration).

Upload batches are capped at 3 MiB on Vercel; multipart bodies at 4 MiB, up to three supported files, and at most 40 selected PDF pages by default. Selected-page text is bounded and extracted without sending other pages to the model. These caps account for Vercel's request-size limit.

## Admission and monitoring

Defaults are rolling limits per trusted network and browser/account identity. CLEAR Free also has UTC-day budgets: 20 attempts per guest, 100 per account, 20 per network and 1,000 globally. The network cap still applies to accounts. Repairs, comparisons and enabled fallback spend separate actual dispatch attempts; failed attempts are not refunded because they may incur provider cost. BYOK uses rate and concurrency controls but never spends CLEAR Free quota.

`CLEAR_AI_PAUSED=true` stops model dispatch; `CLEAR_FREE_PAUSED=true` stops only CLEAR Free. `CLEAR_PROVIDER_CONCURRENCY_LIMIT` defaults to eight active calls per provider. Limits fail closed if storage is unavailable. The environment example lists override names, including the separate email-auth limit of 12 network / 6 browser requests per ten minutes.

Sentry is initialized only when a valid DSN is present. Reports contain generic error categories and allowlisted code locations. Questions, lesson text, files, email, cookies, IP addresses, identifiers and provider response bodies are excluded. Tracing, replay, breadcrumbs, logs, attachments and automatic request context are disabled. Verify one synthetic server error and one browser error arrive without any private sentinel values before enabling production traffic.

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

`check:deployment --remote` checks configuration, schema discovery, server functions and bucket privacy without writing learner data or printing secrets. `/api/health` exposes only configuration readiness; it does not test database connectivity, mail, model quality or telemetry delivery.

Before public launch, require a full successful live eval plus human review, actual Supabase sign-in/storage/share checks with two users, SMTP delivery, Sentry receipt and real microphone tests on target devices. Latest live checks failed: the prompt's list-type mismatch was fixed, but subsequent Gemini requests returned HTTP 503. Successful generation with the updated prompt remains unverified.

Once the database, mail and environment are configured, publish a protected preview for those live checks. Complete the launch gates and production smoke checks before promoting it publicly. Enable Git deployments only after the database and environment are ready. Donations, sponsors and billing remain the last launch item.

The production dependency audit reports zero advisories. The development lint dependency chain still has five high-severity advisories with no compatible upstream fix identified in this run. They are not part of the production runtime; track their upstream updates rather than forcing a breaking framework downgrade.
