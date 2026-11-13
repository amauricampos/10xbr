import { ArrowRight, Building2, Fingerprint, KeyRound, Lock, Plane, ScrollText, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { KINDS, STAGES, scoreStage1, stage1Complete, type Kind, type Stage1Answers } from '../../shared/process';
import { api, type User } from '../api';
import { useSession } from '../session';
import { Stage1ResultView, Stage1Wizard } from '../stage1';
import { Disclaimer, Field, Nav, useAction } from '../ui';

const DRAFT_KEY = 'quickcheck';
type Draft = { kind: Kind; answers: Stage1Answers | null };

export function loadDraft(): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (!d || (d.kind !== 'us' && d.kind !== 'br')) return null;
    return { kind: d.kind, answers: d.answers && stage1Complete(d.kind, d.answers) ? d.answers : null };
  } catch {
    return null;
  }
}
const saveDraft = (d: Draft) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));

export function Landing() {
  const { t, tl, user } = useSession();
  if (user) return <Navigate to="/app" replace />;
  const tracks = [
    { kind: 'us' as const, icon: Building2, cta: t('Check my business', 'Avaliar meu negócio') },
    { kind: 'br' as const, icon: Plane, cta: t('Check my company', 'Avaliar minha empresa') },
  ];
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
      text: t('A permanent record shows who opened, uploaded or changed anything.', 'Um registro permanente mostra quem abriu, enviou ou alterou qualquer item.'),
    },
    {
      icon: Sparkles,
      title: t('AI reads first, people decide', 'A IA lê primeiro, pessoas decidem'),
      text: t('AI takes the first pass on every answer and document. Our team reviews each step.', 'A IA faz a primeira leitura de cada resposta e documento. Nossa equipe revisa cada etapa.'),
    },
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="hero wrap">
          <p className="eyebrow">{t('L-1 business evaluation', 'Avaliação de negócios para L-1')}</p>
          <h1 style={{ marginTop: 16 }}>
            {t('Is the business', 'O negócio está')} <span className="gradient-text">{t('L-1 ready?', 'pronto para o L-1?')}</span>
          </h1>
          <p className="lead">
            {t(
              'Eight questions tell you. Numbers and documents come later, one step at a time, only if you pass.',
              'Oito perguntas respondem. Números e documentos vêm depois, um passo de cada vez, só se você passar.',
            )}
          </p>
          <div className="grid two" style={{ maxWidth: 820, margin: '0 auto', textAlign: 'left' }}>
            {tracks.map((k) => (
              <Link key={k.kind} to={`/check/${k.kind}`} className="glass track-card">
                <k.icon size={26} style={{ color: 'var(--mint)' }} />
                <h3>{tl(KINDS[k.kind].who)}</h3>
                <p className="small muted">{tl(KINDS[k.kind].blurb)}</p>
                <span className="btn primary" style={{ marginTop: 'auto' }}>
                  {k.cta} <ArrowRight size={17} />
                </span>
              </Link>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: 16 }}>
            {t('Two minutes. No account needed to see your result.', 'Dois minutos. Não precisa de conta para ver o resultado.')}
          </p>
        </section>

        <section className="wrap">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {STAGES.map((s) => (
              <div key={s.id} className="glass stage-card">
                <div className="row between">
                  <span className="stage-num">{s.id}</span>
                  <span className="tiny faint">{tl(s.time)}</span>
                </div>
                <h3 style={{ marginTop: 6 }}>{tl(s.title.us)}</h3>
                <p className="small muted">{tl(s.blurb.us)}</p>
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
  const { t, tl, user } = useSession();
  const params = useParams();
  const kind: Kind | null = params.kind === 'us' || params.kind === 'br' ? params.kind : null;
  const [answers, setAnswers] = useState<Stage1Answers | null>(() => {
    const d = loadDraft();
    return d && d.kind === kind ? d.answers : null;
  });
  const [redo, setRedo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);
  useEffect(() => {
    if (kind) saveDraft({ kind, answers });
  }, [kind, answers]);

  if (!kind) return <Navigate to="/" replace />;
  const result = answers && !redo ? scoreStage1(kind, answers) : null;

  return (
    <>
      <Nav />
      <main className="narrow" style={{ padding: '36px 0 72px' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          {tl(KINDS[kind].who)}
        </p>
        <div className="glass pad">
          {!result ? (
            <Stage1Wizard
              kind={kind}
              initial={answers}
              onDone={(a) => {
                setAnswers(a);
                setRedo(false);
              }}
            />
          ) : (
            <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
              <Stage1ResultView kind={kind} result={result} />
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
                  ? t('Next: five minutes on the business numbers.', 'Próximo passo: cinco minutos sobre os números do negócio.')
                  : t('Create an account so our team can review this and suggest a path.', 'Crie uma conta para nossa equipe revisar e sugerir um caminho.')}
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
  const draft = loadDraft();
  if (user) return <Navigate to="/app" replace />;
  if (!draft) return <Navigate to="/" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.post<{ user: User }>('/auth/register', { ...form, lang, kind: draft.kind, s1_answers: draft.answers ?? undefined });
      sessionStorage.removeItem(DRAFT_KEY);
      setUser(res.user);
      navigate('/app');
    });
  };
  if (!config.openSignup) {
    return (
      <AuthShell title={t('Sign-up is by invitation', 'Cadastro somente por convite')}>
        <p className="muted">{t('Contact 10xBR to get started.', 'Entre em contato com a 10xBR para começar.')}</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title={t('Create your secure account', 'Crie sua conta segura')}
      sub={t('Your answers are saved to your private workspace.', 'Suas respostas ficam salvas na sua área privada.')}
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
        {t('New here?', 'Novo por aqui?')} <Link to="/">{t('Start the quick check', 'Comece pela checagem rápida')}</Link>
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
