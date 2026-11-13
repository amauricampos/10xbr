import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useSession } from './session';

export function Logo({ height = 30 }: { height?: number }) {
  return <img className="logo" src="/brand/logo-on-dark.svg" alt="10x BR" style={{ height }} />;
}

export function LangToggle() {
  const { lang, setLang } = useSession();
  return (
    <button className="btn ghost sm" onClick={() => setLang(lang === 'en' ? 'pt' : 'en')} aria-label="Change language">
      {lang === 'en' ? 'PT' : 'EN'}
    </button>
  );
}

export function Nav({ children }: { children?: ReactNode }) {
  const { user, setUser, t } = useSession();
  const navigate = useNavigate();
  const signOut = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    navigate('/');
  };
  return (
    <header className="nav">
      <div className="wrap row between">
        <Link to={user ? '/app' : '/'} aria-label="10x BR home">
          <Logo />
        </Link>
        <div className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
          {user?.role === 'staff' && (
            <>
              <NavLink className="btn ghost sm navlink" to="/staff">
                {t('Records', 'Registros')}
              </NavLink>
              {!!user.is_admin && (
                <NavLink className="btn ghost sm navlink" to="/admin">
                  {t('Admin', 'Admin')}
                </NavLink>
              )}
            </>
          )}
          {children}
          <LangToggle />
          {user ? (
            <button className="btn ghost sm" onClick={signOut}>
              <LogOut size={15} /> <span className="hide-sm">{t('Sign out', 'Sair')}</span>
            </button>
          ) : (
            <Link className="btn sm" to="/signin">
              {t('Sign in', 'Entrar')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} className="spin" aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <Spinner size={28} />
    </div>
  );
}

export function Chip({ tone, children }: { tone?: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`chip ${tone ?? ''}`}>{children}</span>;
}

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

/** Runs an async action with a busy flag and a readable error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function Disclaimer() {
  const { t } = useSession();
  return (
    <p className="tiny faint row" style={{ '--gap': '8px', alignItems: 'flex-start' } as React.CSSProperties}>
      <ShieldCheck size={14} style={{ flex: 'none', marginTop: 2 }} />
      <span>
        {t(
          '10x BR is a screening tool, not legal or investment advice. Only a licensed immigration attorney can advise on visa eligibility.',
          'A 10x BR é uma ferramenta de triagem, não aconselhamento jurídico ou de investimento. Somente um advogado de imigração habilitado pode orientar sobre elegibilidade a vistos.',
        )}
      </span>
    </p>
  );
}

export const s1Tone = { compliant: 'good', gaps: 'warn', not_compliant: 'bad' } as const;
export const s2Tone = { healthy: 'good', watch: 'warn', weak: 'bad' } as const;
export const statusTone = { active: 'info', review: 'warn', stopped: 'bad', approved: 'good', declined: 'bad' } as const;
export const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export const fmtDate = (ms: number, lang: string) =>
  new Date(ms).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const METRIC_PT: [RegExp, string][] = [
  [/\/yr$/, '/ano'],
  [/ yr$/, ' anos'],
  [/ mo$/, ' meses'],
  [/× profit$/, '× lucro'],
  [/× earnings$/, '× lucro'],
  [/^Under 20%$/, 'Menos de 20%'],
  [/^Cash only$/, 'Só à vista'],
  [/ h\/wk$/, ' h/sem'],
  [/^Current$/, 'Em dia'],
  [/^Payment plan$/, 'Parcelamento'],
  [/^Overdue$/, 'Em atraso'],
  [/^Retirement$/, 'Aposentadoria'],
  [/^New venture$/, 'Novo projeto'],
  [/^Personal$/, 'Pessoal'],
  [/^Declining$/, 'Em queda'],
];
/** Metric values are stored in English; this localizes their units and labels for display. */
export const metricValue = (value: string, lang: string) =>
  lang === 'pt' ? METRIC_PT.reduce((v, [re, to]) => v.replace(re, to), value) : value;
