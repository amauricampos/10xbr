import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { NOTIFY_EVENTS } from '../../shared/notify';
import { api } from '../api';
import { useSession } from '../session';
import { Nav, PageLoader, useAction } from '../ui';

/** Which emails the signed-in person receives. They go to the email the account signs in with. */
export function Notifications() {
  const { t, tl, user, config } = useSession();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [saved, setSaved] = useState(false);
  const { error, run } = useAction();
  useEffect(() => {
    if (user) api.get<{ prefs: Record<string, boolean> }>('/auth/notifications').then((r) => setPrefs(r.prefs)).catch(() => undefined);
  }, [user]);
  if (!user) return <Navigate to="/signin" replace />;
  if (!prefs) return <PageLoader />;
  const events = NOTIFY_EVENTS.filter((e) => e.role === user.role);

  // Each switch saves on its own, so there is no separate save step to forget.
  const toggle = (id: string) => {
    const before = prefs;
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    setSaved(false);
    run(async () => {
      try {
        setPrefs((await api.put<{ prefs: Record<string, boolean> }>('/auth/notifications', { prefs: next })).prefs);
        setSaved(true);
      } catch (e) {
        setPrefs(before);
        throw e;
      }
    });
  };

  return (
    <>
      <Nav />
      <main className="narrow stack" style={{ padding: '28px 0 64px', maxWidth: 560, '--gap': '18px' } as React.CSSProperties}>
        <Link className="btn ghost sm" to="/app" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> {user.role === 'staff' ? t('Records', 'Registros') : t('Your evaluation', 'Sua avaliação')}
        </Link>
        <h2>{t('Notifications', 'Notificações')}</h2>
        <p className="muted">
          {t('Choose the emails you want. They are sent to', 'Escolha os e-mails que você quer receber. Eles são enviados para')} <strong>{user.email}</strong>
          {t(', the email you sign in with.', ', o e-mail com que você entra.')}
        </p>
        {config.mail === false && (
          <div className="banner warn">
            {t('Email is not set up on this site yet, so nothing is sent for now. Your choices are saved and apply as soon as it is.', 'O e-mail ainda não está configurado neste site, então nada é enviado por enquanto. Suas escolhas ficam salvas e valem assim que estiver.')}
          </div>
        )}
        <section className="glass pad-sm notify-list">
          {events.map((e) => (
            <label key={e.id} className="notify-row">
              <span>
                <span style={{ fontWeight: 600, display: 'block' }}>{tl(e.title)}</span>
                <span className="small muted">{tl(e.help)}</span>
              </span>
              <input type="checkbox" role="switch" className="switch" checked={!!prefs[e.id]} onChange={() => toggle(e.id)} aria-label={tl(e.title)} />
            </label>
          ))}
        </section>
        {error && <p className="error">{error}</p>}
        <p className="small faint" aria-live="polite">
          {saved ? t('Saved.', 'Salvo.') : '\u00a0'}
        </p>
        <p className="small muted">
          {t(
            'Emails you ask for yourself, such as your scorecard or a password reset link, are always sent.',
            'E-mails que você mesmo pede, como o seu scorecard ou um link para redefinir a senha, são sempre enviados.',
          )}
        </p>
      </main>
    </>
  );
}
