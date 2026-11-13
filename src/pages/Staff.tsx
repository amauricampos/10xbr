import QRCode from 'qrcode';
import { Search, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KINDS, LAST_STAGE, STAGE1_RATING, STAGE2_RATING, STAGES, STATUS, type Kind, type Status } from '../../shared/process';
import { api, type CaseSummary } from '../api';
import { useSession } from '../session';
import { Chip, Field, Nav, PageLoader, fmtDate, fmtUsd, s1Tone, s2Tone, statusTone, useAction } from '../ui';

function TwoFactor() {
  const { t, refresh } = useSession();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();

  const begin = () =>
    run(async () => {
      const r = await api.post<{ secret: string; uri: string }>('/auth/totp/begin');
      setSetup({ secret: r.secret, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 180 }) });
    });

  return (
    <div className="banner stack">
      <div className="row">
        <ShieldAlert size={18} style={{ flex: 'none' }} />
        <strong>{t('Turn on two-step sign-in. Team accounts can open every record.', 'Ative o login em duas etapas. Contas da equipe abrem todos os registros.')}</strong>
      </div>
      {!setup ? (
        <div>
          <button className="btn sm" disabled={busy} onClick={begin}>
            {t('Set up authenticator app', 'Configurar app autenticador')}
          </button>
        </div>
      ) : (
        <div className="row wrapping" style={{ alignItems: 'flex-start', '--gap': '18px' } as React.CSSProperties}>
          <img src={setup.qr} width={150} height={150} alt="QR code" style={{ borderRadius: 12 }} />
          <div className="stack grow" style={{ minWidth: 220 }}>
            <p className="small">
              {t('Scan with Google Authenticator, 1Password or Authy, or enter this key:', 'Escaneie com Google Authenticator, 1Password ou Authy, ou digite esta chave:')}{' '}
              <code style={{ wordBreak: 'break-all' }}>{setup.secret}</code>
            </p>
            <Field label={t('6-digit code', 'Código de 6 dígitos')}>
              <input className="input" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 180 }} />
            </Field>
            <div>
              <button className="btn primary sm" disabled={busy || code.trim().length < 6} onClick={() => run(async () => { await api.post('/auth/totp/enable', { code }); await refresh(); })}>
                {t('Turn on', 'Ativar')}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

const FILTERS: (Status | 'all')[] = ['all', 'review', 'active', 'stopped', 'approved', 'declined'];
const aiTone = { advance: 'good', hold: 'warn', decline: 'bad' } as const;

export function StaffHome() {
  const { t, tl, lang, user } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<CaseSummary[] | null>(null);
  const [kind, setKind] = useState<Kind>('us');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (user?.role === 'staff') api.get<{ cases: CaseSummary[] }>('/cases').then((r) => setRows(r.cases));
  }, [user]);

  const ofKind = useMemo(() => (rows ?? []).filter((r) => r.kind === kind), [rows, kind]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ofKind.filter(
      (r) => (filter === 'all' || r.status === filter) && (!needle || `${r.company_name} ${r.owner_name} ${r.owner_email} ${r.industry} ${r.location}`.toLowerCase().includes(needle)),
    );
  }, [ofKind, q, filter]);

  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  if (!rows) return <PageLoader />;

  const filterLabel = (f: Status | 'all') =>
    f === 'all' ? t('All', 'Todos') : f === 'approved' ? t('Catalog', 'Catálogo') : tl(STATUS[f]);
  const aiLabel = { advance: t('Advance', 'Avançar'), hold: t('Hold', 'Aguardar'), decline: t('Decline', 'Recusar') };

  return (
    <>
      <Nav />
      <main className="wrap stack" style={{ padding: '28px 0 64px', '--gap': '20px' } as React.CSSProperties}>
        {!user.totp_enabled ? (
          <TwoFactor />
        ) : (
          <p className="tiny faint row" style={{ '--gap': '6px' } as React.CSSProperties}>
            <ShieldCheck size={14} /> {t('Two-step sign-in is on.', 'Login em duas etapas ativo.')}
          </p>
        )}

        <div className="row between wrapping">
          <div className="tabs" role="tablist">
            {(['us', 'br'] as const).map((k) => (
              <button key={k} role="tab" aria-pressed={kind === k} onClick={() => { setKind(k); setFilter('all'); }}>
                {k === 'us' ? t('U.S. businesses', 'Negócios nos EUA') : t('Candidates', 'Candidatos')} · {rows.filter((r) => r.kind === k).length}
              </button>
            ))}
          </div>
          <div className="affix" style={{ width: 'min(320px, 100%)' }}>
            <span>
              <Search size={16} />
            </span>
            <input className="input" placeholder={t('Search name, owner or city', 'Buscar nome, responsável ou cidade')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {FILTERS.map((f) => (
            <button key={f} className="glass pad-sm tile" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              <div className="tiny faint">{filterLabel(f)}</div>
              <div className="n">{f === 'all' ? ofKind.length : ofKind.filter((r) => r.status === f).length}</div>
            </button>
          ))}
        </div>

        <div className="glass" style={{ overflowX: 'auto' }}>
          {shown.length === 0 ? (
            <p className="pad muted center">
              {ofKind.length === 0
                ? kind === 'us'
                  ? t('No businesses yet. They appear here as owners sign up.', 'Nenhum negócio ainda. Eles aparecem aqui conforme os donos se cadastram.')
                  : t('No candidates yet. They appear here as they sign up.', 'Nenhum candidato ainda. Eles aparecem aqui conforme se cadastram.')
                : t('Nothing matches.', 'Nada encontrado.')}
            </p>
          ) : (
            <table className="list">
              <thead>
                <tr>
                  <th>{tl(KINDS[kind].title)}</th>
                  <th>{t('Stage', 'Etapa')}</th>
                  <th>L-1</th>
                  <th>{t('Health', 'Saúde')}</th>
                  <th>{t('Docs', 'Docs')}</th>
                  <th>{kind === 'us' ? t('Asking price', 'Preço pedido') : t('Funds', 'Recursos')}</th>
                  <th>{t('AI', 'IA')}</th>
                  <th>{t('Status', 'Status')}</th>
                  <th>{t('Updated', 'Atualizado')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/case/${r.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/case/${r.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.company_name || r.owner_name}</div>
                      <div className="small muted">{[r.industry, r.location].filter(Boolean).join(' · ') || r.owner_email}</div>
                    </td>
                    <td className="small">
                      {r.stage}/{LAST_STAGE} · {tl(STAGES[r.stage - 1].title[r.kind])}
                    </td>
                    <td>{r.s1_rating ? <Chip tone={s1Tone[r.s1_rating]}>{tl(STAGE1_RATING[r.s1_rating])}</Chip> : <span className="faint">—</span>}</td>
                    <td>{r.s2_rating ? <Chip tone={s2Tone[r.s2_rating]}>{tl(STAGE2_RATING[r.s2_rating])}</Chip> : <span className="faint">—</span>}</td>
                    <td className="small">{r.stage >= 3 ? `${r.docs.received}/${r.docs.required}` : <span className="faint">—</span>}</td>
                    <td className="small">{r.headline_usd != null ? fmtUsd(r.headline_usd) : <span className="faint">—</span>}</td>
                    <td>
                      {r.ai_suggestion ? (
                        <Chip tone={aiTone[r.ai_suggestion]}>
                          <Sparkles size={12} /> {aiLabel[r.ai_suggestion]}
                          {r.ai_flags > 0 ? ` · ${r.ai_flags}` : ''}
                        </Chip>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                    <td>
                      <Chip tone={statusTone[r.status]}>{r.status === 'approved' ? t('In catalog', 'No catálogo') : tl(STATUS[r.status])}</Chip>
                    </td>
                    <td className="small muted">{fmtDate(r.updated_at, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
