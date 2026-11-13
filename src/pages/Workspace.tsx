import { ArrowRight, Check, FileText, Lock, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  FIELDS,
  KINDS,
  LAST_STAGE,
  STAGE2_RATING,
  STAGES,
  STATUS,
  scoreStage2,
  stage2Complete,
  type FieldDef,
  type Kind,
  type Stage2Answers,
  type Stage2Result,
} from '../../shared/process';
import { api, type Case } from '../api';
import { useSession } from '../session';
import { Stage1ResultView, Stage1Wizard } from '../stage1';
import { Chip, Disclaimer, Field, Nav, PageLoader, metricValue, s2Tone, statusTone, useAction } from '../ui';
import { AuditLog, DocumentsPanel, VerificationPanel } from './Docs';
import { ReviewCard } from './Review';

export type PanelProps = { c: Case; staff: boolean; reload: () => Promise<void>; go: (stage: number) => void };

/** Owners land here; it resolves their evaluation. */
export function AppHome() {
  const { user } = useSession();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (user?.role === 'applicant') api.get<{ cases: { id: string }[] }>('/cases').then((r) => setId(r.cases[0]?.id ?? ''));
  }, [user]);
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role === 'staff') return <Navigate to="/staff" replace />;
  if (id === null) return <PageLoader />;
  return <Workspace caseId={id} />;
}

export function StaffCase() {
  const { user } = useSession();
  const { id } = useParams();
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  return <Workspace caseId={id!} />;
}

export function useCase(caseId: string) {
  const [c, setC] = useState<Case | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try {
      const res = await api.get<{ case: Case }>(`/cases/${caseId}`);
      setC(res.case);
    } catch {
      setFailed(true);
    }
  }, [caseId]);
  useEffect(() => {
    reload();
  }, [reload]);

  // While AI is still reading, refresh quietly.
  const reading = c?.ai_review_status === 'running' || c?.documents.some((d) => d.ai_status === 'pending' || d.ai_status === 'running');
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [reading, reload]);
  return { c, failed, reload };
}

export function NotFound() {
  const { t } = useSession();
  return (
    <>
      <Nav />
      <main className="narrow" style={{ padding: '64px 0' }}>
        <div className="glass pad center">{t('This record could not be found.', 'Este registro não foi encontrado.')}</div>
      </main>
    </>
  );
}

function Workspace({ caseId }: { caseId: string }) {
  const { t, tl, user } = useSession();
  const staff = user?.role === 'staff';
  const { c, failed, reload } = useCase(caseId);
  const [view, setView] = useState<number | null>(null);

  if (failed) return <NotFound />;
  if (!c) return <PageLoader />;

  const current = view ?? c.stage;
  const props: PanelProps = { c, staff, reload, go: setView };

  return (
    <>
      <Nav />
      <main className="wrap">
        <div className="row between wrapping" style={{ paddingTop: 24 }}>
          <div>
            <p className="eyebrow">{tl(KINDS[c.kind].title)}</p>
            <h2>{c.company_name || (staff ? c.owner?.name : t('Your evaluation', 'Sua avaliação'))}</h2>
            <p className="small muted">{[staff && c.owner && `${c.owner.name} · ${c.owner.email}`, c.industry, c.location].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="row wrapping">
            <Chip tone={statusTone[c.status]}>
              <i className="dot" /> {tl(STATUS[c.status])}
            </Chip>
            {staff && (
              <>
                <Link className="btn sm" to={`/report/${c.id}`}>
                  <FileText size={15} /> {t('Report', 'Relatório')}
                </Link>
                <Link className="btn sm" to="/staff">
                  {t('Dashboard', 'Painel')}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="workspace">
          <nav className="glass steps" aria-label={t('Stages', 'Etapas')}>
            {STAGES.map((s) => {
              const done = c.stage > s.id || c.status === 'approved';
              const now = c.stage === s.id && !done;
              const stopped = now && (c.status === 'stopped' || c.status === 'declined');
              const locked = c.stage < s.id;
              return (
                <button
                  key={s.id}
                  className={`step ${stopped ? 'stopped' : done ? 'done' : now ? 'now' : ''}`}
                  aria-current={current === s.id ? 'step' : undefined}
                  disabled={locked}
                  onClick={() => setView(s.id)}
                >
                  <span className="badge">{stopped ? <X size={15} /> : done ? <Check size={15} /> : locked ? <Lock size={13} /> : s.id}</span>
                  <span>
                    <span className="t" style={{ display: 'block' }}>
                      {tl(s.title[c.kind])}
                    </span>
                    <span className="s">{tl(s.time)}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
            {staff ? <ReviewCard c={c} reload={reload} /> : <OwnerBanner c={c} />}
            <section className="glass pad fade-in" key={current}>
              {current === 1 && <Stage1Panel {...props} />}
              {current === 2 && <Stage2Panel {...props} />}
              {current === 3 && <DocumentsPanel {...props} />}
              {current === 4 && <VerificationPanel {...props} />}
            </section>
            {staff && <AuditLog caseId={c.id} stamp={c.updated_at} />}
            <Disclaimer />
          </div>
        </div>
      </main>
    </>
  );
}

/** One line telling the owner where things stand. */
function OwnerBanner({ c }: { c: Case }) {
  const { t } = useSession();
  const note = c.team_note && (
    <p style={{ whiteSpace: 'pre-wrap' }}>
      <strong>{t('Note from our team:', 'Nota da nossa equipe:')}</strong> {c.team_note}
    </p>
  );
  if (c.status === 'approved') {
    return (
      <div className="banner good">
        {c.kind === 'us'
          ? t('Approved. Your business is in our catalog and can be presented to screened L-1 candidates.', 'Aprovado. Seu negócio está no nosso catálogo e pode ser apresentado a candidatos L-1 avaliados.')
          : t('Approved. You are in our candidate catalog and can be matched with a U.S. business.', 'Aprovado. Você está no nosso catálogo de candidatos e pode ser combinado com um negócio nos EUA.')}
      </div>
    );
  }
  if (c.status === 'declined') {
    return (
      <div className="banner bad stack" style={{ '--gap': '6px' } as React.CSSProperties}>
        <span>{t('We are not moving forward with this evaluation.', 'Não vamos seguir com esta avaliação.')}</span>
        {note}
      </div>
    );
  }
  if (c.status === 'review') {
    return <div className="banner">{t('With our team for review. Nothing is needed from you right now.', 'Com a nossa equipe para revisão. Nada é necessário de você agora.')}</div>;
  }
  if (c.status === 'stopped') {
    return (
      <div className="banner bad">
        {t(
          'This step did not pass, so the evaluation is paused here. Our team reviews every paused evaluation and will reach out if there is a path forward.',
          'Esta etapa não foi aprovada, então a avaliação está pausada aqui. Nossa equipe revisa toda avaliação pausada e entrará em contato se houver um caminho.',
        )}
      </div>
    );
  }
  return c.team_note ? <div className="banner">{note}</div> : null;
}

export function PanelHead({ c, stage, children }: { c: Case; stage: number; children?: React.ReactNode }) {
  const { tl } = useSession();
  const s = STAGES[stage - 1];
  return (
    <div className="row between wrapping" style={{ marginBottom: 22, alignItems: 'flex-start' }}>
      <div>
        <p className="eyebrow">
          {stage} / {LAST_STAGE}
        </p>
        <h2 style={{ marginTop: 4 }}>{tl(s.title[c.kind])}</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          {tl(s.blurb[c.kind])}
        </p>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage 1                                                             */
/* ------------------------------------------------------------------ */

function Stage1Panel({ c, staff, reload, go }: PanelProps) {
  const { t } = useSession();
  const { error, run } = useAction();

  if (!c.s1_result && !staff) {
    return (
      <>
        <PanelHead c={c} stage={1} />
        <Stage1Wizard
          kind={c.kind}
          onDone={(answers) =>
            run(async () => {
              await api.put(`/cases/${c.id}/stage1`, { answers });
              go(1);
              await reload();
            })
          }
        />
        {error && <p className="error">{error}</p>}
      </>
    );
  }
  if (!c.s1_result) {
    return (
      <>
        <PanelHead c={c} stage={1} />
        <p className="muted">{t('Not answered yet.', 'Ainda não respondido.')}</p>
      </>
    );
  }
  return (
    <>
      <PanelHead c={c} stage={1} />
      <Stage1ResultView kind={c.kind} result={c.s1_result} />
      {!staff && c.stage === 2 && c.status === 'active' && (
        <button className="btn primary lg" style={{ marginTop: 24 }} onClick={() => go(2)}>
          {t('Continue to business health', 'Continuar para saúde do negócio')} <ArrowRight size={18} />
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stage 2                                                             */
/* ------------------------------------------------------------------ */

function NumberInput({ def, value, onChange }: { def: FieldDef; value: number | undefined; onChange: (n: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : value.toLocaleString('en-US'));
  const parseNum = (s: string) => {
    const neg = def.allowNegative && s.trim().startsWith('-');
    const digits = s.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    return (neg ? -1 : 1) * Number(digits);
  };
  const input = (
    <input
      className="input"
      name={def.id}
      inputMode={def.allowNegative ? 'text' : 'numeric'}
      placeholder="0"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
      onBlur={() => {
        const n = parseNum(text);
        setText(n === undefined ? '' : n.toLocaleString('en-US'));
      }}
    />
  );
  return def.kind === 'money' || def.unit === '%' ? (
    <div className="affix">
      <span>{def.unit}</span>
      {input}
    </div>
  ) : (
    input
  );
}

function Stage2Form({ c, onSaved }: { c: Case; onSaved: () => Promise<void> }) {
  const { t, tl } = useSession();
  const fields = FIELDS[c.kind];
  const [company, setCompany] = useState(c.company_name);
  const [location, setLocation] = useState(c.location);
  const [industry, setIndustry] = useState(c.industry);
  const [a, setA] = useState<Stage2Answers>(c.s2_answers ?? {});
  const { busy, error, run } = useAction();

  const set = (id: string, v: number | string | undefined) =>
    setA((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return next;
    });
  const ready = company.trim() && location.trim().length >= 2 && industry.trim().length >= 2 && stage2Complete(c.kind, a);

  return (
    <form
      className="stack"
      style={{ '--gap': '22px' } as React.CSSProperties}
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api.put(`/cases/${c.id}/stage2`, { company_name: company, location, industry, answers: a });
          await onSaved();
        });
      }}
    >
      <div className="grid three">
        <Field label={c.kind === 'us' ? t('Business name', 'Nome do negócio') : t('Company name', 'Nome da empresa')}>
          <input className="input" name="company" required maxLength={160} value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field label={t('What it does', 'O que faz')}>
          <input
            className="input"
            name="industry"
            required
            maxLength={120}
            placeholder={c.kind === 'us' ? t('e.g. HVAC services', 'ex.: serviços de climatização') : t('e.g. logistics', 'ex.: logística')}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </Field>
        <Field label={t('City and state', 'Cidade e estado')}>
          <input className="input" name="location" required maxLength={120} placeholder={c.kind === 'us' ? 'Orlando, FL' : 'Curitiba, PR'} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </div>
      <div className="grid two">
        {fields.map((f) => (
          <Field key={f.id} label={tl(f.label)} help={tl(f.help)}>
            {f.kind === 'choice' ? (
              <div className="seg">
                {f.options!.map((o) => (
                  <button type="button" key={o.value} aria-pressed={a[f.id] === o.value} onClick={() => set(f.id, o.value)}>
                    {tl(o.label)}
                  </button>
                ))}
              </div>
            ) : (
              <NumberInput def={f} value={a[f.id] as number | undefined} onChange={(n) => set(f.id, n)} />
            )}
          </Field>
        ))}
      </div>
      <p className="help">{t('Round numbers are fine. Documents confirm them later.', 'Números arredondados bastam. Os documentos confirmam depois.')}</p>
      {error && <p className="error">{error}</p>}
      <div>
        <button className="btn primary lg" disabled={busy || !ready}>
          {t('See the result', 'Ver o resultado')} <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}

const gradeTone = { good: 'good', ok: 'warn', weak: 'bad' } as const;
const ringColor = { healthy: 'var(--good)', watch: 'var(--warn)', weak: 'var(--bad)' } as const;

export function Stage2ResultView({ kind, result }: { kind: Kind; result: Stage2Result }) {
  const { t, tl, lang } = useSession();
  const gradeLabel = { good: t('Good', 'Bom'), ok: t('Fair', 'Regular'), weak: t('Weak', 'Fraco') };
  const head =
    kind === 'us'
      ? {
          healthy: t('The numbers show a healthy business at a fair price.', 'Os números mostram um negócio saudável a um preço justo.'),
          watch: t('The numbers work, with points a buyer will question.', 'Os números funcionam, com pontos que um comprador vai questionar.'),
          weak: t('The numbers do not support a sale to an L-1 investor yet.', 'Os números ainda não sustentam uma venda a um investidor L-1.'),
        }
      : {
          healthy: t('The numbers show a healthy company that can fund an acquisition.', 'Os números mostram uma empresa saudável, capaz de financiar uma aquisição.'),
          watch: t('The numbers work, with points to watch.', 'Os números funcionam, com pontos de atenção.'),
          weak: t('The numbers do not support an acquisition yet.', 'Os números ainda não sustentam uma aquisição.'),
        };
  return (
    <div className="stack fade-in" style={{ '--gap': '22px' } as React.CSSProperties}>
      <div className="row" style={{ '--gap': '20px' } as React.CSSProperties}>
        <div className="ring" style={{ '--p': result.score, '--c': ringColor[result.rating] } as React.CSSProperties}>
          <span>{result.score}</span>
        </div>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <div>
            <Chip tone={s2Tone[result.rating]}>
              <i className="dot" /> {tl(STAGE2_RATING[result.rating])}
            </Chip>
          </div>
          <h2>{head[result.rating]}</h2>
        </div>
      </div>
      <div className="grid three">
        {result.metrics.map((m) => (
          <div key={m.id} className="inset metric">
            <div className="row between">
              <span className="small muted">{tl(m.label)}</span>
              <Chip tone={gradeTone[m.grade]}>{gradeLabel[m.grade]}</Chip>
            </div>
            <span className="v">{metricValue(m.value, lang)}</span>
            <span className="tiny faint">{tl(m.note)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stage2Panel({ c, staff, reload, go }: PanelProps) {
  const { t } = useSession();
  const [editing, setEditing] = useState(false);
  const editable = !staff && c.stage >= 2 && c.stage <= 3 && (c.status === 'active' || c.status === 'stopped');

  // Staff see the score even if the owner's last edit cleared it.
  const result = c.s2_result ?? (c.s2_answers && safeScore(c.kind, c.s2_answers));

  if ((!result || editing) && editable) {
    return (
      <>
        <PanelHead c={c} stage={2} />
        <Stage2Form
          c={c}
          onSaved={async () => {
            // Stay on this stage so the result is seen before the next one opens.
            go(2);
            setEditing(false);
            await reload();
          }}
        />
      </>
    );
  }
  if (!result) {
    return (
      <>
        <PanelHead c={c} stage={2} />
        <p className="muted">{t('Not filled in yet.', 'Ainda não preenchido.')}</p>
      </>
    );
  }
  return (
    <>
      <PanelHead c={c} stage={2}>
        {editable && (
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> {t('Edit numbers', 'Editar números')}
          </button>
        )}
      </PanelHead>
      <Stage2ResultView kind={c.kind} result={result} />
      {!staff && c.stage === 3 && c.status === 'active' && (
        <button className="btn primary lg" style={{ marginTop: 24 }} onClick={() => go(3)}>
          {t('Continue to documents', 'Continuar para documentos')} <ArrowRight size={18} />
        </button>
      )}
    </>
  );
}

function safeScore(kind: Kind, a: Stage2Answers): Stage2Result | null {
  try {
    return scoreStage2(kind, a);
  } catch {
    return null;
  }
}
