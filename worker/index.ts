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
import { mailReady, noticeEmail, scorecardEmail, sendMail } from './scorecard';
import {
  DISCLOSURES,
  LAST_STAGE,
  cleanStage2,
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
      `SELECT u.id, u.email, u.name, u.role, u.lang, u.totp_enabled, u.is_admin, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.disabled = 0`,
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

function requireAdmin(c: Context<AppEnv>): User {
  const u = requireStaff(c);
  if (!u.is_admin) throw new HttpError(403, 'forbidden');
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

/** Compares a stored answer set with a submitted one, whatever the key order. */
function sameAnswers(stored: string, given: Record<string, string>): boolean {
  const a = JSON.parse(stored) as Record<string, string>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(given).length && keys.every((k) => a[k] === given[k]);
}

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
  let history = '[]';
  if (body.s1_answers && stage1Complete(body.kind, body.s1_answers)) {
    const result = scoreStage1(body.kind, body.s1_answers);
    s1a = JSON.stringify(body.s1_answers);
    s1r = JSON.stringify(result);
    stage = result.passed ? 2 : 1;
    status = result.passed ? 'active' : 'stopped';
    if (!result.passed) {
      // A failed screen ends at the scorecard. An account opens only after the team clears that result.
      const lead = await c.env.DB.prepare('SELECT s1_answers, cleared_at, cleared_by, cleared_note FROM leads WHERE email = ? AND kind = ?')
        .bind(body.email, body.kind)
        .first<{ s1_answers: string; cleared_at: number | null; cleared_by: string | null; cleared_note: string | null }>();
      if (!lead?.cleared_at || !sameAnswers(lead.s1_answers, body.s1_answers)) {
        throw new HttpError(403, 'not_cleared', 'Our team needs to review this result before an account can be created.');
      }
      stage = 2;
      status = 'active';
      history = JSON.stringify([{ at: lead.cleared_at, by: lead.cleared_by ?? '', action: 'approve', stage: 1, from: 'stopped', note: lead.cleared_note ?? '' }]);
    }
  }

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, email, name, role, pw_hash, pw_salt, lang, created_at) VALUES (?, ?, ?, 'applicant', ?, ?, ?, ?)").bind(
      userId, body.email, body.name, hash, salt, body.lang, t,
    ),
    c.env.DB.prepare('INSERT INTO cases (id, user_id, kind, stage, status, s1_answers, s1_result, history, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      caseId, userId, body.kind, stage, status, s1a, s1r, history, t, t,
    ),
  ]);
  const user: User = { id: userId, email: body.email, name: body.name, role: 'applicant', lang: body.lang, totp_enabled: 0, is_admin: 0 };
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
     ON CONFLICT (email, kind) DO UPDATE SET name = excluded.name, lang = excluded.lang,
       cleared_at = CASE WHEN leads.s1_answers = excluded.s1_answers THEN leads.cleared_at ELSE NULL END,
       s1_answers = excluded.s1_answers, s1_rating = excluded.s1_rating, updated_at = excluded.updated_at
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
  const row = await c.env.DB.prepare('SELECT kind, name, email, s1_answers, cleared_at FROM leads WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ kind: Kind; name: string; email: string; s1_answers: string; cleared_at: number | null }>();
  if (!row) throw new HttpError(404, 'not_found');
  return c.json({ kind: row.kind, name: row.name, email: row.email, answers: JSON.parse(row.s1_answers), cleared: !!row.cleared_at });
});

/** People who saw a result but have not created an account. */
app.get('/leads', async (c) => {
  requireStaff(c);
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.email, l.name, l.kind, l.lang, l.s1_rating, l.s1_answers, l.updated_at, l.scorecard_sent_at, l.cleared_at, l.cleared_by FROM leads l
     LEFT JOIN users u ON u.email = l.email WHERE u.id IS NULL ORDER BY l.updated_at DESC LIMIT 500`,
  ).all();
  return c.json({ leads: results.map((l) => ({ ...l, s1_answers: parse(l.s1_answers as string) })) });
});

/** The team opens the next step for a lead whose L-1 screen failed, and the lead is told by email. */
app.post('/leads/:id/clear', async (c) => {
  const u = requireStaff(c);
  const { note } = z.object({ note: z.string().trim().min(5).max(1000) }).parse(await c.req.json());
  const lead = await c.env.DB.prepare('SELECT id, email, name, kind, lang, s1_rating, cleared_at FROM leads WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ id: string; email: string; name: string; kind: Kind; lang: 'en' | 'pt'; s1_rating: string; cleared_at: number | null }>();
  if (!lead) throw new HttpError(404, 'not_found');
  if (lead.s1_rating !== 'not_compliant' || lead.cleared_at) throw new HttpError(409, 'not_needed', 'This result does not need to be cleared.');
  await c.env.DB.prepare('UPDATE leads SET cleared_at = ?, cleared_by = ?, cleared_note = ? WHERE id = ?').bind(now(), u.email, note, lead.id).run();
  await audit(c, 'lead.cleared', null, { lead: lead.email, kind: lead.kind, note });
  const link = `${new URL(c.req.url).origin}/resume/${lead.id}`;
  const en = lead.lang === 'en';
  const first = lead.name.trim().split(/\s+/)[0] ?? '';
  const emailed = await sendMail(c.env, {
    to: lead.email,
    ...noticeEmail({
      subject: en ? 'Your 10x BR evaluation can continue' : 'Sua avaliação na 10x BR pode continuar',
      greeting: en ? `Hi ${first},` : `Olá, ${first},`,
      lines: en
        ? ['Our team reviewed your L-1 scorecard and opened the next step for you.', 'It takes about five minutes: a few numbers about the business.']
        : ['Nossa equipe revisou o seu scorecard L-1 e liberou a próxima etapa para você.', 'Leva cerca de cinco minutos: alguns números sobre o negócio.'],
      cta: en ? 'Continue the evaluation' : 'Continuar a avaliação',
      link,
      footer: en ? '10x BR is a screening tool, not legal or investment advice.' : 'A 10x BR é uma ferramenta de triagem, não aconselhamento jurídico ou de investimento.',
    }),
  });
  return c.json({ ok: true, emailed, link });
});

app.delete('/leads/:id', async (c) => {
  requireAdmin(c);
  const lead = await c.env.DB.prepare('DELETE FROM leads WHERE id = ? RETURNING email, kind').bind(c.req.param('id')).first<{ email: string; kind: string }>();
  if (!lead) throw new HttpError(404, 'not_found');
  await audit(c, 'lead.deleted', null, { lead: lead.email, kind: lead.kind });
  return c.json({ ok: true });
});

app.post('/auth/login', async (c) => {
  const body = z.object({ email: Email, password: z.string().max(200), code: z.string().max(12).optional() }).parse(await c.req.json());
  await rateLimit(c.env, `login:${c.get('ip')}`, 20, 900);
  await rateLimit(c.env, `login:${body.email}`, 8, 900);

  const row = await c.env.DB.prepare('SELECT id, email, name, role, lang, totp_enabled, is_admin, disabled, totp_secret, pw_hash, pw_salt FROM users WHERE email = ?')
    .bind(body.email)
    .first<User & { disabled: number; totp_secret: string | null; pw_hash: string; pw_salt: string }>();
  // Hash even when the user is unknown so timing does not reveal which emails exist.
  const { hash } = await hashPassword(body.password, row?.pw_salt ?? 'AAAAAAAAAAAAAAAAAAAAAA==');
  if (!row || row.disabled || !(await safeEqual(hash, row.pw_hash))) {
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
  const user: User = { id: row.id, email: row.email, name: row.name, role: row.role, lang: row.lang, totp_enabled: row.totp_enabled, is_admin: row.is_admin };
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
  await c.env.DB.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').bind(id).run();
  const user: User = { id, email: body.email, name: body.name, role: 'staff', lang: 'en', totp_enabled: 0, is_admin: 1 };
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
  const answers = cleanStage2(row.kind, body.answers as Stage2Answers);
  // The periods asked depend on the month the form was filled in, so that month must be the current one.
  const [y, m] = String(answers.as_of ?? '').split('-').map(Number);
  const today = new Date();
  if (Math.abs((today.getUTCFullYear() - y) * 12 + (today.getUTCMonth() + 1 - m)) > 1) throw new HttpError(400, 'stale', 'Reload the page and try again.');
  if (!stage2Complete(row.kind, answers)) throw new HttpError(400, 'incomplete');
  const result = scoreStage2(row.kind, answers);
  const stage = result.passed ? Math.max(row.stage, 3) : 2;
  await c.env.DB.prepare(
    'UPDATE cases SET company_name = ?, location = ?, industry = ?, s2_answers = ?, s2_result = ?, stage = ?, status = ?, updated_at = ? WHERE id = ?',
  )
    .bind(body.company_name, body.location, body.industry, JSON.stringify(answers), JSON.stringify(result), stage, result.passed ? 'active' : 'stopped', now(), row.id)
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

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

const INVITE_MS = 7 * 24 * 3600 * 1000;

app.get('/admin/overview', async (c) => {
  requireAdmin(c);
  const weekAgo = now() - 7 * 24 * 3600 * 1000;
  const [leads, cases, users] = await Promise.all([
    c.env.DB.prepare('SELECT kind, s1_rating, COUNT(*) AS n, SUM(created_at >= ?1) AS recent FROM leads GROUP BY kind, s1_rating').bind(weekAgo).all<{
      kind: Kind;
      s1_rating: string;
      n: number;
      recent: number;
    }>(),
    c.env.DB.prepare('SELECT kind, stage, status, COUNT(*) AS n, SUM(created_at >= ?1) AS recent FROM cases GROUP BY kind, stage, status').bind(weekAgo).all<{
      kind: Kind;
      stage: number;
      status: Status;
      n: number;
      recent: number;
    }>(),
    c.env.DB.prepare('SELECT role, COUNT(*) AS n FROM users WHERE disabled = 0 GROUP BY role').all<{ role: string; n: number }>(),
  ]);
  const track = (kind: Kind) => {
    const l = leads.results.filter((r) => r.kind === kind);
    const k = cases.results.filter((r) => r.kind === kind);
    const sum = <T extends { n: number }>(rows: T[], keep: (r: T) => boolean = () => true) => rows.filter(keep).reduce((n, r) => n + r.n, 0);
    return {
      answered: sum(l),
      answered_week: l.reduce((n, r) => n + (r.recent ?? 0), 0),
      l1: { compliant: sum(l, (r) => r.s1_rating === 'compliant'), gaps: sum(l, (r) => r.s1_rating === 'gaps'), not_compliant: sum(l, (r) => r.s1_rating === 'not_compliant') },
      accounts: sum(k),
      accounts_week: k.reduce((n, r) => n + (r.recent ?? 0), 0),
      health: sum(k, (r) => r.stage >= 3),
      documents: sum(k, (r) => r.stage >= 4),
      catalog: sum(k, (r) => r.status === 'approved'),
      waiting: sum(k, (r) => r.status === 'review'),
      stopped: sum(k, (r) => r.status === 'stopped'),
      declined: sum(k, (r) => r.status === 'declined'),
    };
  };
  const count = (role: string) => users.results.find((r) => r.role === role)?.n ?? 0;
  return c.json({ us: track('us'), br: track('br'), team: count('staff'), owners: count('applicant'), mail: mailReady(c.env), ai: !!c.env.AI });
});

app.get('/admin/users', async (c) => {
  requireAdmin(c);
  const [users, invites] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.is_admin, u.disabled, u.totp_enabled, u.created_at,
              (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen,
              k.id AS case_id, k.kind, k.stage, k.status, k.company_name
       FROM users u LEFT JOIN cases k ON k.user_id = u.id ORDER BY u.created_at DESC LIMIT 2000`,
    ).all(),
    c.env.DB.prepare('SELECT id, email, is_admin, created_by, created_at, expires_at FROM invites WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC').bind(now()).all(),
  ]);
  return c.json({ users: users.results, invites: invites.results });
});

app.post('/admin/invites', async (c) => {
  const u = requireAdmin(c);
  const body = z.object({ email: Email, is_admin: z.boolean().default(false) }).parse(await c.req.json());
  if (await c.env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(body.email).first()) {
    throw new HttpError(409, 'email_taken', 'An account with this email already exists.');
  }
  const token = randomToken(32);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM invites WHERE email = ? AND used_at IS NULL').bind(body.email),
    c.env.DB.prepare('INSERT INTO invites (id, token_hash, email, is_admin, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      randomToken(12), await sha256Hex(token), body.email, body.is_admin ? 1 : 0, u.email, now(), now() + INVITE_MS,
    ),
  ]);
  await audit(c, 'team.invited', null, { email: body.email, admin: body.is_admin });
  const link = `${new URL(c.req.url).origin}/join/${token}`;
  const emailed = await sendMail(c.env, {
    to: body.email,
    ...noticeEmail({
      subject: 'You are invited to the 10x BR team',
      greeting: 'Hello,',
      lines: [`${u.name} invited you to review evaluations on 10x BR.`, 'The link works once and expires in seven days.'],
      cta: 'Create your team account',
      link,
      footer: 'If you were not expecting this, ignore this email.',
    }),
  });
  // The link is shown once so it can be passed on by hand when mail is not set up.
  return c.json({ link, emailed });
});

app.delete('/admin/invites/:id', async (c) => {
  requireAdmin(c);
  const row = await c.env.DB.prepare('DELETE FROM invites WHERE id = ? RETURNING email').bind(c.req.param('id')).first<{ email: string }>();
  if (!row) throw new HttpError(404, 'not_found');
  await audit(c, 'team.invite_revoked', null, { email: row.email });
  return c.json({ ok: true });
});

app.put('/admin/users/:id', async (c) => {
  const u = requireAdmin(c);
  const body = z.object({ disabled: z.boolean().optional(), is_admin: z.boolean().optional(), reset_totp: z.literal(true).optional() }).parse(await c.req.json());
  const target = await c.env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?').bind(c.req.param('id')).first<{ id: string; email: string; role: string }>();
  if (!target) throw new HttpError(404, 'not_found');
  // Nobody changes their own access, so the team can never be left without an admin.
  if (target.id === u.id) throw new HttpError(409, 'self', 'Ask another admin to change your own access.');
  if (body.is_admin !== undefined && target.role !== 'staff') throw new HttpError(409, 'not_team');

  const stmts: D1PreparedStatement[] = [];
  if (body.disabled !== undefined) {
    stmts.push(c.env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(body.disabled ? 1 : 0, target.id));
    if (body.disabled) stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id));
  }
  if (body.is_admin !== undefined) stmts.push(c.env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(body.is_admin ? 1 : 0, target.id));
  if (body.reset_totp) {
    stmts.push(c.env.DB.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').bind(target.id));
    stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id));
  }
  if (!stmts.length) throw new HttpError(400, 'nothing_to_do');
  await c.env.DB.batch(stmts);
  await audit(c, 'user.updated', null, { user: target.email, ...body });
  return c.json({ ok: true });
});

app.get('/admin/audit', async (c) => {
  requireAdmin(c);
  const before = Number(c.req.query('before')) || Number.MAX_SAFE_INTEGER;
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.at, a.actor_email, a.action, a.case_id, a.detail, a.ip, k.company_name
     FROM audit_log a LEFT JOIN cases k ON k.id = a.case_id WHERE a.id < ? ORDER BY a.id DESC LIMIT 100`,
  )
    .bind(before)
    .all();
  return c.json({ events: results });
});

/** Spreadsheets treat a leading = + - @ as a formula, so those cells are prefixed with a quote. */
const csvCell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (head: string[], rows: unknown[][]) => [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
const isoDate = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');

app.get('/admin/export/:what', async (c) => {
  requireAdmin(c);
  const what = c.req.param('what');
  let csv: string;
  if (what === 'leads') {
    const { results } = await c.env.DB.prepare(
      `SELECT l.name, l.email, l.kind, l.lang, l.s1_rating, l.created_at, l.updated_at, l.scorecard_sent_at, l.cleared_at, u.id AS user_id
       FROM leads l LEFT JOIN users u ON u.email = l.email ORDER BY l.updated_at DESC`,
    ).all<Record<string, string | number | null>>();
    csv = toCsv(
      ['name', 'email', 'track', 'language', 'l1_result', 'first_seen', 'last_update', 'scorecard_emailed', 'cleared_by_team', 'has_account'],
      results.map((r) => [r.name, r.email, r.kind, r.lang, r.s1_rating, isoDate(r.created_at as number), isoDate(r.updated_at as number), r.scorecard_sent_at ? 'yes' : 'no', r.cleared_at ? 'yes' : 'no', r.user_id ? 'yes' : 'no']),
    );
  } else if (what === 'records') {
    const { results } = await c.env.DB.prepare(
      `SELECT k.kind, k.company_name, k.industry, k.location, k.stage, k.status, k.s1_result, k.s2_result, k.s2_answers, k.created_at, k.updated_at, u.name, u.email
       FROM cases k JOIN users u ON u.id = k.user_id ORDER BY k.updated_at DESC`,
    ).all<Record<string, string | number | null>>();
    csv = toCsv(
      ['track', 'company', 'industry', 'location', 'owner', 'email', 'stage', 'status', 'l1_result', 'health_result', 'price_or_funds_usd', 'created', 'updated'],
      results.map((r) => {
        const s2a = parse<Stage2Answers>(r.s2_answers as string | null);
        return [
          r.kind, r.company_name, r.industry, r.location, r.name, r.email, r.stage, r.status,
          parse<Stage1Result>(r.s1_result as string | null)?.rating ?? '',
          parse<Stage2Result>(r.s2_result as string | null)?.rating ?? '',
          s2a ? (r.kind === 'us' ? s2a.price : s2a.invest_usd) ?? '' : '',
          isoDate(r.created_at as number), isoDate(r.updated_at as number),
        ];
      }),
    );
  } else throw new HttpError(404, 'not_found');
  await audit(c, 'export.downloaded', null, { what });
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="10xbr-${what}-${isoDate(now())}.csv"` },
  });
});

/** Shows who a team invite is for. The token is unguessable and single-use. */
app.get('/invites/:token', async (c) => {
  await rateLimit(c.env, `invite:${c.get('ip')}`, 30, 3600);
  const row = await c.env.DB.prepare('SELECT email FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(await sha256Hex(c.req.param('token')), now())
    .first<{ email: string }>();
  if (!row) throw new HttpError(404, 'not_found');
  return c.json({ email: row.email });
});

app.post('/auth/join', async (c) => {
  await rateLimit(c.env, `invite:${c.get('ip')}`, 30, 3600);
  const body = z.object({ token: z.string().min(10).max(200), name: Name, password: Password }).parse(await c.req.json());
  // Claiming the invite in one statement means two requests cannot both use it.
  const invite = await c.env.DB.prepare('UPDATE invites SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL AND expires_at > ?1 RETURNING email, is_admin')
    .bind(now(), await sha256Hex(body.token))
    .first<{ email: string; is_admin: number }>();
  if (!invite) throw new HttpError(404, 'not_found', 'This invitation is no longer valid. Ask for a new one.');
  if (await c.env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(invite.email).first()) throw new HttpError(409, 'email_taken');
  const { hash, salt } = await hashPassword(body.password);
  const id = randomToken(16);
  await c.env.DB.prepare("INSERT INTO users (id, email, name, role, is_admin, pw_hash, pw_salt, lang, created_at) VALUES (?, ?, ?, 'staff', ?, ?, ?, 'en', ?)")
    .bind(id, invite.email, body.name, invite.is_admin, hash, salt, now())
    .run();
  const user: User = { id, email: invite.email, name: body.name, role: 'staff', lang: 'en', totp_enabled: 0, is_admin: invite.is_admin };
  await startSession(c, user);
  await audit(c, 'team.joined', null, null, user);
  return c.json({ user });
});

app.all('*', () => {
  throw new HttpError(404, 'not_found');
});

export default app;
