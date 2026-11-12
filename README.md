# 10xBR

A staged screening platform for L-1 visa applicants who plan to open or buy a business in the United States. It starts with a two-minute check and asks for more only as each gate is passed.

10xBR screens for feasibility. It does not give legal advice.

## The five stages

| Stage | What happens | Time | Gate |
| --- | --- | --- | --- |
| 1. L-1 quick check | Nine single-tap questions drawn from the attorney's L-1A list | 2 min | Strong, Possible or Not yet. Core disqualifiers stop the case unless staff override |
| 2. Business snapshot | A few numbers on the company abroad, and on the US target if there is one | 5 min | Healthy, Watch or Weak |
| 3. Essentials | NDA signed in-app, a shared-folder link, the core documents, AI reading of each file | 1 to 3 days | Staff review |
| 4. Deep verification | Signed consent, the rest of the attorney's checklist, background, tax and bank checks | 1 to 2 weeks | Staff review |
| 5. Decision | Proceed, proceed with conditions, or do not proceed, with a written brief | | Released by staff |

Questions, thresholds and scoring live in `shared/process.ts`. The document checklist is in `shared/documents.ts`, and the NDA and consent text in `shared/legal.ts`.

## Stack

- Cloudflare Workers with Hono (`worker/`)
- React 19 and Vite (`src/`)
- Cloudflare D1 for data and for encrypted document storage
- Workers AI for document reading and the draft brief

## Security

- Passwords: PBKDF2-SHA256 with a per-user salt
- Sessions: HTTP-only, Secure, SameSite cookies, with Origin checks on every write
- Staff two-step sign-in with an authenticator app
- Documents: AES-256-GCM encrypted before storage, type-checked by extension and content, always downloaded as attachments
- Applicants can reach only their own case
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
