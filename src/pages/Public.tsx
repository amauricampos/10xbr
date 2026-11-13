import { ArrowRight, Building2, Check, Clock, FileX, KeyRound, MailCheck, MousePointerClick, Plane } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { KINDS, scoreStage1, stage1Complete, type Kind, type Stage1Answers } from '../../shared/process';
import { api, type User } from '../api';
import { useSession } from '../session';
import { Stage1ResultView, Stage1Wizard } from '../stage1';
import { Disclaimer, Field, Nav, PageLoader, useAction } from '../ui';

const DRAFT_KEY = 'quickcheck';
type Contact = { name: string; email: string };
type Draft = { kind: Kind; answers: Stage1Answers | null; contact?: Contact | null };

export function loadDraft(): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (!d || (d.kind !== 'us' && d.kind !== 'br')) return null;
    const contact = d.contact && typeof d.contact.email === 'string' && typeof d.contact.name === 'string' ? d.contact : null;
    return { kind: d.kind, answers: d.answers && stage1Complete(d.kind, d.answers) ? d.answers : null, contact };
  } catch {
    return null;
  }
}
const saveDraft = (d: Draft) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));

export function Landing() {
  const { t, user } = useSession();
  if (user) return <Navigate to="/app" replace />;
  const facts = [
    { icon: Clock, text: t('2 minutes', '2 minutos') },
    { icon: MousePointerClick, text: t('8 questions', '8 perguntas') },
    { icon: FileX, text: t('No documents', 'Sem documentos') },
  ];
  const tracks = [
    { kind: 'us' as const, icon: Building2, title: t('United States', 'Estados Unidos'), sub: t('I own it and may sell it.', 'Sou o dono e posso vender.') },
    { kind: 'br' as const, icon: Plane, title: t('Brazil', 'Brasil'), sub: t('I want to buy a U.S. business.', 'Quero comprar um negócio nos EUA.') },
  ];
  const later = [
    { n: 2, title: t('A few numbers', 'Alguns números'), time: t('5 min', '5 min'), text: t('Revenue, profit, team size.', 'Faturamento, lucro, equipe.') },
    { n: 3, title: t('Five documents', 'Cinco documentos'), time: t('1–3 days', '1–3 dias'), text: t('Upload files you already have.', 'Envie arquivos que você já tem.') },
    { n: 4, title: t('Final checks', 'Verificações finais'), time: t('1–2 weeks', '1–2 semanas'), text: t('Owners and remaining documents.', 'Sócios e documentos restantes.') },
  ];
  const notes = [
    t('Answer for your business as it is today.', 'Responda sobre o negócio como ele é hoje.'),
    t('Answers are final. Pick carefully.', 'As respostas são definitivas. Escolha com cuidado.'),
    t('Private. Only our team sees it.', 'Privado. Só a nossa equipe vê.'),
  ];
  return (
    <>
      <Nav />
      <main className="narrow overview stack" style={{ '--gap': '28px' } as React.CSSProperties}>
        <div className="stack center" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h1>{t('Does your business qualify?', 'O seu negócio se qualifica?')}</h1>
          <p className="lead-sm">{t('Find out now. It is quick and easy.', 'Descubra agora. É rápido e fácil.')}</p>
          <div className="facts">
            {facts.map((f) => (
              <span key={f.text}>
                <f.icon size={18} /> {f.text}
              </span>
            ))}
          </div>
        </div>

        <section className="glass pad stack start-box" style={{ '--gap': '14px' } as React.CSSProperties}>
          <div className="stack" style={{ '--gap': '4px' } as React.CSSProperties}>
            <p className="eyebrow accent">{t('Start here', 'Comece aqui')}</p>
            <h2>{t('Where is your business?', 'Onde fica o seu negócio?')}</h2>
          </div>
          {tracks.map((k) => (
            <Link key={k.kind} to={`/check/${k.kind}`} className="start-card">
              <k.icon size={26} style={{ flex: 'none' }} />
              <div className="grow">
                <strong>{k.title}</strong>
                <span>{k.sub}</span>
              </div>
              <span className="go">
                {t('Start', 'Começar')} <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </section>

        <section className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <h3>{t('What to expect', 'O que esperar')}</h3>
          <div className="glass phase now">
            <span className="tag">{t('Today', 'Hoje')}</span>
            <div className="how-step">
              <span className="stage-num">1</span>
              <div className="grow">
                <div className="row between" style={{ alignItems: 'baseline' }}>
                  <strong>{t('Eight quick questions', 'Oito perguntas rápidas')}</strong>
                  <span className="tiny faint">{t('2 min', '2 min')}</span>
                </div>
                <p className="small muted">{t('One tap each. You get your result right away.', 'Um toque cada. O resultado sai na hora.')}</p>
              </div>
            </div>
          </div>
          <div className="glass phase">
            <span className="tag">{t('Later, only if you qualify', 'Depois, só se você se qualificar')}</span>
            {later.map((s) => (
              <div key={s.n} className="how-step">
                <span className="stage-num dim">{s.n}</span>
                <div className="grow">
                  <div className="row between" style={{ alignItems: 'baseline' }}>
                    <strong>{s.title}</strong>
                    <span className="tiny faint">{s.time}</span>
                  </div>
                  <p className="small muted">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>{t('Good to know', 'Bom saber')}</h3>
          <ul className="checklist">
            {notes.map((x) => (
              <li key={x}>
                <Check size={16} />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="small muted center">
          {t('Already started?', 'Já começou?')} <Link to="/signin">{t('Sign in to continue', 'Entre para continuar')}</Link>
        </p>
        <Disclaimer />
      </main>
    </>
  );
}

export function QuickCheck() {
  const { t, tl, lang, user } = useSession();
  const params = useParams();
  const kind: Kind | null = params.kind === 'us' || params.kind === 'br' ? params.kind : null;
  const [draft, setDraft] = useState<Draft | null>(() => {
    const d = loadDraft();
    return d && d.kind === kind ? d : null;
  });
  const [form, setForm] = useState<Contact>({ name: '', email: '' });
  const [emailed, setEmailed] = useState(false);
  const { busy, error, run } = useAction();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);
  useEffect(() => {
    if (kind) saveDraft(draft ?? { kind, answers: null });
  }, [kind, draft]);

  if (!kind) return <Navigate to="/" replace />;
  const answers = draft?.answers ?? null;
  const contact = draft?.contact ?? null;
  const result = answers && contact ? scoreStage1(kind, answers) : null;

  const capture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers) return;
    run(async () => {
      const c = { name: form.name.trim(), email: form.email.trim() };
      const res = await api.post<{ emailed: boolean }>('/leads', { ...c, lang, kind, s1_answers: answers });
      setEmailed(res.emailed);
      setDraft({ kind, answers, contact: c });
    });
  };

  return (
    <>
      <Nav />
      <main className="narrow" style={{ padding: '36px 0 72px' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          {tl(KINDS[kind].who)}
        </p>
        <div className="glass pad">
          {!answers ? (
            <Stage1Wizard kind={kind} onDone={(a) => setDraft({ kind, answers: a, contact: null })} />
          ) : !result ? (
            <form className="stack fade-in" style={{ '--gap': '18px' } as React.CSSProperties} onSubmit={capture}>
              <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                <h2>{t('Almost done.', 'Quase lá.')}</h2>
                <p className="muted">
                  {t(
                    'While we review and process your responses, please give us your name and email so we can send you the report.',
                    'Enquanto analisamos e processamos as suas respostas, informe seu nome e e-mail para que possamos enviar o relatório.',
                  )}
                </p>
              </div>
              <Field label={t('Full name', 'Nome completo')}>
                <input className="input" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              {error && <p className="error">{error}</p>}
              <button className="btn primary lg" disabled={busy}>
                {t('Send my scorecard', 'Enviar meu scorecard')} <ArrowRight size={18} />
              </button>
              <p className="tiny faint">{t('We use your email only to follow up on this evaluation.', 'Usamos seu e-mail apenas para dar seguimento a esta avaliação.')}</p>
            </form>
          ) : (
            <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
              {emailed && contact && (
                <div className="banner good row" style={{ '--gap': '10px' } as React.CSSProperties}>
                  <MailCheck size={18} style={{ flex: 'none' }} />
                  <span>
                    {t('We sent this scorecard to', 'Enviamos este scorecard para')} <strong>{contact.email}</strong>.
                  </span>
                </div>
              )}
              <Stage1ResultView kind={kind} result={result} />
              <Link to="/signup" className="btn primary lg">
                {result.passed ? t('Save and continue', 'Salvar e continuar') : t('Save and talk to us', 'Salvar e falar conosco')} <ArrowRight size={18} />
              </Link>
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

/** Opens the saved result from the link in the scorecard email. */
export function Resume() {
  const { id } = useParams();
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<{ kind: Kind; name: string; email: string; answers: Stage1Answers }>(`/leads/${id}`)
      .then((l) => {
        saveDraft({ kind: l.kind, answers: l.answers, contact: { name: l.name, email: l.email } });
        setTo(`/check/${l.kind}`);
      })
      .catch(() => setTo('/'));
  }, [id]);
  return to ? <Navigate to={to} replace /> : <PageLoader />;
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
  const draft = loadDraft();
  const [form, setForm] = useState({ name: draft?.contact?.name ?? '', email: draft?.contact?.email ?? '', password: '' });
  const { busy, error, run } = useAction();
  if (user) return <Navigate to="/app" replace />;
  if (!draft?.answers) return <Navigate to="/" replace />;

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
      sub={t('Choose a password. Your answers are saved to your private workspace.', 'Escolha uma senha. Suas respostas ficam salvas na sua área privada.')}
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
