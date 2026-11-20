import { Check, Copy, Download, MailPlus, Search, Trash2, UserCheck, UserX } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LAST_STAGE, STAGE1_RATING, STATUS, scoreStage1, stage1Complete, type Kind, type L, type Level, type Status } from '../../shared/process';
import { api, type Lead, type User } from '../api';
import { useSession } from '../session';
import { Stage1ResultView } from '../stage1';
import { Questionnaires } from './Forms';
import { Users } from './Users';
import { Chip, CopyButton, Field, Nav, PageLoader, PasswordInput, fmtDate, s1Tone, statusTone, useAction } from '../ui';

/* ------------------------------------------------------------------ */
/* Leads: people who answered the questions and have no account        */
/* ------------------------------------------------------------------ */

/** The questions as asked and the answer the person chose, in the order of the form. */
function LeadResponses({ lead }: { lead: Lead }) {
  const { t, tl, forms } = useSession();
  const questions = forms.s1[lead.kind];
  const findings = new Map((lead.s1_result?.findings ?? []).map((f) => [f.id, f]));
  const status: Record<Level, string> = { pass: t('Met', 'Atendido'), caution: t('Needs attention', 'Requer atenção'), fail: t('Not met', 'Não atendido') };
  const tone: Record<Level, 'good' | 'warn' | 'bad'> = { pass: 'good', caution: 'warn', fail: 'bad' };
  // Answers to questions that are no longer on the form come last, with what the saved scorecard kept of them.
  const onForm = new Set(questions.map((q) => q.id));
  const rows: { id: string; question: L | null; answer: L | null; raw: string; level: Level | null; old: boolean }[] = [
    ...questions
      .filter((q) => lead.s1_answers[q.id] !== undefined)
      .map((q) => {
        const opt = q.options.find((o) => o.value === lead.s1_answers[q.id]);
        const f = findings.get(q.id);
        return { id: q.id, question: q.label, answer: opt?.label ?? f?.label ?? null, raw: lead.s1_answers[q.id], level: f?.level ?? opt?.level ?? null, old: !opt };
      }),
    ...Object.keys(lead.s1_answers)
      .filter((id) => !onForm.has(id))
      .map((id) => {
        const f = findings.get(id);
        return { id, question: f?.topic ?? null, answer: f?.label ?? null, raw: lead.s1_answers[id], level: f?.level ?? null, old: true };
      }),
  ];
  return (
    <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      <h4>{t('Responses', 'Respostas')}</h4>
      <div className="responses">
        {rows.map((r, i) => (
          <div key={r.id} className="response-row">
            <span className="faint small">{i + 1}</span>
            <div>
              <div className="small muted">{r.question ? tl(r.question) : r.id}</div>
              <div style={{ fontWeight: 600 }}>{r.answer ? tl(r.answer) : r.raw}</div>
              {r.old && <div className="small faint">{t('From an earlier version of the questions.', 'De uma versão anterior das perguntas.')}</div>}
            </div>
            {r.level && <Chip tone={tone[r.level]}>{status[r.level]}</Chip>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadDetail({ lead, reload }: { lead: Lead; reload: () => Promise<void> }) {
  const { t, user, forms } = useSession();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<{ emailed: boolean; link: string } | null>(null);
  const { busy, error, run } = useAction();
  // The scorecard as the person saw it. Leads from before scorecards were kept are re-scored when the questions still match.
  const result = lead.s1_result ?? (stage1Complete(lead.kind, lead.s1_answers, forms) ? scoreStage1(lead.kind, lead.s1_answers, forms) : null);
  const link = `${location.origin}/resume/${lead.id}`;

  return (
    <div className="stack" style={{ '--gap': '18px', padding: '6px 0 10px' } as React.CSSProperties}>
      <LeadResponses lead={lead} />
      {result ? (
        <Stage1ResultView kind={lead.kind} result={result} />
      ) : (
        <p className="muted small">{t('These answers are from an earlier version of the questions and cannot be scored.', 'Estas respostas são de uma versão anterior das perguntas e não podem ser pontuadas.')}</p>
      )}

      {lead.cleared_at ? (
        <div className="banner good">
          {t('Next step opened by', 'Próxima etapa liberada por')} {lead.cleared_by} · {fmtDate(lead.cleared_at, 'en')}.{' '}
          {t('They can continue from their link.', 'A pessoa pode continuar pelo link.')}
        </div>
      ) : lead.s1_rating === 'not_compliant' && !lead.user_id ? (
        <div className="glass pad-sm stack">
          <strong>{t('Open the next step anyway', 'Liberar a próxima etapa mesmo assim')}</strong>
          <p className="small muted">
            {t(
              'This result did not pass, so an account would start stopped at this step. If you see a way forward, open the next step and they are emailed a link.',
              'Este resultado não passou, então uma conta começaria parada nesta etapa. Se houver um caminho, libere a próxima etapa e a pessoa recebe um link por e-mail.',
            )}
          </p>
          <textarea className="textarea" rows={2} maxLength={1000} placeholder={t('Why? Kept in the record.', 'Por quê? Fica no registro.')} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <div>
            <button
              className="btn primary sm"
              disabled={busy || note.trim().length < 5}
              onClick={() =>
                run(async () => {
                  setSent(await api.post<{ emailed: boolean; link: string }>(`/leads/${lead.id}/clear`, { note }));
                  await reload();
                })
              }
            >
              {t('Open next step', 'Liberar próxima etapa')}
            </button>
          </div>
        </div>
      ) : null}
      {sent && !sent.emailed && <p className="small muted">{t('Email is not set up, so send them the link yourself.', 'O e-mail não está configurado; envie o link você mesmo.')}</p>}

      <div className="row wrapping">
        {lead.user_id && !!user?.is_admin && (
          <Link className="btn sm" to={`/admin/users/${lead.user_id}`}>
            {t('Open their account', 'Abrir a conta')}
          </Link>
        )}
        <CopyButton text={link} label={t('Copy their link', 'Copiar o link')} />
        <a className="btn sm" href={`mailto:${lead.email}`}>
          {t('Email', 'E-mail')}
        </a>
        {!!user?.is_admin && (
          <button
            className="btn ghost sm danger"
            disabled={busy}
            onClick={() => {
              if (confirm(t(`Delete ${lead.email}? This cannot be undone.`, `Excluir ${lead.email}? Não pode ser desfeito.`))) run(async () => { await api.del(`/leads/${lead.id}`); await reload(); });
            }}
          >
            <Trash2 size={14} /> {t('Delete', 'Excluir')}
          </button>
        )}
      </div>
    </div>
  );
}

export function LeadsTable({ leads, reload }: { leads: Lead[]; reload: () => Promise<void> }) {
  const { t, tl, lang } = useSession();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <table className="list cards">
      <thead>
        <tr>
          <th>{t('Name', 'Nome')}</th>
          <th>Email</th>
          <th>{t('Track', 'Trilha')}</th>
          <th>L-1</th>
          <th>{t('Scorecard', 'Scorecard')}</th>
          <th>{t('Date', 'Data')}</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((l) => (
          <Fragment key={l.id}>
            <tr onClick={() => setOpenId(openId === l.id ? null : l.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(openId === l.id ? null : l.id)} aria-expanded={openId === l.id}>
              <td style={{ fontWeight: 600 }}>{l.name}</td>
              <td className="small">{l.email}</td>
              <td className="small">{l.kind === 'us' ? t('U.S. business', 'Negócio nos EUA') : t('Candidate', 'Candidato')}</td>
              <td>
                <Chip tone={s1Tone[l.s1_rating]}>{tl(STAGE1_RATING[l.s1_rating])}</Chip>
                {l.cleared_at && <> <Chip tone="good">{t('Opened', 'Liberado')}</Chip></>}
                {l.user_id && <> <Chip>{t('Has account', 'Tem conta')}</Chip></>}
              </td>
              <td className="small">{l.scorecard_sent_at ? t('Emailed', 'Enviado') : <span className="faint">{t('Not emailed', 'Não enviado')}</span>}</td>
              <td className="small muted">{fmtDate(l.updated_at, lang)}</td>
            </tr>
            {openId === l.id && (
              <tr className="detail">
                <td colSpan={6}>
                  <LeadDetail lead={l} reload={reload} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

type Track = {
  answered: number;
  answered_week: number;
  l1: { compliant: number; gaps: number; not_compliant: number };
  accounts: number;
  accounts_week: number;
  health: number;
  documents: number;
  catalog: number;
  waiting: number;
  stopped: number;
  declined: number;
};
type OverviewData = { us: Track; br: Track; team: number; owners: number; mail: boolean; ai: boolean };

function Funnel({ title, d }: { title: string; d: Track }) {
  const { t } = useSession();
  const steps = [
    { label: t('Answered the questions', 'Responderam às perguntas'), n: d.answered },
    { label: t('Passed the L-1 screen', 'Passaram na triagem L-1'), n: d.l1.compliant + d.l1.gaps },
    { label: t('Created an account', 'Criaram conta'), n: d.accounts },
    { label: t('Passed business health', 'Passaram na saúde do negócio'), n: d.health },
    { label: t('Documents accepted', 'Documentos aceitos'), n: d.documents },
    { label: t('In the catalog', 'No catálogo'), n: d.catalog },
  ];
  const max = Math.max(1, ...steps.map((s) => s.n));
  return (
    <div className="glass pad stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <div className="row between">
        <h3>{title}</h3>
        <span className="small muted">
          +{d.answered_week} {t('this week', 'esta semana')}
        </span>
      </div>
      <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        {steps.map((s) => (
          <div key={s.label} className="funnel-row">
            <span className="small">{s.label}</span>
            <span className="bar">
              <i style={{ width: `${(s.n / max) * 100}%` }} />
            </span>
            <strong>{s.n}</strong>
          </div>
        ))}
      </div>
      <div className="row wrapping small">
        <Chip tone="warn">
          {d.waiting} {t('waiting for the team', 'aguardando a equipe')}
        </Chip>
        <Chip tone="bad">
          {d.l1.not_compliant} {t('failed L-1', 'reprovados no L-1')}
        </Chip>
        <Chip tone="bad">
          {d.stopped + d.declined} {t('stopped or declined', 'parados ou recusados')}
        </Chip>
      </div>
    </div>
  );
}

function Overview() {
  const { t } = useSession();
  const [d, setD] = useState<OverviewData | null>(null);
  useEffect(() => {
    api.get<OverviewData>('/admin/overview').then(setD).catch(() => undefined);
  }, []);
  if (!d) return <PageLoader />;
  const waiting = d.us.waiting + d.br.waiting;
  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      {waiting > 0 && (
        <Link to="/staff" className="banner" style={{ textDecoration: 'none' }}>
          <strong>{waiting}</strong> {t('record(s) are waiting for a decision. Open Records.', 'registro(s) aguardam decisão. Abrir Registros.')}
        </Link>
      )}
      <div className="grid two">
        <Funnel title={t('U.S. businesses', 'Negócios nos EUA')} d={d.us} />
        <Funnel title={t('Candidates', 'Candidatos')} d={d.br} />
      </div>
      <div className="glass pad stack">
        <h3>{t('Setup', 'Configuração')}</h3>
        <div className="row wrapping">
          <Chip tone={d.mail ? 'good' : 'warn'}>{d.mail ? t('Email is on', 'E-mail ativo') : t('Email is off: scorecards and invites are not sent', 'E-mail desligado: scorecards e convites não são enviados')}</Chip>
          <Chip tone={d.ai ? 'good' : 'warn'}>{d.ai ? t('AI first pass is on', 'Primeira análise por IA ativa') : t('AI is off', 'IA desligada')}</Chip>
          <Chip>
            {d.team} {t('team member(s)', 'membro(s) da equipe')}
          </Chip>
          <Chip>
            {d.owners} {t('owner account(s)', 'conta(s) de donos')}
          </Chip>
        </div>
        <div className="row wrapping">
          <a className="btn sm" href="/api/admin/export/leads">
            <Download size={14} /> {t('Leads (CSV)', 'Contatos (CSV)')}
          </a>
          <a className="btn sm" href="/api/admin/export/records">
            <Download size={14} /> {t('Records (CSV)', 'Registros (CSV)')}
          </a>
        </div>
      </div>
    </div>
  );
}

type Event = { id: number; at: number; actor_email: string | null; action: string; case_id: string | null; detail: string | null; company_name: string | null };

function Activity() {
  const { t, lang } = useSession();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [more, setMore] = useState(true);
  const load = useCallback(async (before?: number) => {
    const r = await api.get<{ events: Event[] }>(`/admin/audit${before ? `?before=${before}` : ''}`);
    setEvents((prev) => (before && prev ? [...prev, ...r.events] : r.events));
    setMore(r.events.length === 100);
  }, []);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  if (!events) return <PageLoader />;
  return (
    <div className="glass pad stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      <p className="small muted">{t('Every sign-in, view, upload, decision and export. Entries cannot be changed or deleted.', 'Todo acesso, visualização, envio, decisão e exportação. As entradas não podem ser alteradas nem excluídas.')}</p>
      {events.map((e) => (
        <div key={e.id} className="activity-row small">
          <span className="faint">{new Date(e.at).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <strong>{e.action}</strong>
          <span className="muted" style={{ overflowWrap: 'anywhere' }}>
            {e.actor_email ?? '—'}
            {e.case_id && (
              <>
                {' · '}
                <Link to={`/case/${e.case_id}`}>{e.company_name || t('record', 'registro')}</Link>
              </>
            )}
            {e.detail ? ` · ${e.detail}` : ''}
          </span>
        </div>
      ))}
      {more && events.length > 0 && (
        <div>
          <button className="btn sm" onClick={() => load(events[events.length - 1].id)}>
            {t('Show older', 'Mostrar anteriores')}
          </button>
        </div>
      )}
    </div>
  );
}

type LeadFilter = 'all' | Kind;

/** Every saved L-1 screen. A row opens the person's responses and scorecard. */
function Leads() {
  const { t } = useSession();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState<LeadFilter>('all');
  const [query, setQuery] = useState('');
  const reload = useCallback(() => api.get<{ leads: Lead[] }>('/admin/leads').then((r) => setLeads(r.leads)), []);
  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (leads ?? []).filter((l) => (filter === 'all' || l.kind === filter) && (!q || `${l.name} ${l.email}`.toLowerCase().includes(q))), [leads, filter, q]);
  if (!leads) return <PageLoader />;
  const filters: [LeadFilter, string][] = [
    ['all', t('All', 'Todos')],
    ['us', t('U.S. business', 'Negócio nos EUA')],
    ['br', t('Candidate', 'Candidato')],
  ];
  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div className="row between wrapping" style={{ '--gap': '12px' } as React.CSSProperties}>
        <div className="form-picker">
          {filters.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label} <span className="faint">{leads.filter((l) => f === 'all' || l.kind === f).length}</span>
            </button>
          ))}
        </div>
        <div className="row grow" style={{ '--gap': '8px', justifyContent: 'flex-end' } as React.CSSProperties}>
          <div className="affix grow" style={{ maxWidth: 320 }}>
            <span>
              <Search size={16} />
            </span>
            <input className="input" type="search" aria-label={t('Search leads', 'Buscar contatos')} placeholder={t('Name or email', 'Nome ou e-mail')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <a className="btn" href="/api/admin/export/leads">
            <Download size={14} /> CSV
          </a>
        </div>
      </div>
      <p className="small muted">
        {t(
          'Everyone who answered the L-1 questions and left a name and email, including people who went on to create an account. Select a row to see the responses.',
          'Todos que responderam às perguntas L-1 e deixaram nome e e-mail, inclusive quem depois criou uma conta. Selecione uma linha para ver as respostas.',
        )}
      </p>
      {shown.length === 0 ? (
        <div className="glass pad center muted">{leads.length === 0 ? t('No leads yet.', 'Nenhum contato ainda.') : t('Nothing matches.', 'Nada corresponde.')}</div>
      ) : (
        <LeadsTable leads={shown} reload={reload} />
      )}
    </div>
  );
}

const TABS = ['overview', 'leads', 'forms', 'users', 'activity'] as const;
type Tab = (typeof TABS)[number];

export function AdminHome() {
  const { t, user } = useSession();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('tab') as Tab | null;
  const tab: Tab = wanted && TABS.includes(wanted) ? wanted : 'overview';
  const setTab = (k: Tab) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true });
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  if (!user.is_admin) return <Navigate to="/staff" replace />;
  const label = { overview: t('Overview', 'Visão geral'), leads: t('Leads', 'Contatos'), forms: t('Questionnaires', 'Questionários'), users: t('Users', 'Usuários'), activity: t('Activity', 'Atividade') };
  return (
    <>
      <Nav />
      <main className="wrap stack" style={{ padding: '28px 0 64px', '--gap': '20px' } as React.CSSProperties}>
        <div className="row between wrapping">
          <h2>{t('Admin', 'Admin')}</h2>
          <div className="tabs" role="tablist">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>
                {label[k]}
              </button>
            ))}
          </div>
        </div>
        {tab === 'overview' && <Overview />}
        {tab === 'leads' && <Leads />}
        {tab === 'forms' && <Questionnaires />}
        {tab === 'users' && <Users />}
        {tab === 'activity' && <Activity />}
      </main>
    </>
  );
}

/** A team member accepts an invitation and sets a password. */
export function Join() {
  const { token } = useParams();
  const { t, setUser, user } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState({ name: '', password: '' });
  const { busy, error, run } = useAction();
  useEffect(() => {
    api.get<{ email: string }>(`/invites/${token}`).then((r) => setEmail(r.email), () => setEmail(null));
  }, [token]);
  if (user) return <Navigate to="/app" replace />;
  if (email === undefined) return <PageLoader />;
  return (
    <>
      <Nav />
      <main className="narrow" style={{ padding: '48px 0 72px', maxWidth: 460 }}>
        <div className="glass pad stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          {email === null ? (
            <>
              <h2>{t('This invitation is no longer valid', 'Este convite não é mais válido')}</h2>
              <p className="muted">{t('It was used, cancelled or expired. Ask an admin for a new one.', 'Ele foi usado, cancelado ou expirou. Peça um novo a um admin.')}</p>
            </>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await api.post<{ user: User }>('/auth/join', { token, ...form });
                  setUser(r.user);
                  navigate('/staff');
                });
              }}
            >
              <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                <h2>{t('Join the 10x BR team', 'Entre na equipe 10x BR')}</h2>
                <p className="muted small">{email}</p>
              </div>
              <Field label={t('Full name', 'Nome completo')}>
                <input className="input" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={t('Password', 'Senha')} help={t('At least 10 characters.', 'Pelo menos 10 caracteres.')}>
                <PasswordInput required minLength={10} maxLength={200} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
              {error && <p className="error">{error}</p>}
              <button className="btn primary lg" disabled={busy}>
                {t('Create account', 'Criar conta')}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
