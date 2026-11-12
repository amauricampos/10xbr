import QRCode from 'qrcode';
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { STAGE1_RATING, STAGE2_RATING, STAGES } from '../../shared/process';
import { api } from '../api';
import { useSession } from '../session';
import { Chip, Field, Nav, PageLoader, fmtDate, useAction } from '../ui';

type Row = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  company_name: string;
  country: string;
  stage: number;
  status: 'active' | 'stopped' | 'decided';
  s1_rating: keyof typeof STAGE1_RATING | null;
  s2_rating: keyof typeof STAGE2_RATING | null;
  verdict: string | null;
  doc_count: number;
  updated_at: number;
};

const s1Tone = { strong: 'good', possible: 'warn', not_yet: 'bad' } as const;
const s2Tone = { healthy: 'good', watch: 'warn', weak: 'bad' } as const;

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
        <strong>{t('Turn on two-step sign-in. Staff accounts can open every case.', 'Ative o login em duas etapas. Contas da equipe abrem todos os casos.')}</strong>
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

export function StaffHome() {
  const { t, tl, lang, user } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (user?.role === 'staff') api.get<{ cases: Row[] }>('/cases').then((r) => setRows(r.cases));
  }, [user]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) => (!stage || r.stage === stage) && (!needle || `${r.applicant_name} ${r.applicant_email} ${r.company_name}`.toLowerCase().includes(needle)),
    );
  }, [rows, q, stage]);

  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  if (!rows) return <PageLoader />;

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
          <div>
            <p className="eyebrow">{t('Pipeline', 'Funil')}</p>
            <h2>
              {rows.length} {rows.length === 1 ? t('case', 'caso') : t('cases', 'casos')}
            </h2>
          </div>
          <div className="affix" style={{ width: 'min(320px, 100%)' }}>
            <span>
              <Search size={16} />
            </span>
            <input className="input" placeholder={t('Search name, email or company', 'Buscar nome, e-mail ou empresa')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {STAGES.map((s) => {
            const n = rows.filter((r) => r.stage === s.id).length;
            return (
              <button
                key={s.id}
                className="glass pad-sm"
                style={{ textAlign: 'left', cursor: 'pointer', borderColor: stage === s.id ? 'var(--azure)' : undefined }}
                onClick={() => setStage(stage === s.id ? 0 : s.id)}
              >
                <div className="tiny faint">
                  {s.id} · {tl(s.title)}
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: '1.7rem', fontWeight: 600 }}>{n}</div>
              </button>
            );
          })}
        </div>

        <div className="glass" style={{ overflowX: 'auto' }}>
          {shown.length === 0 ? (
            <p className="pad muted center">{rows.length === 0 ? t('No cases yet. They appear here as applicants sign up.', 'Nenhum caso ainda. Eles aparecem aqui conforme os candidatos se cadastram.') : t('No cases match.', 'Nenhum caso encontrado.')}</p>
          ) : (
            <table className="list">
              <thead>
                <tr>
                  <th>{t('Applicant', 'Candidato')}</th>
                  <th>{t('Stage', 'Etapa')}</th>
                  <th>L-1</th>
                  <th>{t('Business', 'Negócio')}</th>
                  <th>{t('Docs', 'Docs')}</th>
                  <th>{t('Updated', 'Atualizado')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/case/${r.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/case/${r.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.applicant_name}</div>
                      <div className="small muted">{r.company_name || r.applicant_email}</div>
                    </td>
                    <td>
                      <Chip tone={r.status === 'stopped' ? 'bad' : r.status === 'decided' ? 'good' : 'info'}>
                        {r.stage} · {r.status === 'stopped' ? t('Stopped', 'Parado') : r.status === 'decided' ? t('Decided', 'Decidido') : tl(STAGES[r.stage - 1].title)}
                      </Chip>
                    </td>
                    <td>{r.s1_rating ? <Chip tone={s1Tone[r.s1_rating]}>{tl(STAGE1_RATING[r.s1_rating])}</Chip> : <span className="faint">—</span>}</td>
                    <td>{r.s2_rating ? <Chip tone={s2Tone[r.s2_rating]}>{tl(STAGE2_RATING[r.s2_rating])}</Chip> : <span className="faint">—</span>}</td>
                    <td>{r.doc_count}</td>
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
