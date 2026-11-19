# Project notes: an example (Servgrow)

This file shows what a project's notes for this skill look like, filled in for one real product (Servgrow, a
field-service app: jobs, estimates, invoices, customer portal) with the private values replaced by `[placeholders]`.
For your product, copy it next to your takes as `<your-product>.md`, fill in your values, and keep the sections.

## Places

| What | Where |
|---|---|
| Web app (record here, never on production) | `[app_url]` (API `[api_url]`) |
| Customer portal | `[portal_url]/<companyId>/...` (API `[api_url]/customer-portal-api/<companyId>/...`) |
| Demo company | `[demo_company_name]`, id `[company_id]`, owner login `[email]` |
| Work dir with playwright-core, saved sessions, past takes | `[work_dir]` (past `record-*.mjs` and `*-mock.mjs` are worked examples) |
| Past voice lines and finished videos | `[voice_dir]/lines-*.json`, `*-voiced.mp4` |
| Voice for every video so far | `af_sky`, speed 1.0 ("same voice as before" means this) |

## Signing in (careful: the demo company can get blocked)

- Reuse the saved session (`[work_dir]/staging-session.json`). Check you're signed in (the URL isn't `/login`)
  before every recording. Never write storageState after landing on `/login`: that overwrites the good session.
- Sign in only when the session is dead, with one headless script that fills the 2FA code from the database. The
  password isn't stored anywhere the agent can read: ask the user.
- Database access: the connection string comes from the test API pod's environment (`[kube_context]`, namespace
  `[namespace]`). Ask the user before pulling it, write it to a mode-600 file in the scratchpad, never print it.
- "Your account has been suspended" means the company's access flag flipped, likely the request-rate alert after many
  page loads. Ask the user before unblocking it. Keep page loads per hour low: batch exploration into one script,
  reuse pages.

## Privacy and locale rules (the user checks these)

- Blur every phone number and email, in text and in inputs (the business phone on the company profile is an input).
- The demo company's name carries a test suffix (`[test_suffix]`): strip it with `rewrite()` on the current-user,
  company-settings and portal-account responses, and any other response that shows it.
- The demo company's real address and time zone aren't in the audience's country. On screen everything must read as
  US: swap the time zone to `America/Chicago` and the city to a US one in the responses, in the browser only.
- Test-data names (random customer names, plans named "Service Plan <hash>", "AQA Surcharge <hash>") never appear:
  mock the list or rename in the response.
- Hide the yellow "messages are not enabled yet" banner (`MASK_SCRIPT` `hide`) and the support chat bubble
  (`[support_widget_selector]`).

## Things learned per area

- Reports `/reports/*`: GET endpoints answer with the whole report. Money is in cents, rates in percent, and sorting
  uses `sortBy`/`desc` query params.
- Payment settings: `GET /company-settings/payment-settings`; bank payments `PATCH .../ach`; outside-payment methods
  `PATCH .../payment-options`. Invoice settings → Payment methods holds both.
- Portal sign-in: `POST [api_url]/customer-portal-api/<companyId>/account/magic-link {email}`, then the newest magic
  token for that customer from the database, then open `[portal_url]/<companyId>/invoices?token=<value>`. Save the
  portal storageState separately.
- Stripe Checkout (test mode) shows the sandbox account's name: point at the pay button instead of opening it.
- A finished job saves edits through a "What changed" dialog. The job keeps a change history; reset it in the database
  before a re-take.
- The plan editor (Plans We Offer → pencil) is a long scrolling dialog: scroll inside it, and scope locators to
  `page.getByRole('dialog')`.
