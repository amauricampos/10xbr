import { Check, Copy, Download, MailPlus, Trash2, UserCheck, UserX } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { LAST_STAGE, STAGE1_RATING, STATUS, scoreStage1, stage1Complete, type Kind, type Status } from '../../shared/process';
import { api, type Lead, type User } from '../api';
import { useSession } from '../session';
import { Stage1ResultView } from '../stage1';
import { Questionnaires } from './Forms';
import { Chip, Field, Nav, PageLoader, fmtDate, s1Tone, statusTone, useAction } from '../ui';

/* ------------------------------------------------------------------ */
/* Leads: people who answered the questions and have no account        */
/* ------------------------------------------------------------------ */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn sm"
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => setDone(true), () => undefined)}
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {label}
    </button>
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
      ) : lead.s1_rating === 'not_compliant' ? (
        <div className="glass pad-sm stack">
          <strong>{t('Open the next step anyway', 'Liberar a próxima etapa mesmo assim')}</strong>
          <p className="small muted">
            {t(
              'This result did not pass, so the person cannot create an account. If you see a way forward, open the next step and they are emailed a link.',
              'Este resultado não passou, então a pessoa não pode criar conta. Se houver um caminho, libere a próxima etapa e ela recebe um link por e-mail.',
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

type Row = {
  id: string;
  email: string;
  name: string;
  role: 'applicant' | 'staff';
  is_admin: number;
  disabled: number;
  totp_enabled: number;
  created_at: number;
  last_seen: number | null;
  case_id: string | null;
  kind: Kind | null;
  stage: number | null;
  status: Status | null;
  company_name: string | null;
};
type Invite = { id: string; email: string; is_admin: number; created_by: string; expires_at: number };

function People({ role }: { role: 'staff' | 'applicant' }) {
  const { t, tl, lang, user } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<{ users: Row[]; invites: Invite[] } | null>(null);
  const [form, setForm] = useState({ email: '', is_admin: false });
  const [invited, setInvited] = useState<{ link: string; emailed: boolean; email: string } | null>(null);
  const { busy, error, run } = useAction();
  const reload = useCallback(() => api.get<{ users: Row[]; invites: Invite[] }>('/admin/users').then(setData), []);
  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);
  if (!data) return <PageLoader />;

  const rows = data.users.filter((u) => u.role === role);
  const update = (id: string, body: object) => run(async () => { await api.put(`/admin/users/${id}`, body); await reload(); });

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      {role === 'staff' && (
        <form
          className="glass pad stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await api.post<{ link: string; emailed: boolean }>('/admin/invites', form);
              setInvited({ ...r, email: form.email });
              setForm({ email: '', is_admin: false });
              await reload();
            });
          }}
        >
          <h3>{t('Invite a team member', 'Convidar um membro da equipe')}</h3>
          <p className="small muted">{t('Team members can open every record and decide on it. Admins can also manage the team and export data.', 'Membros da equipe abrem e decidem todos os registros. Admins também gerenciam a equipe e exportam dados.')}</p>
          <div className="row wrapping" style={{ alignItems: 'flex-end' }}>
            <div className="grow" style={{ minWidth: 220 }}>
              <Field label="Email">
                <input className="input" type="email" required maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            </div>
            <label className="row small" style={{ '--gap': '8px', paddingBottom: 12 } as React.CSSProperties}>
              <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} /> {t('Admin', 'Admin')}
            </label>
            <button className="btn primary" disabled={busy} style={{ marginBottom: 2 }}>
              <MailPlus size={16} /> {t('Invite', 'Convidar')}
            </button>
          </div>
          {invited && (
            <div className="banner good stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <span>
                {invited.emailed
                  ? t(`Invitation emailed to ${invited.email}.`, `Convite enviado para ${invited.email}.`)
                  : t(`Email is not set up. Send this link to ${invited.email} yourself. It is shown only once.`, `O e-mail não está configurado. Envie este link para ${invited.email}. Ele é mostrado só uma vez.`)}
              </span>
              <code style={{ wordBreak: 'break-all' }}>{invited.link}</code>
              <div>
                <CopyButton text={invited.link} label={t('Copy link', 'Copiar link')} />
              </div>
            </div>
          )}
          {data.invites.length > 0 && (
            <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
              {data.invites.map((i) => (
                <div key={i.id} className="row between small">
                  <span>
                    {i.email} {i.is_admin ? <Chip>{t('Admin', 'Admin')}</Chip> : null}{' '}
                    <span className="faint">
                      · {t('expires', 'expira')} {fmtDate(i.expires_at, lang)}
                    </span>
                  </span>
                  <button type="button" className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await api.del(`/admin/invites/${i.id}`); await reload(); })}>
                    {t('Cancel invite', 'Cancelar convite')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <div className="glass" style={{ overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <p className="pad muted center">{t('No accounts yet.', 'Nenhuma conta ainda.')}</p>
        ) : (
          <table className="list static cards">
            <thead>
              <tr>
                <th>{t('Name', 'Nome')}</th>
                <th>{role === 'staff' ? t('Access', 'Acesso') : t('Record', 'Registro')}</th>
                <th>{role === 'staff' ? t('Two-step sign-in', 'Login em duas etapas') : t('Status', 'Status')}</th>
                <th>{t('Last sign-in', 'Último acesso')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const me = u.id === user?.id;
                return (
                  <tr key={u.id} style={u.disabled ? { opacity: 0.55 } : undefined}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {u.name} {me && <span className="faint small">({t('you', 'você')})</span>}
                      </div>
                      <div className="small muted">{u.email}</div>
                    </td>
                    {role === 'staff' ? (
                      <>
                        <td>
                          {u.disabled ? <Chip tone="bad">{t('Deactivated', 'Desativado')}</Chip> : u.is_admin ? <Chip tone="info">{t('Admin', 'Admin')}</Chip> : <Chip>{t('Reviewer', 'Revisor')}</Chip>}
                        </td>
                        <td>{u.totp_enabled ? <Chip tone="good">{t('On', 'Ativo')}</Chip> : <Chip tone="warn">{t('Off', 'Desligado')}</Chip>}</td>
                      </>
                    ) : (
                      <>
                        <td className="small">
                          {u.case_id ? (
                            <button className="btn ghost sm" onClick={() => navigate(`/case/${u.case_id}`)}>
                              {u.company_name || (u.kind === 'us' ? t('U.S. business', 'Negócio nos EUA') : t('Candidate', 'Candidato'))} · {u.stage}/{LAST_STAGE}
                            </button>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </td>
                        <td>
                          {u.disabled ? <Chip tone="bad">{t('Deactivated', 'Desativado')}</Chip> : u.status ? <Chip tone={statusTone[u.status]}>{tl(STATUS[u.status])}</Chip> : <span className="faint">—</span>}
                        </td>
                      </>
                    )}
                    <td className="small muted">{u.last_seen ? fmtDate(u.last_seen, lang) : '—'}</td>
                    <td>
                      {!me && (
                        <div className="row wrapping" style={{ '--gap': '4px', justifyContent: 'flex-end' } as React.CSSProperties}>
                          {role === 'staff' && !u.disabled && (
                            <button className="btn ghost sm" disabled={busy} onClick={() => update(u.id, { is_admin: !u.is_admin })}>
                              {u.is_admin ? t('Remove admin', 'Remover admin') : t('Make admin', 'Tornar admin')}
                            </button>
                          )}
                          {role === 'staff' && !!u.totp_enabled && (
                            <button
                              className="btn ghost sm"
                              disabled={busy}
                              onClick={() => confirm(t('Turn off two-step sign-in for this person? They will set it up again.', 'Desligar o login em duas etapas desta pessoa? Ela configurará de novo.')) && update(u.id, { reset_totp: true })}
                            >
                              {t('Reset two-step', 'Redefinir duas etapas')}
                            </button>
                          )}
                          <button
                            className={`btn ghost sm ${u.disabled ? '' : 'danger'}`}
                            disabled={busy}
                            onClick={() => (u.disabled || confirm(t(`Deactivate ${u.email}? They are signed out and cannot sign in.`, `Desativar ${u.email}? A pessoa é desconectada e não pode entrar.`))) && update(u.id, { disabled: !u.disabled })}
                          >
                            {u.disabled ? <UserCheck size={14} /> : <UserX size={14} />} {u.disabled ? t('Reactivate', 'Reativar') : t('Deactivate', 'Desativar')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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

const TABS = ['overview', 'forms', 'team', 'owners', 'activity'] as const;

export function AdminHome() {
  const { t, user } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  if (!user.is_admin) return <Navigate to="/staff" replace />;
  const label = { overview: t('Overview', 'Visão geral'), forms: t('Questionnaires', 'Questionários'), team: t('Team', 'Equipe'), owners: t('Owner accounts', 'Contas de donos'), activity: t('Activity', 'Atividade') };
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
        {tab === 'forms' && <Questionnaires />}
        {tab === 'team' && <People role="staff" />}
        {tab === 'owners' && <People role="applicant" />}
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
                <input className="input" type="password" required minLength={10} maxLength={200} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
