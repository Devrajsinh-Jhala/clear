# Password-form UI regressions

Run `npx playwright test --config tests/e2e/auth-ui.config.ts`.

This separate suite copies the current AccountForm, PageShell and CSS into a
fresh temporary Next application, using the repository's installed dependencies.
It supplies configured=true only in that test fixture, uses the actual Next
router, and writes an isolated development build on port 3102. It never copies
environment files or private records and loads no Supabase, provider or monitoring
code. All authentication HTTP responses are synthetic and intercepted; external
browser requests are blocked. A successful response tests navigation only and
does not create or verify an authentication session.

Coverage includes password whitespace, bounds/autocomplete, mode switches,
retained failed-login drafts, duplicate submission locks, confirmation handling,
successful login/signup navigation, and light/dark keyboard/accessibility checks
at 390 pixels. The fixture uses local system fonts with the product's CSS.

The normal production guest suite ignores the `.ui.ts` files automatically.
Reports/screenshots are synthetic and stored in `.data/auth-ui-report` and
`.data/auth-ui-results`. Cleanup removes the dependency link itself before the
temporary fixture, after its server stops; it never deletes repository packages.
