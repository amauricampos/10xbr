import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, type User } from '../api';
import { useSession } from '../session';
import { Field, Nav, PasswordInput, useAction } from '../ui';

/** The signed-in person's own details and password. */
export function Account() {
  const { t, user, setUser, setLang } = useSession();
  const [profile, setProfile] = useState({ name: user?.name ?? '', lang: user?.lang ?? 'en' });
  const [pw, setPw] = useState({ current: '', password: '' });
  const [saved, setSaved] = useState<'profile' | 'password' | null>(null);
  const prof = useAction();
  const pass = useAction();
  if (!user) return <Navigate to="/signin" replace />;
  const dirty = profile.name.trim() !== user.name || profile.lang !== user.lang;

  return (
    <>
      <Nav />
      <main className="narrow stack" style={{ padding: '28px 0 64px', maxWidth: 560, '--gap': '18px' } as React.CSSProperties}>
        <Link className="btn ghost sm" to="/app" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> {user.role === 'staff' ? t('Records', 'Registros') : t('Your evaluation', 'Sua avaliação')}
        </Link>
        <h2>{t('Your account', 'Sua conta')}</h2>

        <form
          className="glass pad stack"
          onSubmit={(e) => {
            e.preventDefault();
            prof.run(async () => {
              const r = await api.put<{ user: User }>('/auth/profile', { name: profile.name.trim(), lang: profile.lang });
              setUser(r.user);
              setLang(r.user.lang);
              setSaved('profile');
            });
          }}
        >
          <h3>{t('Profile', 'Perfil')}</h3>
          <Field label={t('Full name', 'Nome completo')}>
            <input className="input" required minLength={2} maxLength={120} autoComplete="name" value={profile.name} onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setSaved(null); }} />
          </Field>
          <Field label="Email" help={t('This is how you sign in. To change it, ask our team.', 'É assim que você entra. Para alterar, fale com a nossa equipe.')}>
            <input className="input" value={user.email} readOnly disabled />
          </Field>
          <Field label={t('Language', 'Idioma')} help={t('Used on this site and in the emails we send you.', 'Usado neste site e nos e-mails que enviamos.')}>
            <div className="seg">
              {(['en', 'pt'] as const).map((l) => (
                <button type="button" key={l} aria-pressed={profile.lang === l} onClick={() => { setProfile({ ...profile, lang: l }); setSaved(null); }}>
                  {l === 'en' ? 'English' : 'Português'}
                </button>
              ))}
            </div>
          </Field>
          {prof.error && <p className="error">{prof.error}</p>}
          <div>
            <button className="btn primary" disabled={prof.busy || !dirty}>
              {saved === 'profile' && !dirty ? <Check size={15} /> : null} {saved === 'profile' && !dirty ? t('Saved', 'Salvo') : t('Save profile', 'Salvar perfil')}
            </button>
          </div>
        </form>

        <form
          className="glass pad stack"
          onSubmit={(e) => {
            e.preventDefault();
            pass.run(async () => {
              await api.post('/auth/password', pw);
              setPw({ current: '', password: '' });
              setSaved('password');
            });
          }}
        >
          <h3>{t('Password', 'Senha')}</h3>
          <Field label={t('Current password', 'Senha atual')}>
            <PasswordInput required maxLength={200} autoComplete="current-password" value={pw.current} onChange={(e) => { setPw({ ...pw, current: e.target.value }); setSaved(null); }} />
          </Field>
          <Field label={t('New password', 'Nova senha')} help={t('At least 10 characters.', 'Pelo menos 10 caracteres.')}>
            <PasswordInput required minLength={10} maxLength={200} autoComplete="new-password" value={pw.password} onChange={(e) => { setPw({ ...pw, password: e.target.value }); setSaved(null); }} />
          </Field>
          {pass.error && <p className="error">{pass.error}</p>}
          {saved === 'password' && <div className="banner good">{t('Password changed. Other devices were signed out.', 'Senha alterada. Os outros dispositivos foram desconectados.')}</div>}
          <div>
            <button className="btn primary" disabled={pass.busy}>
              {t('Change password', 'Alterar senha')}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
