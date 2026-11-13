# What the best platforms do, and what 10xBR takes from them

This is the short version of the platform review behind the 10xBR design. Product details change often, so treat the descriptions as a snapshot and check each vendor's site before relying on a specific feature.

## Immigration intake

| Platform | What it does well | What 10xBR takes |
| --- | --- | --- |
| Boundless | Plain-language questions, one decision per screen, an eligibility check before any payment or account | Stage 1 is eight single-tap questions with a result before sign-up |
| Alma | Fast, concierge-style intake for business visas with attorney review behind a clean client view | One status per record, and a person on the team approves stages 3 and 4 |
| Docketwise | Smart forms that reuse one answer across many forms, plus a client portal for document requests | Answers from stages 1 and 2 decide which documents are requested later |
| LegalPad, Deel Immigration | Company-side case tracking for founders and employers | The record is about a company, not only a person |

Shared pattern: ask the disqualifying questions first, in plain language, and never ask for a document before it is needed.

## Small-business M&A and diligence

| Platform | What it does well | What 10xBR takes |
| --- | --- | --- |
| Acquire.com | A handful of headline metrics per listing, an NDA before details, built-in e-signature | Stage 2 uses a few metrics; the NDA is signed in-app before any document is shared |
| Baton | Free valuation from a short questionnaire using SDE and multiples | A U.S. business is judged on trend, SDE, asking multiple, staff, lease and owner dependence, nothing more |
| BizBuySell | The standard language of small-business sales: SDE, asking price, reason for sale | Field names match what brokers and sellers already use |
| Flippa | Verified revenue through connected accounts | Verification is a separate last stage, after the numbers and core documents |

Shared pattern: three to six numbers are enough to decide whether a deeper look is worth it. Trend matters more than any single year.

## Data rooms and AI document review

| Platform | What it does well | What 10xBR takes |
| --- | --- | --- |
| Datasite, Intralinks | Request lists tied to a folder index, strict permissions, a full audit trail | A fixed checklist from the attorney's list, per-record access, append-only audit log |
| Papermark, DocSend | Simple sharing with an NDA gate and view tracking | Downloads are logged and always sent as attachments |
| Kira, Luminance, Hebbia | AI that classifies documents and extracts facts with a link back to the source | AI output is a labeled reading aid: type, period, key figures and concerns. Staff accept or reject each file |

Shared pattern: AI speeds up reading but never decides. Uploaded files are untrusted input, including for the model.

## Identity, business verification and e-signature

| Platform | What it does well | What 10xBR takes |
| --- | --- | --- |
| Persona, Middesk, Alloy | Identity and business checks as discrete, auditable steps with clear outcomes | Verification is a discrete last stage with a logged team decision |
| Checkr | Consent captured before a background check is ordered | Owner disclosures are collected in stage 4, before any outside check is ordered |
| DocuSign, Dropbox Sign | Signature record with document hash, time, IP and signer intent | Each signature stores the template version, a SHA-256 of the exact text, time, IP and user agent |

## Design rules that came out of this

1. One question per screen in stage 1, and a result in about two minutes.
2. A hard stop is shown as a reason and a next step, not as a rejection.
3. No document is requested until the two screens are passed and the NDA is signed.
4. Every number the owner types is later compared with a document by the AI first pass. Stage 2 is self-reported and is labeled that way.
5. AI summarizes and flags. People accept, reject and decide.
6. The owner always sees one thing to do next.
7. The platform screens. It does not give legal advice, and each result says so.

## Not built yet, on purpose

- Direct integrations with Google Drive, Dropbox and Box. Today the owner pastes a shared-folder link and staff pull files from it. A real connector needs OAuth apps registered with each provider.
- Vendor integrations for background checks and business verification. Stage 4 collects owners, disclosures and documents. The team runs outside checks with the vendor of choice.
- Third-party e-signature. The built-in signature is suitable for an NDA. Have counsel review the template in `shared/legal.ts` before using them with real clients.
- Email delivery (invitations, reminders, password reset).
- Pairing candidates with businesses. The two catalogs are independent today.
- More than one business per account.
