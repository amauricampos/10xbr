import { ArrowRight, Fingerprint, KeyRound, Lock, ScrollText, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { STAGES, scoreStage1, stage1Complete, type Stage1Answers } from '../../shared/process';
import { api, type User } from '../api';
import { useSession } from '../session';
import { Stage1ResultView, Stage1Wizard } from '../stage1';
import { Disclaimer, Field, Nav, useAction } from '../ui';

const DRAFT_KEY = 'quickcheck';

export function loadDraft(): Stage1Answers | null {
  try {
    const a = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Stage1Answers | null;
    return a && stage1Complete(a) ? a : null;
  } catch {
    return null;
  }
}

export function Landing() {
  const { t, tl, user } = useSession();
  if (user) return <Navigate to="/app" replace />;
  const safety = [
    {
      icon: Lock,
      title: t('Encrypted before storage', 'Criptografado antes de armazenar'),
      text: t('Every file is sealed with AES-256 before it is saved. Downloads require your sign-in.', 'Cada arquivo é selado com AES-256 antes de ser salvo. Downloads exigem o seu login.'),
    },
    {
      icon: ScrollText,
      title: t('NDA before documents', 'NDA antes dos documentos'),
      text: t('You sign a mutual confidentiality agreement in the platform before sharing anything.', 'Você assina um acordo mútuo de confidencialidade na plataforma antes de compartilhar qualquer coisa.'),
    },
    {
      icon: Fingerprint,
      title: t('Every access is logged', 'Todo acesso é registrado'),
      text: t('An append-only record shows who opened, uploaded or changed anything in your case.', 'Um registro imutável mostra quem abriu, enviou ou alterou qualquer item do seu caso.'),
    },
    {
      icon: Sparkles,
      title: t('AI reads, people decide', 'A IA lê, pessoas decidem'),
      text: t('AI summarizes documents and flags gaps. A person reviews every assessment.', 'A IA resume documentos e aponta lacunas. Uma pessoa revisa cada avaliação.'),
    },
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="hero wrap">
          <p className="eyebrow">{t('L-1 visa feasibility', 'Viabilidade do visto L-1')}</p>
          <h1 style={{ marginTop: 16 }}>
            {t('Know if your L-1 plan works', 'Saiba se o seu plano L-1 funciona')}
            <br />
            <span className="gradient-text">{t('before you spend on it.', 'antes de investir nele.')}</span>
          </h1>
          <p className="lead">
            {t(
              'Start with nine questions. Go deeper only when you pass each gate: your business numbers, then documents, then full verification.',
              'Comece com nove perguntas. Avance só quando passar em cada etapa: os números do negócio, depois documentos, depois verificação completa.',
            )}
          </p>
          <Link to="/check" className="btn primary lg">
            {t('Start the 2-minute check', 'Começar a checagem de 2 minutos')} <ArrowRight size={18} />
          </Link>
          <p className="tiny faint" style={{ marginTop: 14 }}>
            {t('Free. No account needed to see your result.', 'Gratuito. Não precisa de conta para ver o resultado.')}
          </p>
        </section>

        <section className="wrap">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {STAGES.map((s) => (
              <div key={s.id} className="glass stage-card">
                <div className="row between">
                  <span className="stage-num">{s.id}</span>
                  {tl(s.time) && <span className="tiny faint">{tl(s.time)}</span>}
                </div>
                <h3 style={{ marginTop: 6 }}>{tl(s.title)}</h3>
                <p className="small muted">{tl(s.blurb)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('Security', 'Segurança')}</p>
            <h2>{t('Built for documents you would not email.', 'Feito para documentos que você não mandaria por e-mail.')}</h2>
          </div>
          <div className="grid two">
            {safety.map((s) => (
              <div key={s.title} className="glass pad-sm row" style={{ alignItems: 'flex-start', '--gap': '14px', padding: 22 } as React.CSSProperties}>
                <s.icon size={22} style={{ flex: 'none', color: 'var(--mint)', marginTop: 2 }} />
                <div>
                  <h3>{s.title}</h3>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {s.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="foot">
        <div className="wrap stack">
          <Disclaimer />
          <div className="row between wrapping">
            <span>© {new Date().getFullYear()} 10xBR</span>
            <Link to="/brand">{t('Brand', 'Marca')}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

export function QuickCheck() {
  const { t, user } = useSession();
  const [answers, setAnswers] = useState<Stage1Answers | null>(loadDraft);
  const [redo, setRedo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  const done = (a: Stage1Answers) => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(a));
    setAnswers(a);
    setRedo(false);
  };
  const result = answers && !redo ? scoreStage1(answers) : null;

  return (
    <>
      <Nav />
      <main className="narrow" style={{ padding: '36px 0 72px' }}>
        <div className="glass pad">
          {!result ? (
            <Stage1Wizard initial={answers} onDone={done} />
          ) : (
            <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
              <Stage1ResultView result={result} />
              <div className="row wrapping">
                <Link to="/signup" className="btn primary lg grow">
                  {result.passed ? t('Save and continue', 'Salvar e continuar') : t('Save and talk to us', 'Salvar e falar conosco')} <ArrowRight size={18} />
                </Link>
                <button className="btn ghost" onClick={() => setRedo(true)}>
                  {t('Change answers', 'Alterar respostas')}
                </button>
              </div>
              <p className="small muted">
                {result.passed
                  ? t('Next: a five-minute snapshot of your business numbers.', 'Próximo passo: um retrato de cinco minutos dos números do seu negócio.')
                  : t('Create an account so our team can review your case and suggest a path.', 'Crie uma conta para nossa equipe revisar seu caso e sugerir um caminho.')}
              </p>
            </div>
          )}
        </div>
        <div style={{ marginTop: 18 }}>
          <Disclaimer />
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */

function AuthShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="narrow" style={{ padding: '48px 0 72px', maxWidth: 460 }}>
        <div className="glass pad stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <h2>{title}</h2>
            {sub && <p className="muted small">{sub}</p>}
          </div>
          {children}
        </div>
      </main>
    </>
  );
}

export function SignUp() {
  const { t, lang, setUser, user, config } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { busy, error, run } = useAction();
  if (user) return <Navigate to="/app" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.post<{ user: User }>('/auth/register', { ...form, lang, s1_answers: loadDraft() ?? undefined });
      sessionStorage.removeItem(DRAFT_KEY);
      setUser(res.user);
      navigate('/app');
    });
  };
  if (!config.openSignup) {
    return (
      <AuthShell title={t('Sign-up is by invitation', 'Cadastro somente por convite')}>
        <p className="muted">{t('Contact 10xBR to open a case.', 'Entre em contato com a 10xBR para abrir um caso.')}</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title={t('Create your secure account', 'Crie sua conta segura')}
      sub={t('Your answers are saved to your private case.', 'Suas respostas ficam salvas no seu caso privado.')}
    >
      <form className="stack" onSubmit={submit}>
        <Field label={t('Full name', 'Nome completo')}>
          <input className="input" required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('Password', 'Senha')} help={t('At least 10 characters.', 'Pelo menos 10 caracteres.')}>
          <input
            className="input"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="error">{error}</p>}
        <button className="btn primary lg" disabled={busy}>
          {t('Create account', 'Criar conta')}
        </button>
      </form>
      <p className="small muted center">
        {t('Already have an account?', 'Já tem conta?')} <Link to="/signin">{t('Sign in', 'Entrar')}</Link>
      </p>
    </AuthShell>
  );
}

export function SignIn() {
  const { t, setUser, user, config } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [needCode, setNeedCode] = useState(false);
  const { busy, error, run, setError } = useAction();
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      try {
        const res = await api.post<{ user: User }>('/auth/login', { email: form.email, password: form.password, code: needCode ? form.code : undefined });
        setUser(res.user);
        navigate('/app');
      } catch (err) {
        if ((err as { code?: string }).code === 'totp_required') {
          setNeedCode(true);
          setError('');
          return;
        }
        throw err;
      }
    });
  };
  return (
    <AuthShell title={t('Welcome back', 'Bem-vindo de volta')}>
      <form className="stack" onSubmit={submit}>
        <Field label="Email">
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('Password', 'Senha')}>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {needCode && (
          <Field label={t('6-digit code from your authenticator app', 'Código de 6 dígitos do seu app autenticador')}>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={7}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn primary lg" disabled={busy}>
          {t('Sign in', 'Entrar')}
        </button>
      </form>
      <p className="small muted center">
        {t('New here?', 'Novo por aqui?')} <Link to="/check">{t('Start the quick check', 'Comece pela checagem rápida')}</Link>
      </p>
      {config.setupNeeded && (
        <p className="tiny faint center">
          <Link to="/setup">{t('First-time staff setup', 'Configuração inicial da equipe')}</Link>
        </p>
      )}
    </AuthShell>
  );
}

export function Setup() {
  const { t, setUser, config, refresh } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ token: '', name: '', email: '', password: '' });
  const { busy, error, run } = useAction();
  if (!config.setupNeeded) return <Navigate to="/signin" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.post<{ user: User }>('/auth/setup', form);
      setUser(res.user);
      await refresh();
      navigate('/staff');
    });
  };
  return (
    <AuthShell
      title={t('Set up the first staff account', 'Configurar a primeira conta da equipe')}
      sub={t('This works once, with the setup token from your deployment.', 'Funciona uma única vez, com o token de configuração da sua implantação.')}
    >
      <form className="stack" onSubmit={submit}>
        <Field label={t('Setup token', 'Token de configuração')}>
          <div className="affix">
            <span>
              <KeyRound size={16} />
            </span>
            <input className="input" type="password" required value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
          </div>
        </Field>
        <Field label={t('Full name', 'Nome completo')}>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('Password', 'Senha')} help={t('At least 10 characters.', 'Pelo menos 10 caracteres.')}>
          <input className="input" type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <p className="error">{error}</p>}
        <button className="btn primary lg" disabled={busy}>
          {t('Create staff account', 'Criar conta da equipe')}
        </button>
      </form>
    </AuthShell>
  );
}
