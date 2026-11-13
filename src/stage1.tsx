import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { QUESTIONS, STAGE1_RATING, type Kind, type Level, type Stage1Answers, type Stage1Result } from '../shared/process';
import { useSession } from './session';
import { Chip, s1Tone } from './ui';

const tone = { pass: 'good', caution: 'warn', fail: 'bad' } as const;

/** One question per screen; a tap answers and moves on. */
export function Stage1Wizard({ kind, onDone }: { kind: Kind; onDone: (a: Stage1Answers) => void }) {
  const { t, tl } = useSession();
  const [answers, setAnswers] = useState<Stage1Answers>({});
  const [i, setI] = useState(0);
  const STAGE1 = QUESTIONS[kind];
  const q = STAGE1[i];

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

export function Stage1ResultView({ kind, result }: { kind: Kind; result: Stage1Result }) {
  const { t, tl } = useSession();
  const notes = result.findings.filter((f) => f.level !== 'pass');
  const passes = result.findings.length - notes.length;
  const head =
    kind === 'us'
      ? {
          compliant: t('Good news. Your business qualifies for our international buyers.', 'Boa notícia. O seu negócio se qualifica para os nossos compradores internacionais.'),
          gaps: t('Your business can qualify for our international buyers. A few points need attention.', 'O seu negócio pode se qualificar para os nossos compradores internacionais. Alguns pontos precisam de atenção.'),
          not_compliant: t('As it stands, our L-1 buyers cannot acquire this business.', 'Do jeito que está, os nossos compradores L-1 não podem adquirir este negócio.'),
        }[result.rating]
      : {
          compliant: t('You and your company meet the core L-1A requirements we screen for.', 'Você e sua empresa atendem aos requisitos centrais do L-1A que analisamos.'),
          gaps: t('Your profile can work. A few points need attention.', 'Seu perfil pode funcionar. Alguns pontos precisam de atenção.'),
          not_compliant: t('Something essential is missing today. Here is what to fix.', 'Falta algo essencial hoje. Veja o que corrigir.'),
        }[result.rating];
  const order: Record<Level, number> = { fail: 0, caution: 1, pass: 2 };

  return (
    <div className="stack fade-in" style={{ '--gap': '20px' } as React.CSSProperties}>
      <div className="row" style={{ '--gap': '20px' } as React.CSSProperties}>
        <div className="ring" style={{ '--p': result.score, '--c': ringColor[result.rating] } as React.CSSProperties}>
          <span>{result.score}</span>
        </div>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <div>
            <Chip tone={s1Tone[result.rating]}>
              <i className="dot" /> {tl(STAGE1_RATING[result.rating])}
            </Chip>
          </div>
          <h2>{head}</h2>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          {[...notes]
            .sort((a, b) => order[a.level] - order[b.level])
            .map((f) => (
              <div key={f.id} className="finding inset">
                <i className="dot" style={{ color: `var(--${f.level === 'fail' ? 'bad' : 'warn'})` }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{tl(f.label)}</div>
                  <div className="muted small">{tl(f.note)}</div>
                </div>
              </div>
            ))}
        </div>
      )}
      <p className="small muted">
        <Chip tone={tone.pass}>{passes}</Chip>{' '}
        {t(`of ${result.findings.length} requirements look good.`, `de ${result.findings.length} requisitos estão em ordem.`)}
      </p>
    </div>
  );
}
