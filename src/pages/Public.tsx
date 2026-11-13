import { ArrowRight, EyeOff, Fingerprint, KeyRound, Lock, Plane, ScrollText, Sparkles, Target, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { KINDS, scoreStage1, stage1Complete, type Kind, type Stage1Answers } from '../../shared/process';
import { api, type User } from '../api';
import { useSession } from '../session';
import { Stage1ResultView, Stage1Wizard } from '../stage1';
import { Disclaimer, Field, Nav, useAction } from '../ui';

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
  const why = [
    {
      icon: Target,
      title: t('Buyers who need to close', 'Compradores que precisam fechar'),
      text: t(
        'Their move to the U.S. depends on owning an operating business. They are not browsing. They are buying.',
        'A mudança deles para os EUA depende de ter um negócio em operação. Eles não estão só olhando. Estão comprando.',
      ),
    },
    {
      icon: Wallet,
      title: t('Funds checked before you meet', 'Recursos verificados antes do contato'),
      text: t(
        'We review each buyer’s company, track record and capital before any introduction, so your time goes to real offers.',
        'Analisamos a empresa, o histórico e o capital de cada comprador antes de qualquer apresentação, para que o seu tempo vá para propostas reais.',
      ),
    },
    {
      icon: Users,
      title: t('What you built carries on', 'O que você construiu continua'),
      text: t(
        'These buyers need the business to keep running with its team. They are buying it to operate it, not to strip it.',
        'Esses compradores precisam que o negócio continue funcionando com a equipe. Compram para operar, não para desmontar.',
      ),
    },
    {
      icon: EyeOff,
      title: t('Private from start to finish', 'Sigilo do começo ao fim'),
      text: t(
        'Your business is never listed publicly. Details go only to screened buyers, under a signed NDA.',
        'O seu negócio nunca é anunciado publicamente. Os detalhes vão apenas para compradores selecionados, sob NDA assinado.',
      ),
    },
  ];
  const steps = [
    {
      time: t('2 min', '2 min'),
      title: t('See if you qualify', 'Veja se você se qualifica'),
      text: t('Eight one-tap questions. You get the answer right away.', 'Oito perguntas de um toque. A resposta sai na hora.'),
    },
    {
      time: t('5 min', '5 min'),
      title: t('Share a few numbers', 'Informe alguns números'),
      text: t('Revenue, earnings, team and asking price. Round numbers are fine.', 'Faturamento, lucro, equipe e preço pedido. Números redondos bastam.'),
    },
    {
      time: t('1–3 days', '1–3 dias'),
      title: t('Back it up', 'Comprove'),
      text: t('Sign the NDA and upload five documents you already have.', 'Assine o NDA e envie cinco documentos que você já tem.'),
    },
    {
      time: t('1–2 weeks', '1–2 semanas'),
      title: t('Meet your buyers', 'Conheça seus compradores'),
      text: t('Once verified, your business is presented to screened international buyers.', 'Depois de verificado, o seu negócio é apresentado a compradores internacionais selecionados.'),
    },
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
          <p className="eyebrow">{t('For U.S. business owners', 'Para donos de negócios nos EUA')}</p>
          <h1 style={{ marginTop: 16 }}>
            {t('You built it.', 'Você construiu.')}
            <br />
            <span className="gradient-text">{t('Now cash in.', 'Agora é hora de colher.')}</span>
          </h1>
          <p className="lead">
            {t(
              'Years of early mornings and missed weekends are worth something. Retire, enjoy it, or start your next venture. We bring you qualified international buyers who are ready to invest in a business like yours.',
              'Anos de madrugadas e fins de semana perdidos valem alguma coisa. Aposente-se, aproveite ou comece o próximo projeto. Trazemos compradores internacionais qualificados, prontos para investir em um negócio como o seu.',
            )}
          </p>
          <Link to="/check/us" className="btn primary lg">
            {t('See if my business qualifies', 'Ver se o meu negócio se qualifica')} <ArrowRight size={18} />
          </Link>
          <p className="tiny faint" style={{ marginTop: 14 }}>
            {t('Two minutes. Eight questions. Confidential.', 'Dois minutos. Oito perguntas. Confidencial.')}
          </p>
        </section>

        <section className="wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('Why international buyers', 'Por que compradores internacionais')}</p>
            <h2>{t('A bigger pool of buyers than your local market.', 'Mais compradores do que o seu mercado local oferece.')}</h2>
            <p className="muted" style={{ maxWidth: 640, margin: '0 auto' }}>
              {t(
                'Established entrepreneurs abroad use the L-1 visa and other investor routes to move to the United States by acquiring a going business. We find them, screen them and bring them to you.',
                'Empresários estabelecidos no exterior usam o visto L-1 e outras rotas de investidor para se mudar para os Estados Unidos comprando um negócio em funcionamento. Nós os encontramos, avaliamos e trazemos até você.',
              )}
            </p>
          </div>
          <div className="grid two">
            {why.map((s) => (
              <div key={s.title} className="glass feature">
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

        <section className="section wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('How it works', 'Como funciona')}</p>
            <h2>{t('Four short steps. No paperwork until you qualify.', 'Quatro passos curtos. Nenhum documento antes de se qualificar.')}</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {steps.map((s, i) => (
              <div key={s.title} className="glass stage-card">
                <div className="row between">
                  <span className="stage-num">{i + 1}</span>
                  <span className="tiny faint">{s.time}</span>
                </div>
                <h3 style={{ marginTop: 6 }}>{s.title}</h3>
                <p className="small muted">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: 28 }}>
            <Link to="/check/us" className="btn primary lg">
              {t('Start the two-minute check', 'Começar a checagem de dois minutos')} <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="wrap">
          <Link to="/check/br" className="glass buyer-card">
            <Plane size={26} style={{ color: 'var(--mint)', flex: 'none' }} />
            <div className="grow">
              <h3>{t('Own a company in Brazil?', 'Tem uma empresa no Brasil?')}</h3>
              <p className="small muted" style={{ marginTop: 4 }}>
                {t(
                  'Buy an established U.S. business and build your path to an L-1 visa. Find out in two minutes if your company qualifies.',
                  'Compre um negócio estabelecido nos EUA e construa o seu caminho para o visto L-1. Descubra em dois minutos se a sua empresa se qualifica.',
                )}
              </p>
            </div>
            <span className="btn">
              {t('Check my company', 'Avaliar minha empresa')} <ArrowRight size={17} />
            </span>
          </Link>
        </section>

        <section className="section wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('Security', 'Segurança')}</p>
            <h2>{t('Built for documents you would not email.', 'Feito para documentos que você não mandaria por e-mail.')}</h2>
          </div>
          <div className="grid two">
            {safety.map((s) => (
              <div key={s.title} className="glass feature">
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
  const { t, tl, lang, user } = useSession();
  const params = useParams();
  const kind: Kind | null = params.kind === 'us' || params.kind === 'br' ? params.kind : null;
  const [draft, setDraft] = useState<Draft | null>(() => {
    const d = loadDraft();
    return d && d.kind === kind ? d : null;
  });
  const [form, setForm] = useState<Contact>({ name: '', email: '' });
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
      await api.post('/leads', { ...c, lang, kind, s1_answers: answers });
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
                <h2>{t('Your result is ready.', 'Seu resultado está pronto.')}</h2>
                <p className="muted small">{t('Enter your name and email to see it.', 'Informe seu nome e e-mail para ver.')}</p>
              </div>
              <Field label={t('Full name', 'Nome completo')}>
                <input className="input" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              {error && <p className="error">{error}</p>}
              <button className="btn primary lg" disabled={busy}>
                {t('See my result', 'Ver meu resultado')} <ArrowRight size={18} />
              </button>
              <p className="tiny faint">{t('We use your email only to follow up on this evaluation.', 'Usamos seu e-mail apenas para dar seguimento a esta avaliação.')}</p>
            </form>
          ) : (
            <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
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
