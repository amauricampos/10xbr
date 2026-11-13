import { ArrowLeft, Printer, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { docsFor } from '../../shared/documents';
import { DISCLOSURES, KINDS, LAST_STAGE, STAGE1_RATING, STAGE2_RATING, STAGES, STATUS } from '../../shared/process';
import { api, type AiReview, type Case } from '../api';
import { useSession } from '../session';
import { Chip, Disclaimer, Nav, PageLoader, Spinner, fmtDate, metricValue, s1Tone, s2Tone, statusTone, useAction } from '../ui';
import { NotFound, useCase } from './Workspace';

const suggestionTone = { advance: 'good', hold: 'warn', decline: 'bad' } as const;

function AiReviewView({ review }: { review: AiReview }) {
  const { t } = useSession();
  const label = { advance: t('AI suggests: advance', 'IA sugere: avançar'), hold: t('AI suggests: hold', 'IA sugere: aguardar'), decline: t('AI suggests: decline', 'IA sugere: recusar') };
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          {title}
        </p>
        <ul className="bullets small">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <div>
        <Chip tone={suggestionTone[review.suggestion]}>
          <Sparkles size={12} /> {label[review.suggestion]}
        </Chip>
      </div>
      <p>{review.summary}</p>
      {list(t('Flags', 'Alertas'), review.flags)}
      {list(t('Answers and documents disagree', 'Respostas e documentos divergem'), review.mismatches)}
      {list(t('Strengths', 'Pontos fortes'), review.strengths)}
    </div>
  );
}

/** The team's view of a record: the AI first pass and the gate decision. */
export function ReviewCard({ c, reload }: { c: Case; reload: () => Promise<void> }) {
  const { t, tl, config } = useSession();
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  const ai = useAction();
  const closed = c.status === 'approved' || c.status === 'declined';
  const stopped = c.status === 'stopped';
  const canApprove = stopped || (c.stage >= 3 && !closed);
  const noteOk = note.trim().length >= 5;

  const decide = (action: 'approve' | 'return' | 'decline' | 'reopen') =>
    run(async () => {
      await api.post(`/cases/${c.id}/decide`, { action, note });
      setNote('');
      await reload();
    });

  const approveLabel = stopped
    ? t('Override and continue', 'Liberar e continuar')
    : c.stage >= LAST_STAGE
      ? t('Approve into catalog', 'Aprovar para o catálogo')
      : t(`Approve and open stage ${c.stage + 1}`, `Aprovar e abrir etapa ${c.stage + 1}`);

  return (
    <section className="glass pad stack no-print" style={{ '--gap': '16px' } as React.CSSProperties}>
      <div className="row between wrapping">
        <div>
          <p className="eyebrow">{t('Team review', 'Revisão da equipe')}</p>
          <h3 style={{ marginTop: 4 }}>
            {t('Stage', 'Etapa')} {c.stage}: {tl(STAGES[c.stage - 1].title[c.kind])}
          </h3>
        </div>
        {config.ai && (
          <button className="btn ghost sm" disabled={ai.busy || c.ai_review_status === 'running'} onClick={() => ai.run(async () => { await api.post(`/cases/${c.id}/ai-review`); await reload(); })}>
            {ai.busy || c.ai_review_status === 'running' ? <Spinner size={14} /> : <RefreshCw size={14} />} {t('Run AI first pass', 'Rodar leitura da IA')}
          </button>
        )}
      </div>

      {c.ai_review ? (
        <AiReviewView review={c.ai_review} />
      ) : (
        <p className="muted small">
          {c.ai_review_status === 'running' ? t('AI is reading this record.', 'A IA está lendo este registro.') : t('No AI first pass yet.', 'Ainda sem leitura da IA.')}
        </p>
      )}
      {c.ai_review && c.ai_review.stage !== c.stage && <p className="tiny faint">{t(`Written at stage ${c.ai_review.stage}. Run it again for the current stage.`, `Escrita na etapa ${c.ai_review.stage}. Rode novamente para a etapa atual.`)}</p>}
      {ai.error && <p className="error">{ai.error}</p>}

      {closed ? (
        <div>
          <button className="btn sm" disabled={busy} onClick={() => decide('reopen')}>
            {t('Reopen', 'Reabrir')}
          </button>
        </div>
      ) : (
        <>
          <textarea
            className="textarea"
            style={{ minHeight: 64 }}
            maxLength={1000}
            placeholder={
              stopped
                ? t('Why this gate is being overridden, or why the record is declined', 'Por que esta etapa está sendo liberada, ou por que o registro é recusado')
                : t('Note for the owner. Required to send back or decline.', 'Nota para o responsável. Obrigatória para devolver ou recusar.')
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="row wrapping">
            {canApprove && (
              <button className="btn primary" disabled={busy || (stopped && !noteOk)} onClick={() => decide('approve')}>
                {approveLabel}
              </button>
            )}
            {c.status === 'review' && (
              <button className="btn" disabled={busy || !noteOk} onClick={() => decide('return')}>
                {t('Send back to owner', 'Devolver ao responsável')}
              </button>
            )}
            <button className="btn ghost danger" disabled={busy || !noteOk} onClick={() => window.confirm(t('Decline this record?', 'Recusar este registro?')) && decide('decline')}>
              {t('Decline', 'Recusar')}
            </button>
          </div>
          {c.status === 'active' && c.stage >= 3 && <p className="tiny faint">{t('The owner has not sent this stage for review yet. You can still approve it.', 'O responsável ainda não enviou esta etapa para revisão. Você pode aprovar mesmo assim.')}</p>}
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One-page report                                                     */
/* ------------------------------------------------------------------ */

export function Report() {
  const { user, t, tl, lang } = useSession();
  const { id } = useParams();
  const { c, failed } = useCase(id!);
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'staff') return <Navigate to="/app" replace />;
  if (failed) return <NotFound />;
  if (!c) return <PageLoader />;

  const requested = docsFor(c.kind, Math.max(c.stage, 3));
  const required = requested.filter((d) => !d.optional);
  const have = required.filter((d) => c.documents.some((x) => x.item_key === d.key)).length;
  const levelTone = { pass: 'good', caution: 'warn', fail: 'bad' } as const;
  const gradeTone = { good: 'good', ok: 'warn', weak: 'bad' } as const;
  const actionLabel = { approve: t('Approved', 'Aprovado'), return: t('Sent back', 'Devolvido'), decline: t('Declined', 'Recusado'), reopen: t('Reopened', 'Reaberto') };
  const dash = <span className="faint">{t('Not yet', 'Ainda não')}</span>;

  return (
    <>
      <Nav />
      <main className="narrow stack" style={{ padding: '24px 0 64px', maxWidth: 900, '--gap': '18px' } as React.CSSProperties}>
        <div className="row between no-print">
          <Link className="btn ghost sm" to={`/case/${c.id}`}>
            <ArrowLeft size={15} /> {t('Back to record', 'Voltar ao registro')}
          </Link>
          <button className="btn sm" onClick={() => window.print()}>
            <Printer size={15} /> {t('Print or save as PDF', 'Imprimir ou salvar em PDF')}
          </button>
        </div>

        <section className="glass pad stack">
          <div>
            <p className="eyebrow">
              {tl(KINDS[c.kind].title)} · {t('Evaluation report', 'Relatório de avaliação')} · {fmtDate(Date.now(), lang)}
            </p>
            <h1 style={{ fontSize: '1.9rem', marginTop: 6 }}>{c.company_name || c.owner?.name}</h1>
            <p className="muted small">{[c.industry, c.location, c.owner && `${c.owner.name} (${c.owner.email})`].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="grid verdicts">
            <div className="inset verdict">
              <span className="small muted">{t('L-1 compliance', 'Conformidade L-1')}</span>
              <span className="big">{c.s1_result ? tl(STAGE1_RATING[c.s1_result.rating]) : dash}</span>
              {c.s1_result && (
                <Chip tone={s1Tone[c.s1_result.rating]}>
                  {c.s1_result.findings.filter((f) => f.level === 'pass').length}/{c.s1_result.findings.length} {t('met', 'atendidos')}
                </Chip>
              )}
            </div>
            <div className="inset verdict">
              <span className="small muted">{t('Business health', 'Saúde do negócio')}</span>
              <span className="big">{c.s2_result ? tl(STAGE2_RATING[c.s2_result.rating]) : dash}</span>
              {c.s2_result && <Chip tone={s2Tone[c.s2_result.rating]}>{c.s2_result.score}/100</Chip>}
            </div>
            <div className="inset verdict">
              <span className="small muted">{t('Stage', 'Etapa')}</span>
              <span className="big">
                {c.stage} / {LAST_STAGE} · {tl(STAGES[c.stage - 1].title[c.kind])}
              </span>
              <Chip tone={statusTone[c.status]}>{tl(STATUS[c.status])}</Chip>
            </div>
            <div className="inset verdict">
              <span className="small muted">{t('Required documents', 'Documentos obrigatórios')}</span>
              <span className="big">{c.stage >= 3 ? `${have} / ${required.length}` : dash}</span>
            </div>
          </div>
        </section>

        {c.ai_review && (
          <section className="glass pad stack">
            <h3>{t('AI first pass', 'Primeira leitura da IA')}</h3>
            <AiReviewView review={c.ai_review} />
            <p className="tiny faint">{t('Generated by AI from the answers and documents. Reviewed by the team before any decision.', 'Gerado por IA a partir das respostas e documentos. Revisado pela equipe antes de qualquer decisão.')}</p>
          </section>
        )}

        {c.s1_result && (
          <section className="glass pad stack">
            <h3>{t('L-1 compliance', 'Conformidade L-1')}</h3>
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              {c.s1_result.findings.map((f) => (
                <div key={f.id} className="row between small" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="muted">{tl(f.topic)}</div>
                    <div style={{ fontWeight: 600 }}>{tl(f.label)}</div>
                    {f.note && <div className="muted">{tl(f.note)}</div>}
                  </div>
                  <Chip tone={levelTone[f.level]}>{{ pass: t('Pass', 'Ok'), caution: t('Gap', 'Atenção'), fail: t('Fail', 'Falha') }[f.level]}</Chip>
                </div>
              ))}
            </div>
          </section>
        )}

        {c.s2_result && (
          <section className="glass pad stack">
            <h3>{t('Business health', 'Saúde do negócio')}</h3>
            <div className="grid three">
              {c.s2_result.metrics.map((m) => (
                <div key={m.id} className="inset metric">
                  <div className="row between">
                    <span className="small muted">{tl(m.label)}</span>
                    <Chip tone={gradeTone[m.grade]}>{{ good: t('Good', 'Bom'), ok: t('Fair', 'Regular'), weak: t('Weak', 'Fraco') }[m.grade]}</Chip>
                  </div>
                  <span className="v">{metricValue(m.value, lang)}</span>
                  <span className="tiny faint">{tl(m.note)}</span>
                </div>
              ))}
            </div>
            <p className="tiny faint">{t('Based on numbers entered by the owner. Documents confirm them.', 'Com base em números informados pelo responsável. Os documentos os confirmam.')}</p>
          </section>
        )}

        {c.s4_answers && (
          <section className="glass pad stack">
            <h3>{t('Owners', 'Sócios')}</h3>
            <dl className="kv">
              {c.s4_answers.owners.map((o, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <dt>
                    {o.name}
                    {o.role ? ` · ${o.role}` : ''}
                  </dt>
                  <dd>{o.pct}%</dd>
                </div>
              ))}
            </dl>
            {DISCLOSURES.map((d) => {
              const yes = c.s4_answers!.disclosures[d.id] === 'yes';
              return (
                <div key={d.id} className="row between small">
                  <span>{tl(d.label)}</span>
                  <Chip tone={yes ? 'bad' : 'good'}>{yes ? t('Yes', 'Sim') : t('No', 'Não')}</Chip>
                </div>
              );
            })}
          </section>
        )}

        {c.stage >= 3 && (
          <section className="glass pad stack">
            <h3>{t('Documents', 'Documentos')}</h3>
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              {requested.map((d) => {
                const files = c.documents.filter((x) => x.item_key === d.key);
                const accepted = files.some((x) => x.review === 'accepted');
                const rejected = files.length > 0 && files.every((x) => x.review === 'rejected');
                const concerns = files.reduce((n, x) => n + (x.ai_result?.concerns.length ?? 0), 0);
                if (!files.length && d.optional) return null;
                return (
                  <div key={d.key} className="row between small">
                    <span>
                      {tl(d.label)}
                      {concerns > 0 && <span className="muted"> · {t(`${concerns} AI concern(s)`, `${concerns} alerta(s) da IA`)}</span>}
                    </span>
                    {!files.length ? (
                      <Chip tone="bad">{t('Missing', 'Faltando')}</Chip>
                    ) : accepted ? (
                      <Chip tone="good">{t('Accepted', 'Aceito')}</Chip>
                    ) : rejected ? (
                      <Chip tone="bad">{t('Needs a new copy', 'Precisa de nova cópia')}</Chip>
                    ) : (
                      <Chip tone="info">{t('Received', 'Recebido')}</Chip>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {c.history.length > 0 && (
          <section className="glass pad stack">
            <h3>{t('Team decisions', 'Decisões da equipe')}</h3>
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              {c.history.map((h, i) => (
                <div key={i} className="small">
                  <strong>
                    {actionLabel[h.action]} · {t('stage', 'etapa')} {h.stage}
                  </strong>{' '}
                  <span className="muted">
                    {fmtDate(h.at, lang)} · {h.by}
                  </span>
                  {h.note && <div>{h.note}</div>}
                </div>
              ))}
            </div>
          </section>
        )}
        <Disclaimer />
      </main>
    </>
  );
}
