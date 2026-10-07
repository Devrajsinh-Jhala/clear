# Live checks

These run against the deployed site (default `https://clear-explainer.vercel.app`; set `CLEAR_LIVE_URL` for another address). They create real records and make a few real model calls, so they run only when you ask, never in CI.

```bash
npm run test:live -- guest      # everything a visitor can do; no account needed
npm run test:live -- accounts   # signed-in checks with two accounts
npm run test:live               # both
```

## Guest checks (`guest.live.ts`)

Public pages and security headers, a phone-sized pass, one real question with every view, a quiz, teach-it-back and a follow-up, downloads, a share link opened by a stranger and then revoked, the skill ZIP, saved settings, and one image and one PDF question. About five CLEAR Free model calls.

## Account checks (`accounts.live.ts`)

Create two accounts on the site first. Then put their details in `.env.live.local` in the project folder. Git and Vercel both ignore that file.

```
CLEAR_LIVE_EMAIL_A=first@example.com
CLEAR_LIVE_PASSWORD_A=...
CLEAR_LIVE_EMAIL_B=second@example.com
CLEAR_LIVE_PASSWORD_B=...
```

The run checks a refused wrong password, sign-in, a saved lesson, favourite, rename, search, archive and restore, the same account on a second device, that the second account cannot open or change the first account's lesson, a share link read by the second account, sign-out, and deletion. It uses the built-in sample lesson, so it makes no model calls, and it deletes the lesson it created.

Each real question in the guest checks counts against the 20 CLEAR Free lessons a network may use in a day (it resets at 00:00 UTC), so do not run the full guest set more than once or twice a day from the same network.

The site allows six sign-in requests per network in ten minutes and this run uses four, so wait ten minutes after creating the accounts and between runs.

Passwords are typed only into the site's own sign-in form. Traces are off, and a failed step never prints the password. Without the four values the account checks are skipped.
