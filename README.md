# 10xBR

A simple platform that evaluates existing businesses for L-1 acquisitions, in two independent tracks:

- **U.S. businesses.** Is the business compliant for purchase by an L-1 investor? If it is, is it healthy and a sound investment? Approved businesses form the catalog shown to candidates.
- **Candidates with Brazilian businesses.** Does the candidate's company in Brazil qualify them for L-1 and can it support an acquisition? Approved candidates form the second catalog.

The business owner fills in everything. AI takes the first pass on every answer and document, and a person on the team reviews and decides. Pairing a candidate with a business is a later step and is not built.

10xBR screens for feasibility. It does not give legal or investment advice.

## The four stages

Both tracks use the same four stages. Each one opens only when the one before is cleared.

| Stage | What the owner does | Time | Gate |
| --- | --- | --- | --- |
| 1. L-1 compliance | Eight single-tap questions from the attorney's L-1 list | 2 min | Compliant, Gaps to fix or Not compliant. Scored automatically. Not compliant stops the record |
| 2. Business health | About ten numbers: revenue for three years, earnings, staff, price or funds | 5 min | Healthy, Watch or Weak. Scored automatically. Weak stops the record |
| 3. Core documents | Signs the NDA in the app, then uploads five documents or links a shared folder | 1 to 3 days | AI reads each file and compares it with the answers. The team approves |
| 4. Owners and verification | Lists the owners, answers four disclosures, uploads the remaining documents | 1 to 2 weeks | The team approves. The record enters the catalog |

The team can override a stopped gate, send a stage back with a note, decline, or reopen a record. Every decision needs a person and is logged.

## Dashboard and reports

- `/staff`: one table per track, with stage, L-1 result, health result, documents received, asking price or funds, the AI suggestion and status. Tiles filter by Needs review, In progress, Stopped, Catalog and Declined.
- `/report/:id`: a one-page report for a business or candidate, printable or saved as PDF.

Questions, thresholds and scoring live in `shared/process.ts`. The document lists are in `shared/documents.ts`, and the NDA text in `shared/legal.ts`.

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
