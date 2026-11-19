import { ArrowLeft, ChevronRight, KeyRound, LogOut, MailPlus, Search, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { KINDS, LAST_STAGE, STAGE1_RATING, STAGE2_RATING, STATUS, type Kind, type Stage1Rating, type Stage2Rating, type Status } from '../../shared/process';
import { api } from '../api';
import { useSession } from '../session';
import { Chip, CopyButton, Field, Nav, PageLoader, fmtDate, s1Tone, s2Tone, statusTone, useAction } from '../ui';

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
type Filter = 'all' | 'staff' | 'applicant';

function TypeChip({ u }: { u: Pick<Row, 'role' | 'is_admin' | 'disabled'> }) {
  const { t } = useSession();
  if (u.disabled) return <Chip tone="bad">{t('Deactivated', 'Desativado')}</Chip>;
  if (u.role === 'applicant') return <Chip>{t('Owner', 'Dono')}</Chip>;
  return u.is_admin ? <Chip tone="info">{t('Admin', 'Admin')}</Chip> : <Chip tone="info">{t('Reviewer', 'Revisor')}</Chip>;
}

/** Every account, with search. A row opens the person's profile. */
export function Users() {
  const { t, lang, user } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<{ users: Row[]; invites: Invite[] } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: '', is_admin: false });
  const [invited, setInvited] = useState<{ link: string; emailed: boolean; email: string } | null>(null);
  const { busy, error, run } = useAction();
  const reload = useCallback(() => api.get<{ users: Row[]; invites: Invite[] }>('/admin/users').then(setData), []);
  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);
  if (!data) return <PageLoader />;

  const q = query.trim().toLowerCase();
  const rows = data.users.filter((u) => (filter === 'all' || u.role === filter) && (!q || `${u.name} ${u.email} ${u.company_name ?? ''}`.toLowerCase().includes(q)));
  const count = (f: Filter) => data.users.filter((u) => f === 'all' || u.role === f).length;
  const filters: [Filter, string][] = [
    ['all', t('All', 'Todos')],
    ['staff', t('Team', 'Equipe')],
    ['applicant', t('Owners', 'Donos')],
  ];

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div className="row between wrapping" style={{ '--gap': '12px' } as React.CSSProperties}>
        <div className="form-picker">
          {filters.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label} <span className="faint">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="row grow" style={{ '--gap': '8px', justifyContent: 'flex-end' } as React.CSSProperties}>
          <div className="affix grow" style={{ maxWidth: 320 }}>
            <span>
              <Search size={16} />
            </span>
            <input className="input" type="search" aria-label={t('Search users', 'Buscar usuários')} placeholder={t('Name, email or company', 'Nome, e-mail ou empresa')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button type="button" className="btn primary" onClick={() => setInviting(!inviting)}>
            <MailPlus size={16} /> {t('Invite', 'Convidar')}
          </button>
        </div>
      </div>

      {(inviting || invited || data.invites.length > 0) && (
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
          <p className="small muted">{t('Team members can open every record and decide on it. Admins can also manage users and export data. Owners create their own account after the L-1 screen.', 'Membros da equipe abrem e decidem todos os registros. Admins também gerenciam usuários e exportam dados. Donos criam a própria conta depois da triagem L-1.')}</p>
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
              {t('Send invite', 'Enviar convite')}
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
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <div className="glass" style={{ overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <p className="pad muted center">{q ? t('Nobody matches that search.', 'Ninguém corresponde à busca.') : t('No accounts yet.', 'Nenhuma conta ainda.')}</p>
        ) : (
          <table className="list cards">
            <thead>
              <tr>
                <th>{t('Name', 'Nome')}</th>
                <th>{t('Type', 'Tipo')}</th>
                <th>{t('Record', 'Registro')}</th>
                <th>{t('Two-step sign-in', 'Login em duas etapas')}</th>
                <th>{t('Last sign-in', 'Último acesso')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} tabIndex={0} style={u.disabled ? { opacity: 0.55 } : undefined} onClick={() => navigate(`/admin/users/${u.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/users/${u.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {u.name} {u.id === user?.id && <span className="faint small">({t('you', 'você')})</span>}
                    </div>
                    <div className="small muted">{u.email}</div>
                  </td>
                  <td>
                    <TypeChip u={u} />
                  </td>
                  <td className="small">
                    {u.case_id ? (
                      <>
                        {u.company_name || (u.kind === 'us' ? t('U.S. business', 'Negócio nos EUA') : t('Candidate', 'Candidato'))} · {u.stage}/{LAST_STAGE}
                      </>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>{u.totp_enabled ? <Chip tone="good">{t('On', 'Ativo')}</Chip> : u.role === 'staff' ? <Chip tone="warn">{t('Off', 'Desligado')}</Chip> : <span className="faint">—</span>}</td>
                  <td className="small muted">{u.last_seen ? fmtDate(u.last_seen, lang) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ChevronRight size={16} className="faint" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

type Profile = {
  user: { id: string; email: string; name: string; role: 'applicant' | 'staff'; lang: 'en' | 'pt'; is_admin: number; disabled: number; totp_enabled: number; created_at: number };
  sessions: { created_at: number; expires_at: number; ip: string | null; user_agent: string | null }[];
  cases: { id: string; kind: Kind; company_name: string; industry: string; location: string; stage: number; status: Status; s1_rating: Stage1Rating | null; s2_rating: Stage2Rating | null; created_at: number; updated_at: number }[];
  leads: { id: string; kind: Kind; s1_rating: Stage1Rating; created_at: number; updated_at: number; cleared_at: number | null; cleared_by: string | null }[];
  events: { id: number; at: number; actor_email: string | null; action: string; case_id: string | null; detail: string | null; ip: string | null; company_name: string | null }[];
  reset: { expires_at: number; created_by: string | null } | null;
};

/** A short name for the browser and system in a user-agent string. */
function device(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  const system = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, system].filter(Boolean).join(' · ') || ua.slice(0, 40);
}

/** One person: their details, access, records and activity. */
export function UserProfile() {
  const { id } = useParams();
  const { t, tl, lang, user, refresh } = useSession();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [edit, setEdit] = useState<{ name: string; lang: 'en' | 'pt' } | null>(null);
  const [link, setLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const { busy, error, run } = useAction();
  const reload = useCallback(() => api.get<Profile>(`/admin/users/${id}`).then(setP, () => setP(null)), [id]);
  useEffect(() => {
    reload();
  }, [reload]);

  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  if (!user.is_admin) return <Navigate to="/staff" replace />;
  if (p === undefined) return <PageLoader />;

  const back = (
    <Link className="btn ghost sm" to="/admin?tab=users" style={{ alignSelf: 'flex-start' }}>
      <ArrowLeft size={14} /> {t('Users', 'Usuários')}
    </Link>
  );
  if (p === null) {
    return (
      <>
        <Nav />
        <main className="wrap stack" style={{ padding: '28px 0 64px', '--gap': '20px' } as React.CSSProperties}>
          {back}
          <p className="muted">{t('This user does not exist.', 'Este usuário não existe.')}</p>
        </main>
      </>
    );
  }

  const u = p.user;
  const me = u.id === user.id;
  const staff = u.role === 'staff';
  const update = (body: object) => run(async () => { await api.put(`/admin/users/${u.id}`, body); await reload(); });
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const kindName = (k: Kind) => tl(KINDS[k].title);

  return (
    <>
      <Nav />
      <main className="wrap stack" style={{ padding: '28px 0 64px', '--gap': '20px' } as React.CSSProperties}>
        {back}
        <div className="row between wrapping" style={{ alignItems: 'flex-start', '--gap': '12px' } as React.CSSProperties}>
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <h2 style={{ overflowWrap: 'anywhere' }}>
              {u.name} {me && <span className="faint small">({t('you', 'você')})</span>}
            </h2>
            <div className="row wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
              <span className="muted" style={{ overflowWrap: 'anywhere' }}>{u.email}</span>
              <TypeChip u={u} />
            </div>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        <div className="grid two" style={{ alignItems: 'start' }}>
          <section className="glass pad stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <div className="row between">
              <h3>{t('Profile', 'Perfil')}</h3>
              {!edit && (
                <button type="button" className="btn ghost sm" onClick={() => setEdit({ name: u.name, lang: u.lang })}>
                  {t('Edit', 'Editar')}
                </button>
              )}
            </div>
            {edit ? (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api.put(`/admin/users/${u.id}`, edit);
                    setEdit(null);
                    await reload();
                    if (me) await refresh();
                  });
                }}
              >
                <Field label={t('Full name', 'Nome completo')}>
                  <input className="input" required minLength={2} maxLength={120} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </Field>
                <Field label={t('Language for emails', 'Idioma dos e-mails')}>
                  <div className="seg">
                    {(['en', 'pt'] as const).map((l) => (
                      <button type="button" key={l} aria-pressed={edit.lang === l} onClick={() => setEdit({ ...edit, lang: l })}>
                        {l === 'en' ? 'English' : 'Português'}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                  <button className="btn primary sm" disabled={busy}>
                    {t('Save', 'Salvar')}
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => setEdit(null)}>
                    {t('Cancel', 'Cancelar')}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="kv">
                <dt>{t('Name', 'Nome')}</dt>
                <dd>{u.name}</dd>
                <dt>Email</dt>
                <dd style={{ overflowWrap: 'anywhere' }}>{u.email}</dd>
                <dt>{t('Type', 'Tipo')}</dt>
                <dd>{staff ? (u.is_admin ? t('Team, admin', 'Equipe, admin') : t('Team, reviewer', 'Equipe, revisor')) : t('Owner', 'Dono')}</dd>
                <dt>{t('Language', 'Idioma')}</dt>
                <dd>{u.lang === 'pt' ? 'Português' : 'English'}</dd>
                <dt>{t('Account created', 'Conta criada')}</dt>
                <dd>{when(u.created_at)}</dd>
                <dt>{t('Last sign-in', 'Último acesso')}</dt>
                <dd>{p.sessions[0] ? when(p.sessions[0].created_at) : t('No open session', 'Sem sessão aberta')}</dd>
                <dt>{t('Two-step sign-in', 'Login em duas etapas')}</dt>
                <dd>{u.totp_enabled ? t('On', 'Ativo') : t('Off', 'Desligado')}</dd>
                <dt>{t('Status', 'Status')}</dt>
                <dd>{u.disabled ? t('Deactivated', 'Desativado') : t('Active', 'Ativo')}</dd>
              </dl>
            )}
          </section>

          <section className="glass pad stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <h3>{t('Access', 'Acesso')}</h3>
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <div className="row between wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
                <span className="small muted grow">
                  {p.reset && !link
                    ? t(`A reset link is open until ${when(p.reset.expires_at)}. A new one replaces it.`, `Há um link de redefinição aberto até ${when(p.reset.expires_at)}. Um novo o substitui.`)
                    : t('A single-use link for choosing a new password, valid 24 hours.', 'Um link de uso único para escolher uma nova senha, válido por 24 horas.')}
                </span>
                <button type="button" className="btn sm" disabled={busy || !!u.disabled} onClick={() => run(async () => { setLink(await api.post<{ link: string; emailed: boolean }>(`/admin/users/${u.id}/reset-link`)); await reload(); })}>
                  <KeyRound size={14} /> {t('Password reset link', 'Link de redefinição de senha')}
                </button>
              </div>
              {link && (
                <div className="banner good stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                  <span>
                    {link.emailed
                      ? t(`Emailed to ${u.email}. You can also pass the link on yourself. It is shown only once.`, `Enviado para ${u.email}. Você também pode repassar o link. Ele é mostrado só uma vez.`)
                      : me
                        ? t('Open this link to choose your new password. It is shown only once.', 'Abra este link para escolher sua nova senha. Ele é mostrado só uma vez.')
                        : t(`Email is not set up. Send this link to ${u.email} yourself. It is shown only once.`, `O e-mail não está configurado. Envie este link para ${u.email}. Ele é mostrado só uma vez.`)}
                  </span>
                  <code style={{ wordBreak: 'break-all' }}>{link.link}</code>
                  <div>
                    <CopyButton text={link.link} label={t('Copy link', 'Copiar link')} />
                  </div>
                </div>
              )}
            </div>
            {me ? (
              <p className="small muted">{t('Another admin has to change your own access.', 'Outro admin precisa alterar o seu próprio acesso.')}</p>
            ) : (
              <div className="row wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
                {staff && !u.disabled && (
                  <button type="button" className="btn sm" disabled={busy} onClick={() => update({ is_admin: !u.is_admin })}>
                    {u.is_admin ? t('Remove admin', 'Remover admin') : t('Make admin', 'Tornar admin')}
                  </button>
                )}
                {!!u.totp_enabled && (
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => confirm(t('Turn off two-step sign-in for this person? They will set it up again.', 'Desligar o login em duas etapas desta pessoa? Ela configurará de novo.')) && update({ reset_totp: true })}
                  >
                    {t('Reset two-step', 'Redefinir duas etapas')}
                  </button>
                )}
                {p.sessions.length > 0 && (
                  <button type="button" className="btn sm" disabled={busy} onClick={() => confirm(t('Sign this person out on every device?', 'Desconectar esta pessoa de todos os dispositivos?')) && update({ sign_out: true })}>
                    <LogOut size={14} /> {t('Sign out everywhere', 'Desconectar de tudo')}
                  </button>
                )}
                <button
                  type="button"
                  className={`btn sm ${u.disabled ? '' : 'danger'}`}
                  disabled={busy}
                  onClick={() => (u.disabled || confirm(t(`Deactivate ${u.email}? They are signed out and cannot sign in.`, `Desativar ${u.email}? A pessoa é desconectada e não pode entrar.`))) && update({ disabled: !u.disabled })}
                >
                  {u.disabled ? <UserCheck size={14} /> : <UserX size={14} />} {u.disabled ? t('Reactivate', 'Reativar') : t('Deactivate', 'Desativar')}
                </button>
              </div>
            )}
            <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
              <strong className="small">
                {t('Open sessions', 'Sessões abertas')} ({p.sessions.length})
              </strong>
              {p.sessions.length === 0 ? (
                <span className="small faint">{t('Not signed in anywhere.', 'Não está conectado em nenhum lugar.')}</span>
              ) : (
                p.sessions.map((s, i) => (
                  <div key={i} className="row between small wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
                    <span>{device(s.user_agent)}</span>
                    <span className="muted">
                      {when(s.created_at)}
                      {s.ip ? ` · ${s.ip}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {(!staff || p.cases.length > 0 || p.leads.length > 0) && (
          <section className="glass pad stack" style={{ '--gap': '12px' } as React.CSSProperties}>
            <h3>{t('Records', 'Registros')}</h3>
            {p.cases.length === 0 && p.leads.length === 0 && <p className="small muted">{t('No record yet.', 'Nenhum registro ainda.')}</p>}
            {p.cases.map((k) => (
              <div key={k.id} className="row between wrapping" style={{ '--gap': '10px' } as React.CSSProperties}>
                <div className="stack grow" style={{ '--gap': '4px' } as React.CSSProperties}>
                  <strong>{k.company_name || kindName(k.kind)}</strong>
                  <span className="small muted">
                    {[kindName(k.kind), k.industry, k.location].filter(Boolean).join(' · ')} · {t('step', 'etapa')} {k.stage}/{LAST_STAGE} · {t('updated', 'atualizado')} {fmtDate(k.updated_at, lang)}
                  </span>
                  <div className="row wrapping" style={{ '--gap': '6px' } as React.CSSProperties}>
                    <Chip tone={statusTone[k.status]}>{tl(STATUS[k.status])}</Chip>
                    {k.s1_rating && <Chip tone={s1Tone[k.s1_rating]}>L-1: {tl(STAGE1_RATING[k.s1_rating])}</Chip>}
                    {k.s2_rating && (
                      <Chip tone={s2Tone[k.s2_rating]}>
                        {t('Health', 'Saúde')}: {tl(STAGE2_RATING[k.s2_rating])}
                      </Chip>
                    )}
                  </div>
                </div>
                <Link className="btn sm" to={`/case/${k.id}`}>
                  {t('Open record', 'Abrir registro')}
                </Link>
              </div>
            ))}
            {p.leads.map((l) => (
              <div key={l.id} className="row between small wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
                <span>
                  {t('L-1 screen answered', 'Triagem L-1 respondida')} · {kindName(l.kind)} · {fmtDate(l.updated_at, lang)}
                  {l.cleared_at ? ` · ${t('next step opened by', 'próxima etapa liberada por')} ${l.cleared_by}` : ''}
                </span>
                <Chip tone={s1Tone[l.s1_rating]}>{tl(STAGE1_RATING[l.s1_rating])}</Chip>
              </div>
            ))}
          </section>
        )}

        <section className="glass pad stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <h3>{t('Activity', 'Atividade')}</h3>
          <p className="small muted">{t('The 50 latest entries by or about this person.', 'As 50 entradas mais recentes feitas por esta pessoa ou sobre ela.')}</p>
          {p.events.length === 0 && <p className="small faint">{t('Nothing yet.', 'Nada ainda.')}</p>}
          {p.events.map((e) => (
            <div key={e.id} className="activity-row small">
              <span className="faint">{new Date(e.at).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <strong>{e.action}</strong>
              <span className="muted" style={{ overflowWrap: 'anywhere' }}>
                {e.actor_email && e.actor_email !== u.email ? e.actor_email : ''}
                {e.case_id && (
                  <>
                    {e.actor_email && e.actor_email !== u.email ? ' · ' : ''}
                    <Link to={`/case/${e.case_id}`}>{e.company_name || t('record', 'registro')}</Link>
                  </>
                )}
                {e.ip ? ` · ${e.ip}` : ''}
              </span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
