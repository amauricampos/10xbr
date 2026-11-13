import { AlertTriangle, ArrowLeft, Check, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { STAGE1_HEADLINE, STAGE1_RATING, type Kind, type Level, type Stage1Answers, type Stage1Result } from '../shared/process';
import { useSession } from './session';
import { Chip, s1Tone } from './ui';

const tone = { pass: 'good', caution: 'warn', fail: 'bad' } as const;

/** One question per screen; a tap answers and moves on. */
export function Stage1Wizard({ kind, onDone }: { kind: Kind; onDone: (a: Stage1Answers) => void }) {
  const { t, tl, forms } = useSession();
  const [answers, setAnswers] = useState<Stage1Answers>({});
  const [i, setI] = useState(0);
  const STAGE1 = forms.s1[kind];
  // The questions can change while the page is open.
  const q = STAGE1[Math.min(i, STAGE1.length - 1)];

  const pick = (value: string) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (i < STAGE1.length - 1) setTimeout(() => setI(i + 1), 160);
    else onDone(next);
  };

  return (
    <div className="stack" style={{ '--gap': '22px' } as React.CSSProperties}>
      <div className="row">
        <button className="btn ghost icon" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label={t('Back', 'Voltar')}>
          <ArrowLeft size={18} />
        </button>
        <div className="progress grow" role="progressbar" aria-valuenow={i + 1} aria-valuemin={1} aria-valuemax={STAGE1.length}>
          <i style={{ width: `${((i + 1) / STAGE1.length) * 100}%` }} />
        </div>
        <span className="tiny faint" style={{ minWidth: 34, textAlign: 'right' }}>
          {i + 1}/{STAGE1.length}
        </span>
      </div>
      <div key={q.id} className="stack fade-in" style={{ '--gap': '18px' } as React.CSSProperties}>
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <h2>{tl(q.label)}</h2>
          {q.help && <p className="muted small">{tl(q.help)}</p>}
        </div>
        <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          {q.options.map((o) => (
            <button key={o.value} className="option" aria-pressed={answers[q.id] === o.value} onClick={() => pick(o.value)}>
              <span>{tl(o.label)}</span>
              <ChevronRight size={18} className="faint" style={{ flex: 'none' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const ringColor = { compliant: 'var(--good)', gaps: 'var(--warn)', not_compliant: 'var(--bad)' } as const;

const MARK = { pass: Check, caution: AlertTriangle, fail: X } as const;

/** The stage 1 scorecard: how many requirements are met, then each one with its status. */
export function Stage1ResultView({ kind, result }: { kind: Kind; result: Stage1Result }) {
  const { t, tl } = useSession();
  const total = result.findings.length;
  const met = result.findings.filter((f) => f.level === 'pass').length;
  const order: Record<Level, number> = { fail: 0, caution: 1, pass: 2 };
  const status = { pass: t('Met', 'Atendido'), caution: t('Needs attention', 'Requer atenção'), fail: t('Not met', 'Não atendido') };

  return (
    <div className="stack fade-in" style={{ '--gap': '20px' } as React.CSSProperties}>
      <div className="row" style={{ '--gap': '20px' } as React.CSSProperties}>
        <div className="ring" style={{ '--p': (met / total) * 100, '--c': ringColor[result.rating] } as React.CSSProperties}>
          <span>
            {met}
            <small>/{total}</small>
          </span>
        </div>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <div>
            <Chip tone={s1Tone[result.rating]}>
              <i className="dot" /> {tl(STAGE1_RATING[result.rating])}
            </Chip>
          </div>
          <h2>{tl(STAGE1_HEADLINE[kind][result.rating])}</h2>
          <p className="small muted">{t(`${met} of ${total} requirements met.`, `${met} de ${total} requisitos atendidos.`)}</p>
        </div>
      </div>
      <div className="scorecard">
        {[...result.findings]
          .sort((a, b) => order[a.level] - order[b.level])
          .map((f) => {
            const Icon = MARK[f.level];
            return (
              <div key={f.id} className={`score-row ${f.level}`}>
                <span className="mark">
                  <Icon size={14} />
                </span>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{tl(f.topic)}</div>
                  <div className="small faint">{tl(f.label)}</div>
                  {f.level !== 'pass' && f.note && <div className="muted small">{tl(f.note)}</div>}
                </div>
                <Chip tone={tone[f.level]}>{status[f.level]}</Chip>
              </div>
            );
          })}
      </div>
    </div>
  );
}
