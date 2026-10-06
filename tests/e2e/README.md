# Browser regressions

Build with blank public Supabase/Sentry values, `CLEAR_PROVIDER=mock` and
`NEXT_PUBLIC_APP_URL=https://localhost:3100`, then run `npm run test:e2e`.
CI provides that isolated configuration. Do not reuse a build that embeds real
public integration settings from `.env.local`. Install the engines once with
`npx playwright install chromium firefox webkit`; Linux CI also installs their
system dependencies with `--with-deps`.

The suite runs Chromium, Firefox, WebKit, and a 390-pixel Chromium phone layout
against a local HTTPS production server on port 3100 (Next runs behind the test
proxy on port 3101). OpenSSL creates an ephemeral localhost certificate in the
run's temporary directory; Git for Windows and Ubuntu provide it. Set
`CLEAR_E2E_OPENSSL` if its executable lives elsewhere. The browser contexts ignore
only this fixture certificate's validation errors; no system trust is changed and
production Secure cookies remain enabled. It always starts its own server
and uses a fresh temporary data directory, an explicitly synthetic encryption
key, the local mock explanation provider, and empty Supabase/Sentry/model-key
settings. Limits remain enabled with larger test allowances. The temporary
lesson records are removed when the run ends.

Tests run with reduced motion so decorative animation never changes what a check sees.

Coverage includes the landing page, its FAQ and the mobile menu, every sample lesson tab, diagram text, widget, quiz, teach-back, persistent
follow-ups, legacy private copies, cross-browser-context ownership checks,
comparison selection, opt-in fallback, stored preferences, routing-load error/retry, sharing previews,
frozen snapshots, replacement/revocation, actual lesson downloads, and seven-file
skill ZIP/preview agreement (normalizing HTML line endings). Light and dark screens are checked for
WCAG 2/2.1 A/AA violations, keyboard navigation, and page overflow at 390 pixels.

These are application regressions with synthetic provider responses. They do
not validate live model answer quality, real Supabase email authentication,
screen readers, or microphone/speech accuracy on actual devices.

Run `npm run test:auth-ui` for configured email/password form behavior. That
separate suite copies the current form into a temporary Next application on port
3102, uses intercepted synthetic responses with no Supabase code or session,
and checks password handling, request locks, confirmation, navigation and mobile
accessibility. Its `.ui.ts` files are excluded from the production guest suite
by the default test naming pattern. See `auth-ui/README.md` for its scope.

For a targeted run, use `npm run test:e2e -- --project=chromium`. HTML reports and
failure traces/screenshots use `.data/e2e-report` and `.data/e2e-results`; all
captured lessons are synthetic. CI uploads only these failure artifacts and
retains them for seven days.
