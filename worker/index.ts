import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { analyzeDocument, reviewCase } from './ai';
import {
  base32Encode,
  fromB64,
  hashPassword,
  importDataKey,
  open,
  randomToken,
  safeEqual,
  seal,
  sha256Hex,
  toB64,
  totpVerify,
} from './crypto';
import { HttpError, now, type AppEnv, type Env, type User } from './env';
import { MAX_FILE_BYTES, MAX_FILES_PER_CASE, cleanFilename, deleteFile, getFile, putFile, sniff } from './storage';
import { docLabel, docsFor } from '../shared/documents';
import { NDA_VERSION, ndaText } from '../shared/legal';
import { mailReady, scorecardEmail, sendMail } from './scorecard';
import {
  DISCLOSURES,
  LAST_STAGE,
  scoreStage1,
  scoreStage2,
  stage1Complete,
  stage2Complete,
  stage4Complete,
  type Kind,
  type Stage1Answers,
  type Stage1Result,
  type Stage2Answers,
  type Stage2Result,
  type Stage4Answers,
  type Status,
} from '../shared/process';

const app = new Hono<AppEnv>().basePath('/api');

const APPLICANT_SESSION_MS = 7 * 24 * 3600 * 1000;
const STAFF_SESSION_MS = 12 * 3600 * 1000;

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

const cookieName = (c: Context<AppEnv>) => (new URL(c.req.url).protocol === 'https:' ? '__Host-sid' : 'sid');

app.use('*', async (c, next) => {
  c.set('ip', c.req.header('CF-Connecting-IP') ?? 'local');
  c.set('user', null);

  // CSRF: state-changing requests must come from our own origin.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    let ok = false;
    try {
      ok = !!origin && new URL(origin).host === new URL(c.req.url).host;
    } catch {
      ok = false;
    }
    if (!ok) throw new HttpError(403, 'bad_origin');
  }

  const token = getCookie(c, cookieName(c));
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.lang, u.totp_enabled, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
      .bind(await sha256Hex(token))
      .first<User & { expires_at: number }>();
    if (row && row.expires_at > now()) {
      const { expires_at: _expires, ...user } = row;
      c.set('user', user);
    }
  }

  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
});

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.code, message: err.message }, err.status);
  if (err instanceof z.ZodError) return c.json({ error: 'invalid_input', message: 'Check the form and try again.' }, 400);
  console.error('unhandled', err);
  return c.json({ error: 'server_error' }, 500);
});

function requireUser(c: Context<AppEnv>): User {
  const u = c.get('user');
  if (!u) throw new HttpError(401, 'unauthenticated');
  return u;
}

function requireStaff(c: Context<AppEnv>): User {
  const u = requireUser(c);
  if (u.role !== 'staff') throw new HttpError(403, 'forbidden');
  return u;
}

async function rateLimit(env: Env, bucket: string, limit: number, windowSec: number): Promise<void> {
  const t = now();
  const cutoff = t - windowSec * 1000;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(bucket) DO UPDATE SET
       count = CASE WHEN window_start < ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END
     RETURNING count`,
  )
    .bind(bucket, t, cutoff)
    .first<{ count: number }>();
  if (row && row.count > limit) throw new HttpError(429, 'rate_limited', 'Too many attempts. Try again later.');
}

async function audit(c: Context<AppEnv>, action: string, caseId: string | null = null, detail: unknown = null, actor?: User) {
  const u = actor ?? c.get('user');
  await c.env.DB.prepare('INSERT INTO audit_log (at, actor_id, actor_email, action, case_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(now(), u?.id ?? null, u?.email ?? null, action, caseId, detail == null ? null : JSON.stringify(detail).slice(0, 2000), c.get('ip'))
    .run();
}

async function startSession(c: Context<AppEnv>, user: Pick<User, 'id' | 'role'>) {
  const token = randomToken(32);
  const ttl = user.role === 'staff' ? STAFF_SESSION_MS : APPLICANT_SESSION_MS;
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), user.id, now(), now() + ttl, c.get('ip'), (c.req.header('User-Agent') ?? '').slice(0, 300))
    .run();
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, cookieName(c), token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: Math.floor(ttl / 1000) });
  // Opportunistic cleanup of expired sessions.
  c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run());
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(10).max(200);
const Name = z.string().trim().min(2).max(120);
const LangZ = z.enum(['en', 'pt']);
const KindZ = z.enum(['us', 'br']);

async function staffExists(env: Env): Promise<boolean> {
  return !!(await env.DB.prepare("SELECT 1 AS x FROM users WHERE role = 'staff' LIMIT 1").first());
}

app.get('/auth/me', async (c) => {
  return c.json({
    user: c.get('user'),
    config: {
      entity: c.env.LEGAL_ENTITY,
      openSignup: c.env.OPEN_SIGNUP === 'true',
      setupNeeded: !(await staffExists(c.env)),
      ai: !!c.env.AI,
      mail: mailReady(c.env),
    },
  });
});

app.post('/auth/register', async (c) => {
  if (c.env.OPEN_SIGNUP !== 'true') throw new HttpError(403, 'signup_closed');
  await rateLimit(c.env, `reg:${c.get('ip')}`, 5, 3600);
  const body = z
    .object({ email: Email, name: Name, password: Password, lang: LangZ.default('en'), kind: KindZ, s1_answers: z.record(z.string(), z.string()).optional() })
    .parse(await c.req.json());

  if (await c.env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(body.email).first()) {
    throw new HttpError(409, 'email_taken', 'An account with this email already exists. Sign in instead.');
  }
  const { hash, salt } = await hashPassword(body.password);
  const userId = randomToken(16);
  const caseId = randomToken(16);
  const t = now();

  let stage = 1;
  let status: Status = 'active';
  let s1a: string | null = null;
  let s1r: string | null = null;
  if (body.s1_answers && stage1Complete(body.kind, body.s1_answers)) {
    const result = scoreStage1(body.kind, body.s1_answers);
    s1a = JSON.stringify(body.s1_answers);
    s1r = JSON.stringify(result);
    stage = result.passed ? 2 : 1;
    status = result.passed ? 'active' : 'stopped';
  }

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, email, name, role, pw_hash, pw_salt, lang, created_at) VALUES (?, ?, ?, 'applicant', ?, ?, ?, ?)").bind(
      userId, body.email, body.name, hash, salt, body.lang, t,
    ),
    c.env.DB.prepare('INSERT INTO cases (id, user_id, kind, stage, status, s1_answers, s1_result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      caseId, userId, body.kind, stage, status, s1a, s1r, t, t,
    ),
  ]);
  const user: User = { id: userId, email: body.email, name: body.name, role: 'applicant', lang: body.lang, totp_enabled: 0 };
  await startSession(c, user);
  await audit(c, 'account.created', caseId, { kind: body.kind }, user);
  if (s1a) c.executionCtx.waitUntil(runReview(c.env, caseId));
  return c.json({ user, caseId });
});

app.post('/leads', async (c) => {
  await rateLimit(c.env, `lead:${c.get('ip')}`, 10, 3600);
  const body = z
    .object({ email: Email, name: Name, lang: LangZ.default('en'), kind: KindZ, s1_answers: z.record(z.string(), z.string()) })
    .parse(await c.req.json());
  if (!stage1Complete(body.kind, body.s1_answers)) throw new HttpError(400, 'incomplete');
  const result = scoreStage1(body.kind, body.s1_answers);
  const t = now();
  const row = await c.env.DB.prepare(
    `INSERT INTO leads (id, email, name, kind, lang, s1_answers, s1_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (email, kind) DO UPDATE SET name = excluded.name, lang = excluded.lang, s1_answers = excluded.s1_answers, s1_rating = excluded.s1_rating, updated_at = excluded.updated_at
     RETURNING id`,
  )
    .bind(randomToken(16), body.email, body.name, body.kind, body.lang, JSON.stringify(body.s1_answers), result.rating, t, t)
    .first<{ id: string }>();

  // A recipient gets at most three scorecards a day, so the form cannot be used to flood an inbox.
  let emailed = false;
  if (row && mailReady(c.env)) {
    emailed = await rateLimit(c.env, `scorecard:${body.email}`, 3, 86400).then(
      () => true,
      () => false,
    );
    if (emailed) {
      const mail = scorecardEmail({ kind: body.kind, lang: body.lang, name: body.name, result, link: `${new URL(c.req.url).origin}/resume/${row.id}` });
      c.executionCtx.waitUntil(
        sendMail(c.env, { to: body.email, ...mail }).then(async (ok) => {
          if (ok) await c.env.DB.prepare('UPDATE leads SET scorecard_sent_at = ? WHERE id = ?').bind(now(), row.id).run();
        }),
      );
    }
  }
  return c.json({ ok: true, emailed });
});

/** Opens a saved result from the link in the scorecard email. The id is an unguessable token. */
app.get('/leads/:id', async (c) => {
  await rateLimit(c.env, `resume:${c.get('ip')}`, 30, 3600);
  const row = await c.env.DB.prepare('SELECT kind, name, email, s1_answers FROM leads WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ kind: Kind; name: string; email: string; s1_answers: string }>();
  if (!row) throw new HttpError(404, 'not_found');
  return c.json({ kind: row.kind, name: row.name, email: row.email, answers: JSON.parse(row.s1_answers) });
});

/** People who saw a result but have not created an account. */
app.get('/leads', async (c) => {
  requireStaff(c);
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.email, l.name, l.kind, l.s1_rating, l.updated_at, l.scorecard_sent_at FROM leads l
     LEFT JOIN users u ON u.email = l.email WHERE u.id IS NULL ORDER BY l.updated_at DESC LIMIT 500`,
  ).all();
  return c.json({ leads: results });
});

app.post('/auth/login', async (c) => {
  const body = z.object({ email: Email, password: z.string().max(200), code: z.string().max(12).optional() }).parse(await c.req.json());
  await rateLimit(c.env, `login:${c.get('ip')}`, 20, 900);
  await rateLimit(c.env, `login:${body.email}`, 8, 900);

  const row = await c.env.DB.prepare('SELECT id, email, name, role, lang, totp_enabled, totp_secret, pw_hash, pw_salt FROM users WHERE email = ?')
    .bind(body.email)
    .first<User & { totp_secret: string | null; pw_hash: string; pw_salt: string }>();
  // Hash even when the user is unknown so timing does not reveal which emails exist.
  const { hash } = await hashPassword(body.password, row?.pw_salt ?? 'AAAAAAAAAAAAAAAAAAAAAA==');
  if (!row || !(await safeEqual(hash, row.pw_hash))) {
    await audit(c, 'login.failed', null, { email: body.email });
    throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
  }
  if (row.totp_enabled) {
    if (!body.code) throw new HttpError(401, 'totp_required');
    const secret = new TextDecoder().decode(await open(await importDataKey(c.env.DOC_KEY), fromB64(row.totp_secret!)));
    if (!(await totpVerify(secret, body.code))) {
      await audit(c, 'login.totp_failed', null, { email: body.email });
      throw new HttpError(401, 'invalid_code', 'That code is not valid.');
    }
  }
  const user: User = { id: row.id, email: row.email, name: row.name, role: row.role, lang: row.lang, totp_enabled: row.totp_enabled };
  await startSession(c, user);
  await audit(c, 'login.ok', null, null, user);
  return c.json({ user });
});

app.post('/auth/logout', async (c) => {
  const token = getCookie(c, cookieName(c));
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, cookieName(c), { path: '/', secure: new URL(c.req.url).protocol === 'https:' });
  return c.json({ ok: true });
});

app.post('/auth/setup', async (c) => {
  await rateLimit(c.env, `setup:${c.get('ip')}`, 5, 3600);
  const body = z.object({ token: z.string().min(1).max(200), email: Email, name: Name, password: Password }).parse(await c.req.json());
  if (!c.env.SETUP_TOKEN || (await staffExists(c.env))) throw new HttpError(403, 'setup_closed', 'Setup is already complete.');
  if (!(await safeEqual(body.token, c.env.SETUP_TOKEN))) throw new HttpError(403, 'bad_token', 'That setup token is not valid.');
  if (await c.env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(body.email).first()) throw new HttpError(409, 'email_taken');
  const { hash, salt } = await hashPassword(body.password);
  const id = randomToken(16);
  await c.env.DB.prepare("INSERT INTO users (id, email, name, role, pw_hash, pw_salt, lang, created_at) VALUES (?, ?, ?, 'staff', ?, ?, 'en', ?)")
    .bind(id, body.email, body.name, hash, salt, now())
    .run();
  const user: User = { id, email: body.email, name: body.name, role: 'staff', lang: 'en', totp_enabled: 0 };
  await startSession(c, user);
  await audit(c, 'staff.created', null, null, user);
  return c.json({ user });
});

app.post('/auth/lang', async (c) => {
  const u = requireUser(c);
  const { lang } = z.object({ lang: LangZ }).parse(await c.req.json());
  await c.env.DB.prepare('UPDATE users SET lang = ? WHERE id = ?').bind(lang, u.id).run();
  return c.json({ ok: true });
});

app.post('/auth/totp/begin', async (c) => {
  const u = requireUser(c);
  if (u.totp_enabled) throw new HttpError(409, 'totp_already_enabled');
  const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  const sealed = toB64(await seal(await importDataKey(c.env.DOC_KEY), new TextEncoder().encode(secret)));
  await c.env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').bind(sealed, u.id).run();
  const label = encodeURIComponent(`${c.env.APP_NAME}:${u.email}`);
  return c.json({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(c.env.APP_NAME)}` });
});

app.post('/auth/totp/enable', async (c) => {
  const u = requireUser(c);
  const { code } = z.object({ code: z.string().max(12) }).parse(await c.req.json());
  const row = await c.env.DB.prepare('SELECT totp_secret FROM users WHERE id = ?').bind(u.id).first<{ totp_secret: string | null }>();
  if (!row?.totp_secret) throw new HttpError(400, 'totp_not_started');
  const secret = new TextDecoder().decode(await open(await importDataKey(c.env.DOC_KEY), fromB64(row.totp_secret)));
  if (!(await totpVerify(secret, code))) throw new HttpError(400, 'invalid_code', 'That code is not valid.');
  await c.env.DB.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').bind(u.id).run();
  await audit(c, 'totp.enabled');
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Cases: one evaluation of one business                               */
/* ------------------------------------------------------------------ */

type CaseRow = {
  id: string;
  user_id: string;
  kind: Kind;
  company_name: string;
  location: string;
  industry: string;
  stage: number;
  status: Status;
  s1_answers: string | null;
  s1_result: string | null;
  s2_answers: string | null;
  s2_result: string | null;
  s4_answers: string | null;
  folder_url: string | null;
  ai_review: string | null;
  ai_review_status: string;
  team_note: string | null;
  history: string;
  created_at: number;
  updated_at: number;
};

const parse = <T>(s: string | null): T | null => (s ? (JSON.parse(s) as T) : null);
const open_ = (row: CaseRow) => row.status === 'active' || row.status === 'stopped';

/** Returns the case only when the caller owns it or is staff. Unknown and forbidden look the same. */
async function loadCase(c: Context<AppEnv>, id: string): Promise<CaseRow> {
  const u = requireUser(c);
  const row = await c.env.DB.prepare('SELECT * FROM cases WHERE id = ?').bind(id).first<CaseRow>();
  if (!row || (u.role !== 'staff' && row.user_id !== u.id)) throw new HttpError(404, 'not_found');
  return row;
}

async function caseView(c: Context<AppEnv>, row: CaseRow) {
  const u = requireUser(c);
  const staff = u.role === 'staff';
  const [sigs, docs, owner] = await Promise.all([
    c.env.DB.prepare('SELECT kind, version, signer_name, signed_at FROM signatures WHERE case_id = ?').bind(row.id).all(),
    c.env.DB.prepare(
      'SELECT id, item_key, filename, size, ai_status, ai_result, review, review_note, created_at FROM documents WHERE case_id = ? ORDER BY created_at',
    )
      .bind(row.id)
      .all<{ ai_result: string | null } & Record<string, unknown>>(),
    staff ? c.env.DB.prepare('SELECT name, email FROM users WHERE id = ?').bind(row.user_id).first() : null,
  ]);
  return {
    id: row.id,
    kind: row.kind,
    company_name: row.company_name,
    location: row.location,
    industry: row.industry,
    stage: row.stage,
    status: row.status,
    s1_answers: parse(row.s1_answers),
    s1_result: parse(row.s1_result),
    s2_answers: parse(row.s2_answers),
    s2_result: parse(row.s2_result),
    s4_answers: parse(row.s4_answers),
    folder_url: row.folder_url,
    team_note: row.team_note,
    // The AI first pass and the decision trail are for the team only.
    ai_review: staff ? parse(row.ai_review) : null,
    ai_review_status: staff ? row.ai_review_status : 'none',
    history: staff ? parse(row.history) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner,
    signatures: sigs.results,
    documents: docs.results.map((d) => {
      const ai = parse<{ doc_type: string; matches_request: string; concerns: string[] }>(d.ai_result);
      return {
        ...d,
        // Owners get the short feedback that helps them fix an upload; staff get the full analysis.
        ai_result: !ai ? null : staff ? ai : { doc_type: ai.doc_type, matches_request: ai.matches_request, concerns: ai.concerns },
      };
    }),
  };
}

/** Required documents received so far, against those requested up to the current stage. */
function docProgress(kind: Kind, stage: number, keys: Set<string>) {
  const required = docsFor(kind, Math.max(stage, 3)).filter((d) => !d.optional);
  return { received: required.filter((d) => keys.has(d.key)).length, required: required.length };
}

app.get('/cases', async (c) => {
  const u = requireUser(c);
  if (u.role !== 'staff') {
    const rows = await c.env.DB.prepare('SELECT id, kind, stage, status FROM cases WHERE user_id = ? ORDER BY created_at').bind(u.id).all();
    return c.json({ cases: rows.results });
  }
  const [rows, docs] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.id, c.kind, c.company_name, c.location, c.industry, c.stage, c.status, c.s1_result, c.s2_result, c.s2_answers,
              c.ai_review, c.created_at, c.updated_at, u.name AS owner_name, u.email AS owner_email
       FROM cases c JOIN users u ON u.id = c.user_id ORDER BY c.updated_at DESC LIMIT 1000`,
    ).all<CaseRow & { owner_name: string; owner_email: string }>(),
    c.env.DB.prepare('SELECT DISTINCT case_id, item_key FROM documents').all<{ case_id: string; item_key: string }>(),
  ]);
  const keys = new Map<string, Set<string>>();
  for (const d of docs.results) (keys.get(d.case_id) ?? keys.set(d.case_id, new Set()).get(d.case_id)!).add(d.item_key);
  return c.json({
    cases: rows.results.map((r) => {
      const s2a = parse<Stage2Answers>(r.s2_answers);
      const ai = parse<{ suggestion: string; flags: string[]; mismatches: string[] }>(r.ai_review);
      return {
        id: r.id,
        kind: r.kind,
        company_name: r.company_name,
        location: r.location,
        industry: r.industry,
        stage: r.stage,
        status: r.status,
        owner_name: r.owner_name,
        owner_email: r.owner_email,
        s1_rating: parse<Stage1Result>(r.s1_result)?.rating ?? null,
        s2_rating: parse<Stage2Result>(r.s2_result)?.rating ?? null,
        // Headline number for the catalog: asking price for a business, funds to invest for a candidate.
        headline_usd: s2a ? ((r.kind === 'us' ? s2a.price : s2a.invest_usd) as number) ?? null : null,
        docs: docProgress(r.kind, r.stage, keys.get(r.id) ?? new Set()),
        ai_suggestion: ai?.suggestion ?? null,
        ai_flags: ai ? ai.flags.length + ai.mismatches.length : 0,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    }),
  });
});

app.get('/cases/:id', async (c) => {
  const row = await loadCase(c, c.req.param('id'));
  if (c.get('user')!.role === 'staff') await audit(c, 'case.viewed', row.id);
  return c.json({ case: await caseView(c, row) });
});

/* ---------- AI first pass ---------- */

async function runReview(env: Env, caseId: string): Promise<void> {
  const row = await env.DB.prepare('SELECT * FROM cases WHERE id = ?').bind(caseId).first<CaseRow>();
  if (!row || !env.AI) return;
  await env.DB.prepare("UPDATE cases SET ai_review_status = 'running' WHERE id = ?").bind(caseId).run();
  try {
    const docs = await env.DB.prepare('SELECT item_key, ai_status, ai_result, review FROM documents WHERE case_id = ?')
      .bind(caseId)
      .all<{ item_key: string; ai_status: string; ai_result: string | null; review: string }>();
    const have = new Set(docs.results.map((d) => d.item_key));
    const s1 = parse<Stage1Result>(row.s1_result);
    const s2 = parse<Stage2Result>(row.s2_result);
    const s4 = parse<Stage4Answers>(row.s4_answers);
    const facts = {
      kind: row.kind,
      current_stage: row.stage,
      name: row.company_name,
      location: row.location,
      industry: row.industry,
      l1_screen: s1 && { rating: s1.rating, answers: s1.findings.map((f) => ({ question: f.topic.en, answer: f.label.en, level: f.level })) },
      numbers_entered_by_owner: parse(row.s2_answers),
      health: s2 && { rating: s2.rating, metrics: s2.metrics.map((m) => ({ metric: m.label.en, value: m.value, grade: m.grade })) },
      owners: s4?.owners,
      disclosures: s4 && DISCLOSURES.map((d) => ({ question: d.label.en, answer: s4.disclosures[d.id] })),
      documents_missing:
        row.stage >= 3
          ? docsFor(row.kind, row.stage)
              .filter((d) => !d.optional && !have.has(d.key))
              .map((d) => d.label.en)
          : [],
      documents: docs.results.map((d) => {
        const ai = parse<{ summary: string; concerns: string[]; matches_request: string; key_facts: unknown; period: string }>(d.ai_result);
        return {
          requested: docLabel(d.item_key),
          team_review: d.review,
          ...(ai ? { matches: ai.matches_request, period: ai.period, summary: ai.summary, key_facts: ai.key_facts, concerns: ai.concerns } : { unread: true }),
        };
      }),
    };
    const review = { ...(await reviewCase(env, facts)), at: now(), stage: row.stage };
    await env.DB.prepare("UPDATE cases SET ai_review = ?, ai_review_status = 'done' WHERE id = ?").bind(JSON.stringify(review), caseId).run();
  } catch (err) {
    console.error('review failed', caseId, err);
    await env.DB.prepare("UPDATE cases SET ai_review_status = 'failed' WHERE id = ?").bind(caseId).run();
  }
}

/* ---------- Owner steps ---------- */

app.put('/cases/:id/stage1', async (c) => {
  const row = await loadCase(c, c.req.param('id'));
  // Answers are final once scored, so the gate cannot be retried until it passes. The team can override a stop.
  if (row.s1_result || row.stage > 2 || !open_(row)) throw new HttpError(409, 'stage_locked', 'This step can no longer be changed.');
  const { answers } = z.object({ answers: z.record(z.string(), z.string()) }).parse(await c.req.json());
  if (!stage1Complete(row.kind, answers)) throw new HttpError(400, 'incomplete');
  const result = scoreStage1(row.kind, answers as Stage1Answers);
  // A changed answer re-opens the gate, so the health result is cleared and re-scored on the next save.
  await c.env.DB.prepare('UPDATE cases SET s1_answers = ?, s1_result = ?, stage = ?, status = ?, s2_result = NULL, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(answers), JSON.stringify(result), result.passed ? 2 : 1, result.passed ? 'active' : 'stopped', now(), row.id)
    .run();
  await audit(c, 'stage1.submitted', row.id, { rating: result.rating });
  c.executionCtx.waitUntil(runReview(c.env, row.id));
  return c.json({ result });
});

app.put('/cases/:id/stage2', async (c) => {
  const row = await loadCase(c, c.req.param('id'));
  if (row.stage < 2 || row.stage > 3 || !open_(row)) throw new HttpError(409, 'stage_locked', 'This step is not open.');
  const body = z
    .object({
      company_name: z.string().trim().min(1).max(160),
      location: z.string().trim().min(2).max(120),
      industry: z.string().trim().min(2).max(120),
      answers: z.record(z.string(), z.union([z.number().finite().min(-1e13).max(1e13), z.string().max(40)])),
    })
    .parse(await c.req.json());
  if (!stage2Complete(row.kind, body.answers as Stage2Answers)) throw new HttpError(400, 'incomplete');
  const result = scoreStage2(row.kind, body.answers as Stage2Answers);
  const stage = result.passed ? Math.max(row.stage, 3) : 2;
  await c.env.DB.prepare(
    'UPDATE cases SET company_name = ?, location = ?, industry = ?, s2_answers = ?, s2_result = ?, stage = ?, status = ?, updated_at = ? WHERE id = ?',
  )
    .bind(body.company_name, body.location, body.industry, JSON.stringify(body.answers), JSON.stringify(result), stage, result.passed ? 'active' : 'stopped', now(), row.id)
    .run();
  await audit(c, 'stage2.submitted', row.id, { rating: result.rating });
  c.executionCtx.waitUntil(runReview(c.env, row.id));
  return c.json({ result });
});

app.post('/cases/:id/sign', async (c) => {
  const u = requireUser(c);
  const row = await loadCase(c, c.req.param('id'));
  if (row.user_id !== u.id) throw new HttpError(403, 'forbidden', 'Only the account owner can sign.');
  const body = z.object({ name: Name, lang: LangZ, agree: z.literal(true) }).parse(await c.req.json());
  if (row.stage < 3) throw new HttpError(409, 'stage_locked');
  const text = ndaText(c.env.LEGAL_ENTITY)[body.lang];
  const res = await c.env.DB.prepare(
    `INSERT INTO signatures (id, case_id, user_id, kind, version, lang, text_sha256, signer_name, signer_email, ip, user_agent, signed_at)
     VALUES (?, ?, ?, 'nda', ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(case_id, kind) DO NOTHING`,
  )
    .bind(randomToken(16), row.id, u.id, NDA_VERSION, body.lang, await sha256Hex(text), body.name, u.email, c.get('ip'), (c.req.header('User-Agent') ?? '').slice(0, 300), now())
    .run();
  if (res.meta.changes === 0) throw new HttpError(409, 'already_signed');
  await audit(c, 'signed.nda', row.id, { version: NDA_VERSION, name: body.name });
  return c.json({ ok: true });
});

const FOLDER_HOSTS = ['drive.google.com', 'docs.google.com', 'dropbox.com', 'onedrive.live.com', '1drv.ms', 'sharepoint.com', 'box.com'];

app.put('/cases/:id/folder', async (c) => {
  const row = await loadCase(c, c.req.param('id'));
  if (row.stage < 3) throw new HttpError(409, 'stage_locked');
  const { url } = z.object({ url: z.string().trim().max(500) }).parse(await c.req.json());
  let value: string | null = null;
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpError(400, 'bad_url', 'Paste a full link starting with https://');
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (parsed.protocol !== 'https:' || !FOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      throw new HttpError(400, 'bad_url', 'Use a Google Drive, Dropbox, OneDrive, SharePoint or Box link.');
    }
    value = parsed.toString();
  }
  await c.env.DB.prepare('UPDATE cases SET folder_url = ?, updated_at = ? WHERE id = ?').bind(value, now(), row.id).run();
  await audit(c, 'folder.linked', row.id, { linked: !!value });
  return c.json({ ok: true });
});

app.put('/cases/:id/stage4', async (c) => {
  const row = await loadCase(c, c.req.param('id'));
  if (row.stage !== 4 || row.status !== 'active') throw new HttpError(409, 'stage_locked', 'This step is not open.');
  const body = z
    .object({
      owners: z
        .array(z.object({ name: z.string().trim().min(2).max(120), pct: z.number().finite().gt(0).max(100), role: z.string().trim().max(80).default('') }))
        .min(1)
        .max(20),
      disclosures: z.record(z.string(), z.enum(['yes', 'no'])),
    })
    .parse(await c.req.json());
  if (!stage4Complete(body)) throw new HttpError(400, 'incomplete', 'List every owner, with shares adding up to 100% at most, and answer each question.');
  await c.env.DB.prepare('UPDATE cases SET s4_answers = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(body), now(), row.id).run();
  await audit(c, 'stage4.saved', row.id, { owners: body.owners.length });
  return c.json({ ok: true });
});

/** The owner hands the current document stage to the team. */
app.post('/cases/:id/submit', async (c) => {
  const row = await loadCase(c, c.req.param('id'));
  if (row.stage < 3 || row.status !== 'active') throw new HttpError(409, 'stage_locked', 'There is nothing to submit right now.');
  const signed = await c.env.DB.prepare("SELECT 1 AS x FROM signatures WHERE case_id = ? AND kind = 'nda'").bind(row.id).first();
  if (!signed) throw new HttpError(409, 'nda_required', 'Sign the confidentiality agreement first.');
  if (row.stage === 4 && !stage4Complete(parse<Stage4Answers>(row.s4_answers))) {
    throw new HttpError(400, 'incomplete', 'Save the owners and the disclosure answers first.');
  }
  const docs = await c.env.DB.prepare('SELECT DISTINCT item_key FROM documents WHERE case_id = ?').bind(row.id).all<{ item_key: string }>();
  const have = new Set(docs.results.map((d) => d.item_key));
  const missing = docsFor(row.kind, row.stage).filter((d) => d.stage === row.stage && !d.optional && !have.has(d.key));
  // A shared folder can stand in for uploads: the team files documents from it.
  if (missing.length > 0 && !row.folder_url) {
    throw new HttpError(400, 'docs_missing', `Still needed: ${missing.map((d) => d.label.en).join('; ')}. Upload them or link a shared folder.`);
  }
  await c.env.DB.prepare("UPDATE cases SET status = 'review', team_note = NULL, updated_at = ? WHERE id = ?").bind(now(), row.id).run();
  await audit(c, 'stage.submitted', row.id, { stage: row.stage, missing: missing.length });
  c.executionCtx.waitUntil(runReview(c.env, row.id));
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

type DocRow = { id: string; case_id: string; item_key: string; filename: string; mime: string; size: number; storage_key: string; review: string };

async function loadDoc(c: Context<AppEnv>, id: string): Promise<{ doc: DocRow; row: CaseRow }> {
  const doc = await c.env.DB.prepare('SELECT id, case_id, item_key, filename, mime, size, storage_key, review FROM documents WHERE id = ?')
    .bind(id)
    .first<DocRow>();
  if (!doc) throw new HttpError(404, 'not_found');
  return { doc, row: await loadCase(c, doc.case_id) };
}

async function runAnalysis(env: Env, docId: string): Promise<void> {
  const doc = await env.DB.prepare('SELECT id, item_key, filename, mime, storage_key FROM documents WHERE id = ?').bind(docId).first<DocRow>();
  if (!doc) return;
  if (!env.AI) {
    await env.DB.prepare("UPDATE documents SET ai_status = 'skipped' WHERE id = ?").bind(docId).run();
    return;
  }
  await env.DB.prepare("UPDATE documents SET ai_status = 'running' WHERE id = ?").bind(docId).run();
  try {
    const data = await getFile(env, doc.storage_key);
    if (!data) throw new Error('file missing');
    const result = await analyzeDocument(env, { requested: docLabel(doc.item_key), filename: doc.filename, mime: doc.mime, data });
    await env.DB.prepare("UPDATE documents SET ai_status = 'done', ai_result = ? WHERE id = ?").bind(JSON.stringify(result), docId).run();
  } catch (err) {
    console.error('analysis failed', docId, err);
    await env.DB.prepare("UPDATE documents SET ai_status = 'failed' WHERE id = ?").bind(docId).run();
  }
}

app.post('/cases/:id/documents', async (c) => {
  const u = requireUser(c);
  const row = await loadCase(c, c.req.param('id'));
  if (row.stage < 3) throw new HttpError(409, 'stage_locked', 'Documents open after the business health step.');
  if (row.status === 'approved' || row.status === 'declined') throw new HttpError(409, 'case_closed', 'This evaluation is closed.');
  const signed = await c.env.DB.prepare("SELECT 1 AS x FROM signatures WHERE case_id = ? AND kind = 'nda'").bind(row.id).first();
  if (!signed) throw new HttpError(409, 'nda_required', 'Sign the confidentiality agreement first.');
  await rateLimit(c.env, `upload:${u.id}`, 120, 3600);

  if (Number(c.req.header('Content-Length') ?? 0) > MAX_FILE_BYTES + 64 * 1024) throw new HttpError(413, 'too_large', 'Files can be up to 15 MB.');
  const form = await c.req.parseBody();
  const file = form.file;
  const itemKey = String(form.item_key ?? '');
  if (!(file instanceof File)) throw new HttpError(400, 'no_file');
  const item = docsFor(row.kind, row.stage).find((d) => d.key === itemKey);
  if (!item) throw new HttpError(400, 'bad_item', 'That document is not part of the current step.');
  if (file.size === 0) throw new HttpError(400, 'empty_file', 'That file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, 'too_large', 'Files can be up to 15 MB.');
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM documents WHERE case_id = ?').bind(row.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_FILES_PER_CASE) throw new HttpError(409, 'too_many_files');

  const data = new Uint8Array(await file.arrayBuffer());
  const filename = cleanFilename(file.name);
  const mime = sniff(filename, data);
  if (!mime) throw new HttpError(415, 'bad_type', 'Upload a PDF, image, Word, Excel, CSV, XML or OFX file.');

  const id = randomToken(16);
  const storageKey = `${row.id}/${id}`;
  await putFile(c.env, storageKey, data);
  await c.env.DB.prepare(
    'INSERT INTO documents (id, case_id, item_key, filename, mime, size, sha256, storage_key, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, row.id, itemKey, filename, mime, data.length, await sha256Hex(data), storageKey, u.id, now())
    .run();
  await c.env.DB.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').bind(now(), row.id).run();
  await audit(c, 'document.uploaded', row.id, { id, item: itemKey, filename, size: data.length });
  c.executionCtx.waitUntil(runAnalysis(c.env, id));
  return c.json({ id });
});

app.get('/documents/:id/file', async (c) => {
  const { doc, row } = await loadDoc(c, c.req.param('id'));
  const data = await getFile(c.env, doc.storage_key);
  if (!data) throw new HttpError(404, 'not_found');
  await audit(c, 'document.downloaded', row.id, { id: doc.id });
  // Always a download, never rendered inline on our origin.
  return new Response(data, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});

app.delete('/documents/:id', async (c) => {
  const u = requireUser(c);
  const { doc, row } = await loadDoc(c, c.req.param('id'));
  if (u.role !== 'staff' && (doc.review !== 'received' || row.status !== 'active')) {
    throw new HttpError(409, 'locked', 'This document is under review and can no longer be removed.');
  }
  await deleteFile(c.env, doc.storage_key);
  await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(doc.id).run();
  await audit(c, 'document.deleted', row.id, { id: doc.id, filename: doc.filename });
  return c.json({ ok: true });
});

app.post('/documents/:id/analyze', async (c) => {
  requireStaff(c);
  const { doc } = await loadDoc(c, c.req.param('id'));
  await rateLimit(c.env, `analyze:${c.get('user')!.id}`, 200, 3600);
  c.executionCtx.waitUntil(runAnalysis(c.env, doc.id));
  return c.json({ ok: true });
});

app.put('/documents/:id/review', async (c) => {
  requireStaff(c);
  const { doc, row } = await loadDoc(c, c.req.param('id'));
  const body = z.object({ review: z.enum(['received', 'accepted', 'rejected']), note: z.string().trim().max(500).default('') }).parse(await c.req.json());
  await c.env.DB.prepare('UPDATE documents SET review = ?, review_note = ? WHERE id = ?').bind(body.review, body.note || null, doc.id).run();
  await audit(c, 'document.reviewed', row.id, { id: doc.id, review: body.review });
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Team actions                                                        */
/* ------------------------------------------------------------------ */

/**
 * One endpoint for every gate decision:
 *   approve  pass the current gate. At the last stage this approves the record into the catalog.
 *            On a stopped record it overrides the failed gate, so a note is required.
 *   return   send it back to the owner with a note.
 *   decline  close it with a note.
 *   reopen   put a closed record back in progress.
 */
app.post('/cases/:id/decide', async (c) => {
  const u = requireStaff(c);
  const row = await loadCase(c, c.req.param('id'));
  const body = z.object({ action: z.enum(['approve', 'return', 'decline', 'reopen']), note: z.string().trim().max(1000).default('') }).parse(await c.req.json());
  const closed = row.status === 'approved' || row.status === 'declined';

  let stage = row.stage;
  let status: Status = row.status;
  if (body.action === 'reopen') {
    if (!closed) throw new HttpError(409, 'not_closed');
    status = 'active';
  } else {
    if (closed) throw new HttpError(409, 'case_closed', 'Reopen this record first.');
    if (body.action !== 'approve' || row.status === 'stopped') {
      if (body.note.length < 5) throw new HttpError(400, 'note_required', 'Add a short note explaining the decision.');
    }
    if (body.action === 'approve') {
      // Stages 1 and 2 pass on their scores. The team only steps in to override a failed one.
      if (row.stage < 3 && row.status !== 'stopped') throw new HttpError(409, 'not_ready', 'This stage is scored automatically.');
      if (row.stage >= LAST_STAGE) status = 'approved';
      else {
        stage = row.stage + 1;
        status = 'active';
      }
    } else if (body.action === 'return') status = 'active';
    else status = 'declined';
  }

  const history = parse<unknown[]>(row.history) ?? [];
  history.push({ at: now(), by: u.email, action: body.action, stage: row.stage, from: row.status, note: body.note });
  // The owner sees the note when something is asked of them or the record is closed.
  const teamNote = body.action === 'return' || body.action === 'decline' ? body.note : null;
  await c.env.DB.prepare('UPDATE cases SET stage = ?, status = ?, team_note = ?, history = ?, updated_at = ? WHERE id = ?')
    .bind(stage, status, teamNote, JSON.stringify(history.slice(-100)), now(), row.id)
    .run();
  await audit(c, `gate.${body.action}`, row.id, { stage: row.stage, from: row.status, note: body.note });
  return c.json({ ok: true });
});

app.post('/cases/:id/ai-review', async (c) => {
  const u = requireStaff(c);
  const row = await loadCase(c, c.req.param('id'));
  if (!c.env.AI) throw new HttpError(503, 'ai_unavailable', 'AI is not available.');
  await rateLimit(c.env, `review:${u.id}`, 120, 3600);
  await runReview(c.env, row.id);
  const after = await c.env.DB.prepare('SELECT ai_review_status FROM cases WHERE id = ?').bind(row.id).first<{ ai_review_status: string }>();
  if (after?.ai_review_status !== 'done') throw new HttpError(503, 'ai_unavailable', 'The AI service did not respond. Try again.');
  await audit(c, 'ai.reviewed', row.id);
  return c.json({ ok: true });
});

app.get('/cases/:id/audit', async (c) => {
  requireStaff(c);
  const row = await loadCase(c, c.req.param('id'));
  const rows = await c.env.DB.prepare('SELECT at, actor_email, action, detail FROM audit_log WHERE case_id = ? ORDER BY id DESC LIMIT 200').bind(row.id).all();
  return c.json({ events: rows.results });
});

app.all('*', () => {
  throw new HttpError(404, 'not_found');
});

export default app;
