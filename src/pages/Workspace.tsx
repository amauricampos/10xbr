import { ArrowRight, Check, Lock, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  CURRENCIES,
  STAGE2_RATING,
  STAGES,
  scoreStage2,
  stage2Complete,
  stage2Fields,
  type FieldDef,
  type Stage2Answers,
  type Stage2Result,
  type UsPlan,
} from '../../shared/process';
import { api, type Case } from '../api';
import { useSession } from '../session';
import { Stage1ResultView, Stage1Wizard } from '../stage1';
import { Chip, Disclaimer, Field, Nav, PageLoader, useAction } from '../ui';
import { AuditLog, DecisionPanel, EssentialsPanel, VerificationPanel } from './Docs';

export type PanelProps = { c: Case; staff: boolean; reload: () => Promise<void>; go: (stage: number) => void };

/** Applicants land here; it resolves their single case. */
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

function Workspace({ caseId }: { caseId: string }) {
  const { t, tl, user } = useSession();
  const staff = user?.role === 'staff';
  const [c, setC] = useState<Case | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<number | null>(null);

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

  // While AI is still reading a document, refresh quietly.
  const reading = c?.documents.some((d) => d.ai_status === 'pending' || d.ai_status === 'running');
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [reading, reload]);

  if (failed) {
    return (
      <>
        <Nav />
        <main className="narrow" style={{ padding: '64px 0' }}>
          <div className="glass pad center">{t('This case could not be found.', 'Este caso não foi encontrado.')}</div>
        </main>
      </>
    );
  }
  if (!c) return <PageLoader />;

  const current = view ?? c.stage;
  const props: PanelProps = { c, staff, reload, go: setView };

  return (
    <>
      <Nav />
      <main className="wrap">
        {staff && c.applicant && (
          <div className="row between wrapping" style={{ paddingTop: 24 }}>
            <div>
              <p className="eyebrow">{t('Case', 'Caso')}</p>
              <h2>{c.applicant.name}</h2>
              <p className="small muted">
                {c.applicant.email}
                {c.company_name && ` · ${c.company_name}`}
                {c.country && ` · ${c.country}`}
              </p>
            </div>
            <Link className="btn sm" to="/staff">
              {t('All cases', 'Todos os casos')}
            </Link>
          </div>
        )}
        <div className="workspace">
          <nav className="glass steps" aria-label={t('Stages', 'Etapas')}>
            {STAGES.map((s) => {
              const done = c.stage > s.id || c.status === 'decided';
              const now = c.stage === s.id && c.status !== 'decided';
              const stopped = now && c.status === 'stopped';
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
                      {tl(s.title)}
                    </span>
                    <span className="s">{tl(s.time)}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
            {c.status === 'stopped' && current === c.stage && <StoppedBanner {...props} />}
            <section className="glass pad fade-in" key={current}>
              {current === 1 && <Stage1Panel {...props} />}
              {current === 2 && <Stage2Panel {...props} />}
              {current === 3 && <EssentialsPanel {...props} />}
              {current === 4 && <VerificationPanel {...props} />}
              {current === 5 && <DecisionPanel {...props} />}
            </section>
            {staff && <AuditLog caseId={c.id} stamp={c.updated_at} />}
            <Disclaimer />
          </div>
        </div>
      </main>
    </>
  );
}

function StoppedBanner({ c, staff, reload }: PanelProps) {
  const { t } = useSession();
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  if (!staff) {
    return (
      <div className="banner bad">
        {t(
          'This step did not pass, so your case is paused here. If something changes, update your answers. Our team also reviews paused cases and may reach out.',
          'Esta etapa não foi aprovada, então seu caso está pausado aqui. Se algo mudar, atualize suas respostas. Nossa equipe também revisa casos pausados e pode entrar em contato.',
        )}
      </div>
    );
  }
  return (
    <div className="banner bad stack">
      <strong>{t(`Stopped at stage ${c.stage}. Nothing further is collected unless you override.`, `Parado na etapa ${c.stage}. Nada mais é coletado sem sua liberação.`)}</strong>
      <textarea
        className="textarea"
        style={{ minHeight: 70 }}
        placeholder={t('Reason for overriding the gate (kept in the audit log)', 'Motivo para liberar a etapa (fica no registro de auditoria)')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <div>
        <button
          className="btn sm"
          disabled={busy || reason.trim().length < 10}
          onClick={() => run(async () => { await api.post(`/cases/${c.id}/override`, { reason }); await reload(); })}
        >
          {t('Override and continue', 'Liberar e continuar')}
        </button>
      </div>
    </div>
  );
}

function PanelHead({ stage, children }: { stage: number; children?: React.ReactNode }) {
  const { tl } = useSession();
  const s = STAGES[stage - 1];
  return (
    <div className="row between wrapping" style={{ marginBottom: 22, alignItems: 'flex-start' }}>
      <div>
        <p className="eyebrow">
          {stage} / {STAGES.length}
        </p>
        <h2 style={{ marginTop: 4 }}>{tl(s.title)}</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          {tl(s.blurb)}
        </p>
      </div>
      {children}
    </div>
  );
}
export { PanelHead };

function Stage1Panel({ c, reload, go }: PanelProps) {
  const { t } = useSession();
  const [editing, setEditing] = useState(false);
  const { error, run } = useAction();
  const editable = c.stage <= 2 && c.status !== 'decided';

  if (!c.s1_result || editing) {
    return (
      <>
        <PanelHead stage={1} />
        <Stage1Wizard
          initial={c.s1_answers}
          onDone={(answers) =>
            run(async () => {
              await api.put(`/cases/${c.id}/stage1`, { answers });
              go(1);
              setEditing(false);
              await reload();
            })
          }
        />
        {error && <p className="error">{error}</p>}
      </>
    );
  }
  return (
    <>
      <PanelHead stage={1}>
        {editable && (
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> {t('Change answers', 'Alterar respostas')}
          </button>
        )}
      </PanelHead>
      <Stage1ResultView result={c.s1_result} />
      {c.stage === 2 && c.status === 'active' && (
        <button className="btn primary lg" style={{ marginTop: 24 }} onClick={() => go(2)}>
          {t('Continue to business snapshot', 'Continuar para o retrato do negócio')} <ArrowRight size={18} />
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stage 2                                                             */
/* ------------------------------------------------------------------ */

function NumberInput({ def, currency, value, onChange }: { def: FieldDef; currency: string; value: number | undefined; onChange: (n: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : value.toLocaleString('en-US'));
  const prefix = def.unit === 'usd' ? 'USD' : def.unit === 'local' ? (currency === 'Other' ? '' : currency) : '';
  const parseNum = (s: string) => {
    const neg = def.allowNegative && s.trim().startsWith('-');
    const digits = s.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    return (neg ? -1 : 1) * Number(digits);
  };
  const input = (
    <input
      className="input"
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
  return prefix ? (
    <div className="affix">
      <span>{prefix}</span>
      {input}
    </div>
  ) : (
    input
  );
}

function Stage2Form({ c, onSaved }: { c: Case; onSaved: () => Promise<void> }) {
  const { t, tl } = useSession();
  const plan = (c.s1_answers?.us_plan as UsPlan) ?? 'undecided';
  const { foreign, us } = useMemo(() => stage2Fields(plan), [plan]);
  const [company, setCompany] = useState(c.company_name);
  const [country, setCountry] = useState(c.country || 'Brazil');
  const [currency, setCurrency] = useState(c.currency || 'BRL');
  const [a, setA] = useState<Stage2Answers>(c.s2_answers ?? {});
  const { busy, error, run } = useAction();

  const set = (id: string, v: number | string | undefined) =>
    setA((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return next;
    });
  const ready = company.trim() && country.trim().length >= 2 && stage2Complete(a, plan);

  const renderField = (f: FieldDef) => (
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
        <NumberInput def={f} currency={currency} value={a[f.id] as number | undefined} onChange={(n) => set(f.id, n)} />
      )}
    </Field>
  );

  return (
    <form
      className="stack"
      style={{ '--gap': '26px' } as React.CSSProperties}
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api.put(`/cases/${c.id}/stage2`, { company_name: company, country, currency, answers: a });
          await onSaved();
        });
      }}
    >
      <div className="stack">
        <h3>{t('Company abroad', 'Empresa no exterior')}</h3>
        <div className="grid two">
          <Field label={t('Company name', 'Nome da empresa')}>
            <input className="input" required maxLength={160} value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <div className="grid" style={{ gridTemplateColumns: '1fr 110px' }}>
            <Field label={t('Country', 'País')}>
              <input className="input" required maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
            <Field label={t('Currency', 'Moeda')}>
              <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="grid two">{foreign.map(renderField)}</div>
      </div>
      {us.length > 0 && (
        <div className="stack">
          <h3>{plan === 'acquire' ? t('U.S. business you plan to buy', 'Negócio nos EUA que pretende comprar') : t('Your U.S. company', 'Sua empresa nos EUA')}</h3>
          <div className="grid two">{us.map(renderField)}</div>
        </div>
      )}
      <p className="help">{t('Round numbers are fine. Documents confirm them later.', 'Números arredondados bastam. Os documentos confirmam depois.')}</p>
      {error && <p className="error">{error}</p>}
      <div>
        <button className="btn primary lg" disabled={busy || !ready}>
          {t('See my snapshot', 'Ver meu retrato')} <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}

const gradeTone = { good: 'good', ok: 'warn', weak: 'bad' } as const;
const ratingTone = { healthy: 'good', watch: 'warn', weak: 'bad' } as const;
const ringColor = { healthy: 'var(--good)', watch: 'var(--warn)', weak: 'var(--bad)' } as const;

export function Stage2ResultView({ result }: { result: Stage2Result }) {
  const { t, tl } = useSession();
  const gradeLabel = { good: t('Good', 'Bom'), ok: t('Fair', 'Regular'), weak: t('Weak', 'Fraco') };
  const groups = [
    { side: 'foreign', title: t('Company abroad', 'Empresa no exterior') },
    { side: 'us', title: t('U.S. business', 'Negócio nos EUA') },
  ] as const;
  return (
    <div className="stack fade-in" style={{ '--gap': '22px' } as React.CSSProperties}>
      <div className="row" style={{ '--gap': '20px' } as React.CSSProperties}>
        <div className="ring" style={{ '--p': result.score, '--c': ringColor[result.rating] } as React.CSSProperties}>
          <span>{result.score}</span>
        </div>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <div>
            <Chip tone={ratingTone[result.rating]}>
              <i className="dot" /> {tl(STAGE2_RATING[result.rating])}
            </Chip>
          </div>
          <h2>
            {
              {
                healthy: t('The numbers show a healthy, stable business.', 'Os números mostram um negócio saudável e estável.'),
                watch: t('The numbers work, with points to watch.', 'Os números funcionam, com pontos de atenção.'),
                weak: t('The numbers do not support the plan yet.', 'Os números ainda não sustentam o plano.'),
              }[result.rating]
            }
          </h2>
        </div>
      </div>
      {groups.map((g) => {
        const list = result.metrics.filter((m) => m.side === g.side);
        if (!list.length) return null;
        return (
          <div key={g.side} className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <p className="eyebrow">{g.title}</p>
            <div className="grid three">
              {list.map((m) => (
                <div key={m.id} className="inset metric">
                  <div className="row between">
                    <span className="small muted">{tl(m.label)}</span>
                    <Chip tone={gradeTone[m.grade]}>{gradeLabel[m.grade]}</Chip>
                  </div>
                  <span className="v">{m.value}</span>
                  <span className="tiny faint">{tl(m.note)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stage2Panel({ c, reload, go }: PanelProps) {
  const { t } = useSession();
  const [editing, setEditing] = useState(false);
  const editable = c.stage >= 2 && c.stage <= 3 && c.status !== 'decided';

  // Staff see the score even if the applicant's last edit cleared it.
  const result = c.s2_result ?? (c.s2_answers && c.s1_answers && safeScore(c.s2_answers, c.s1_answers.us_plan as UsPlan));

  if ((!result || editing) && editable) {
    return (
      <>
        <PanelHead stage={2} />
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
  if (!result) return <PanelHead stage={2} />;
  return (
    <>
      <PanelHead stage={2}>
        {editable && (
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> {t('Edit numbers', 'Editar números')}
          </button>
        )}
      </PanelHead>
      <Stage2ResultView result={result} />
      {c.stage === 3 && c.status === 'active' && (
        <button className="btn primary lg" style={{ marginTop: 24 }} onClick={() => go(3)}>
          {t('Continue to documents', 'Continuar para documentos')} <ArrowRight size={18} />
        </button>
      )}
    </>
  );
}

function safeScore(a: Stage2Answers, plan: UsPlan): Stage2Result | null {
  try {
    return scoreStage2(a, plan);
  } catch {
    return null;
  }
}
