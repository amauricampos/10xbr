# 10x BR

A simple platform that evaluates existing businesses for L-1 acquisitions, in two independent tracks:

- **U.S. businesses.** Is the business compliant for purchase by an L-1 investor? If it is, is it healthy and a sound investment? Approved businesses form the catalog shown to candidates.
- **Candidates with Brazilian businesses.** Does the candidate's company in Brazil qualify them for L-1 and can it support an acquisition? Approved candidates form the second catalog.

The business owner fills in everything. AI takes the first pass on every answer and document, and a person on the team reviews and decides. Pairing a candidate with a business is a later step and is not built.

10x BR screens for feasibility. It does not give legal or investment advice.

## The four stages

Both tracks use the same four stages. Each one opens only when the one before is cleared.

| Stage | What the owner does | Time | Gate |
| --- | --- | --- | --- |
| 1. L-1 compliance | Single-tap questions (nine as shipped), one per L-1A requirement ([docs/l1-requirements.md](docs/l1-requirements.md)), then name and email before the result is shown | 2 min | Compliant, Gaps to fix or Not compliant. Scored automatically. Answers are final. Not compliant stops the record |
| 2. Business health | When the business started, then about ten numbers in named sections: revenue for each calendar year since then (up to three, including the current year to date), earnings, staff, price or funds | 5 min | Healthy, Watch or Weak. Scored automatically. Weak stops the record |
| 3. Core documents | Signs the NDA in the app, then uploads five documents or links a shared folder | 1 to 3 days | AI reads each file and compares it with the answers. The team approves |
| 4. Owners and verification | Lists the owners, answers four disclosures, uploads the remaining documents | 1 to 2 weeks | The team approves. The record enters the catalog |

The team can override a stopped gate, send a stage back with a note, decline, or reopen a record. Every decision needs a person and is logged.

## Dashboard and reports

- `/staff`: one table per track, with stage, L-1 result, health result, documents received, asking price or funds, the AI suggestion and status. Tiles filter by Needs review, In progress, Stopped, Catalog and Declined.
- The Leads tab lists people who saw a result but did not create an account.
- `/report/:id`: a one-page report for a business or candidate, printable or saved as PDF.

Questions, thresholds and scoring live in `shared/process.ts`. The document lists are in `shared/documents.ts`, and the NDA text in `shared/legal.ts`.

## Admin

`/admin` is for team members marked as admin (the first account created at `/setup` is one):

- **Overview**: a funnel per track, from questions answered to catalog, plus what is waiting for the team, and CSV exports of leads and records.
- **Questionnaires**: edit the L-1 screen for each track, the business health form for each track, and the final disclosures. See below.
- **Team**: invite by email (single-use link, valid seven days), make or remove admins, reset two-step sign-in, deactivate.
- **Owner accounts**: every owner with their record, and deactivate.
- **Activity**: the full audit log.

Reviewers (team members who are not admins) see `/staff` only.

### Editing the questionnaires

Each questionnaire is edited in both languages, reordered by dragging (or with the arrow keys on the grip), and saved as a new version. The shipped questions live in `shared/process.ts`; saved edits are stored in the `forms` table and applied on top.

- **L-1 screen**: add, remove and reorder questions and answers; set each answer to Met, Needs attention or Not met and write what the scorecard says for it. One Not met still stops the record.
- **Business health**: add, rename, remove and reorder sections and questions. The built-in questions feed the score: they can be reworded, moved or removed, but their answer type is fixed, and a result is left out of the score while one of its questions is off the form. The revenue questions always stay. Added questions can be a number, percent, amount, choice or text, required or optional; a choice whose answers are graded Good, Fair or Weak counts toward the score, and the rest are listed under the result for the team.
- **Disclosures**: add, remove, reword and reorder the yes/no questions.

A save applies to everyone who answers from then on. Scorecards and health results already given are stored as shown, so they keep their wording and score. "Reset to original" and "Earlier versions" load a version into the editor; nothing changes until it is saved. A form that cannot be answered or passed (no questions, an empty section, a question with fewer than two answers, every answer Not met) is refused.

### When the L-1 screen fails

A failed screen ends at the scorecard: no account is created and there is nothing more to fill in. The result appears under Leads on `/staff`. If the team sees a way forward, "Open next step" records a reason, emails the person a link, and lets them create an account that starts at business health.

An owner whose record is stopped or declined sees the result and the team's note, without the stage navigation or forms.

## Pages

- `/`: overview and instructions for an owner who has already been briefed, then straight to the form.
- `/sell`: the marketing landing page for U.S. owners who arrive cold. It is kept for later and is not linked from anywhere.

## Scorecard email

After the questions the owner gives a name and email and sees a scorecard: how many of the requirements are met, and each one with its status. The same scorecard is emailed through [Resend](https://resend.com) when these are set:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM       # e.g. 10x BR <hello@10xbr.com>, on a domain verified with Resend
```

Without them nothing is sent and the scorecard is shown on screen only. The email links to `/resume/:id`, which reopens the saved result. One address receives at most three scorecards a day.

## Stack

- Cloudflare Workers with Hono (`worker/`)
- React 19 and Vite (`src/`)
- Cloudflare D1 for data and for encrypted document storage
- Workers AI for document reading and the first-pass review

## Security

- Passwords: PBKDF2-SHA256 with a per-user salt
- Sessions: HTTP-only, Secure, SameSite cookies, with Origin checks on every write
- Staff two-step sign-in with an authenticator app
- Documents: AES-256-GCM encrypted before storage, type-checked by extension and content, always downloaded as attachments
- Owners can reach only their own record
- Append-only audit log, enforced by database triggers
- Rate limits on sign-in, sign-up, uploads and AI calls
- Strict Content-Security-Policy and related headers
- Uploaded files are treated as untrusted input to the AI model, and AI output is never used to make a decision

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in both values
npm run db:migrate:local
npm run dev
```

Open `/setup` and use the `SETUP_TOKEN` value to create the first staff account.

```bash
npm test          # scoring rules and crypto helpers
npm run typecheck
```

## Deploy

```bash
npm run db:migrate:remote
npx wrangler secret put DOC_KEY       # base64 of 32 random bytes
npx wrangler secret put SETUP_TOKEN   # any long random string
npm run deploy
```

`DOC_KEY` encrypts every stored document. Keep a copy somewhere safe: without it the files cannot be read.

## More

- [Platform research](docs/research.md)
- [Moving 10xbr.com to Cloudflare](docs/domain-setup.md)
- Brand guidelines at `/brand` in the app, with logo files in `public/brand/`
