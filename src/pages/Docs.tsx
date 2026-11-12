import { Check, Download, FolderOpen, PenLine, RefreshCw, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CHECKS, SECTIONS, docsFor, type CheckStatus, type DocItem, type DocSection } from '../../shared/documents';
import { CONSENT_VERSION, NDA_VERSION, consentText, ndaText } from '../../shared/legal';
import type { UsPlan } from '../../shared/process';
import { api, type Case, type Decision, type Doc } from '../api';
import { useSession } from '../session';
import { Chip, Field, Spinner, fmtDate, fmtSize, useAction } from '../ui';
import { PanelHead, type PanelProps } from './Workspace';

const planOf = (c: Case) => (c.s1_answers?.us_plan as UsPlan) ?? 'undecided';

/* ------------------------------------------------------------------ */
/* E-signature                                                         */
/* ------------------------------------------------------------------ */

function SignCard({ c, kind, staff, reload }: { c: Case; kind: 'nda' | 'background_consent'; staff: boolean; reload: () => Promise<void> }) {
  const { t, lang, user, config } = useSession();
  const signed = c.signatures.find((s) => s.kind === kind);
  const [name, setName] = useState(user?.name ?? '');
  const [agree, setAgree] = useState(false);
  const { busy, error, run } = useAction();
  const title = kind === 'nda' ? t('Confidentiality agreement', 'Acordo de confidencialidade') : t('Background check authorization', 'Autorização para verificação de antecedentes');

  if (signed) {
    return (
      <div className="banner good row">
        <Check size={18} style={{ flex: 'none' }} />
        <span>
          <strong>{title}</strong> · {t('signed by', 'assinado por')} {signed.signer_name}, {fmtDate(signed.signed_at, lang)} <span className="faint">({signed.version})</span>
        </span>
      </div>
    );
  }
  if (staff) {
    return (
      <div className="banner">
        {title}: {t('waiting for the applicant to sign.', 'aguardando assinatura do candidato.')}
      </div>
    );
  }
  const text = (kind === 'nda' ? ndaText : consentText)(config.entity)[lang];
  return (
    <div className="stack">
      <div className="row">
        <PenLine size={18} style={{ color: 'var(--mint)' }} />
        <h3>{title}</h3>
        <span className="tiny faint">{kind === 'nda' ? NDA_VERSION : CONSENT_VERSION}</span>
      </div>
      <p className="small muted">
        {kind === 'nda'
          ? t('It protects both sides. Sign once and the document area opens.', 'Protege os dois lados. Assine uma vez e a área de documentos é liberada.')
          : t('Needed before we run identity and background checks.', 'Necessária antes de verificarmos identidade e antecedentes.')}
      </p>
      <div className="inset legal" tabIndex={0}>
        {text}
      </div>
      <Field label={t('Type your full legal name to sign', 'Digite seu nome completo para assinar')}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={{ fontFamily: 'var(--display)', fontSize: '1.1rem' }} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          {t(
            'I have read and agree to this document. Typing my name is my electronic signature; the date, time and my IP address are recorded.',
            'Li e concordo com este documento. Digitar meu nome é minha assinatura eletrônica; data, hora e meu endereço IP são registrados.',
          )}
        </span>
      </label>
      {error && <p className="error">{error}</p>}
      <div>
        <button
          className="btn primary lg"
          disabled={busy || !agree || name.trim().length < 2}
          onClick={() => run(async () => { await api.post(`/cases/${c.id}/sign`, { kind, name, lang, agree: true }); await reload(); })}
        >
          <PenLine size={17} /> {t('Sign', 'Assinar')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

function AiChip({ d }: { d: Doc }) {
  const { t } = useSession();
  if (d.ai_status === 'pending' || d.ai_status === 'running') {
    return (
      <Chip tone="info">
        <Spinner size={12} /> {t('AI reading', 'IA lendo')}
      </Chip>
    );
  }
  if (d.ai_status !== 'done' || !d.ai_result) return null;
  const m = d.ai_result.matches_request;
  return (
    <Chip tone={m === 'yes' ? 'good' : m === 'partly' ? 'warn' : 'bad'}>
      <Sparkles size={12} />
      {m === 'yes' ? t('Looks right', 'Parece correto') : m === 'partly' ? t('Check this', 'Confira') : t('May be the wrong file', 'Pode ser o arquivo errado')}
    </Chip>
  );
}

function FileRow({ d, c, staff, reload }: { d: Doc; c: Case; staff: boolean; reload: () => Promise<void> }) {
  const { t } = useSession();
  const { busy, run } = useAction();
  const ai = d.ai_result;
  const canDelete = staff || (d.review === 'received' && c.status !== 'decided');
  const act = (fn: () => Promise<unknown>) => run(async () => { await fn(); await reload(); });

  return (
    <div className="file">
      <div className="grow stack" style={{ '--gap': '6px' } as React.CSSProperties}>
        <div className="row wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
          <span className="name" title={d.filename}>
            {d.filename}
          </span>
          <span className="tiny faint">{fmtSize(d.size)}</span>
          <AiChip d={d} />
          {d.review === 'accepted' && <Chip tone="good">{t('Accepted', 'Aceito')}</Chip>}
          {d.review === 'rejected' && <Chip tone="bad">{t('Needs a new copy', 'Precisa de nova cópia')}</Chip>}
        </div>
        {d.review === 'rejected' && d.review_note && <span className="small" style={{ color: 'var(--bad)' }}>{d.review_note}</span>}
        {ai && ai.concerns.length > 0 && (
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
            {ai.concerns.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        {staff && ai?.summary && (
          <details>
            <summary className="small" style={{ cursor: 'pointer', color: 'var(--text-2)' }}>
              {t('AI analysis', 'Análise da IA')} · {ai.doc_type}
              {ai.period ? ` · ${ai.period}` : ''}
            </summary>
            <div className="stack" style={{ '--gap': '8px', marginTop: 8 } as React.CSSProperties}>
              <p className="small">{ai.summary}</p>
              {ai.key_facts && ai.key_facts.length > 0 && (
                <dl className="kv">
                  {ai.key_facts.map((k, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      <dt>{k.label}</dt>
                      <dd>{k.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="tiny faint">{t('AI output is a reading aid. Verify against the file.', 'A saída da IA é um auxílio de leitura. Confira com o arquivo.')}</p>
            </div>
          </details>
        )}
      </div>
      <div className="row" style={{ '--gap': '2px' } as React.CSSProperties}>
        {staff && (
          <>
            <button className="btn ghost icon" title={t('Accept', 'Aceitar')} disabled={busy} onClick={() => act(() => api.put(`/documents/${d.id}/review`, { review: 'accepted' }))}>
              <Check size={16} />
            </button>
            <button
              className="btn ghost icon"
              title={t('Ask for a new copy', 'Pedir nova cópia')}
              disabled={busy}
              onClick={() => {
                const note = window.prompt(t('What should the applicant fix?', 'O que o candidato deve corrigir?')) ?? '';
                if (note.trim()) act(() => api.put(`/documents/${d.id}/review`, { review: 'rejected', note }));
              }}
            >
              <X size={16} />
            </button>
            <button className="btn ghost icon" title={t('Re-run AI analysis', 'Refazer análise da IA')} disabled={busy} onClick={() => act(() => api.post(`/documents/${d.id}/analyze`))}>
              <RefreshCw size={15} />
            </button>
          </>
        )}
        <a className="btn ghost icon" href={`/api/documents/${d.id}/file`} title={t('Download', 'Baixar')}>
          <Download size={16} />
        </a>
        {canDelete && (
          <button
            className="btn ghost icon danger"
            title={t('Remove', 'Remover')}
            disabled={busy}
            onClick={() => window.confirm(t('Remove this file?', 'Remover este arquivo?')) && act(() => api.del(`/documents/${d.id}`))}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function DocRow({ item, c, staff, reload }: { item: DocItem; c: Case; staff: boolean; reload: () => Promise<void> }) {
  const { t, tl } = useSession();
  const files = c.documents.filter((d) => d.item_key === item.key);
  const [over, setOver] = useState(false);
  const { busy, error, run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const open = c.status !== 'decided';

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    run(async () => {
      for (const file of Array.from(list)) {
        const form = new FormData();
        form.append('item_key', item.key);
        form.append('file', file);
        await api.post(`/cases/${c.id}/documents`, form);
      }
      await reload();
    }).then(() => reload());
  };

  return (
    <div
      className={`inset doc-row ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        if (!open) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (open) upload(e.dataTransfer.files);
      }}
    >
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="row wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
            <span style={{ fontWeight: 600 }}>{tl(item.label)}</span>
            {item.optional && <span className="tiny faint">{t('if available', 'se houver')}</span>}
          </div>
          {item.hint && <p className="small muted">{tl(item.hint)}</p>}
        </div>
        {open && (
          <>
            <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt,.xml,.ofx" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            <button className="btn sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Spinner size={14} /> : <Upload size={14} />} {files.length ? t('Add', 'Adicionar') : t('Upload', 'Enviar')}
            </button>
          </>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {files.map((d) => (
        <FileRow key={d.id} d={d} c={c} staff={staff} reload={reload} />
      ))}
    </div>
  );
}

function Checklist({ c, staff, reload, stage }: { c: Case; staff: boolean; reload: () => Promise<void>; stage: 3 | 4 }) {
  const { t, tl } = useSession();
  const items = docsFor(planOf(c), stage).filter((d) => d.stage === stage);
  const required = items.filter((i) => !i.optional);
  const have = required.filter((i) => c.documents.some((d) => d.item_key === i.key)).length;
  const sections = (Object.keys(SECTIONS) as DocSection[]).filter((s) => items.some((i) => i.section === s));

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div className="row">
        <div className="progress grow">
          <i style={{ width: `${required.length ? (have / required.length) * 100 : 0}%` }} />
        </div>
        <span className="small muted">
          {have}/{required.length} {t('received', 'recebidos')}
        </span>
      </div>
      {sections.map((s) => {
        const list = items.filter((i) => i.section === s);
        const body = (
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            {list.map((i) => (
              <DocRow key={i.key} item={i} c={c} staff={staff} reload={reload} />
            ))}
          </div>
        );
        if (stage === 3) {
          return (
            <div key={s} className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
              <p className="eyebrow">{tl(SECTIONS[s])}</p>
              {body}
            </div>
          );
        }
        const got = list.filter((i) => c.documents.some((d) => d.item_key === i.key)).length;
        return (
          <details key={s} className="inset" style={{ padding: '4px 14px' }}>
            <summary className="row between" style={{ cursor: 'pointer', padding: '12px 0', fontWeight: 600 }}>
              <span>{tl(SECTIONS[s])}</span>
              <span className="small muted" style={{ fontWeight: 400 }}>
                {got}/{list.length}
              </span>
            </summary>
            <div style={{ paddingBottom: 12 }}>{body}</div>
          </details>
        );
      })}
    </div>
  );
}

function FolderLink({ c, reload }: { c: Case; reload: () => Promise<void> }) {
  const { t } = useSession();
  const [url, setUrl] = useState(c.folder_url ?? '');
  const { busy, error, run } = useAction();
  const dirty = url.trim() !== (c.folder_url ?? '');
  return (
    <div className="inset pad-sm stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      <div className="row">
        <FolderOpen size={17} style={{ color: 'var(--mint)', flex: 'none' }} />
        <span className="small" style={{ fontWeight: 600 }}>
          {t('Already have everything in a shared folder?', 'Já tem tudo em uma pasta compartilhada?')}
        </span>
      </div>
      <div className="row">
        <input
          className="input grow"
          type="url"
          placeholder={t('Paste a Google Drive, Dropbox, OneDrive or Box link', 'Cole um link do Google Drive, Dropbox, OneDrive ou Box')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {dirty ? (
          <button className="btn sm" disabled={busy} onClick={() => run(async () => { await api.put(`/cases/${c.id}/folder`, { url }); await reload(); })}>
            {t('Save', 'Salvar')}
          </button>
        ) : (
          c.folder_url && (
            <a className="btn sm" href={c.folder_url} target="_blank" rel="noopener noreferrer">
              {t('Open', 'Abrir')}
            </a>
          )
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="help">{t('Share it with view access. Our team files each document into the checklist.', 'Compartilhe com acesso de leitura. Nossa equipe organiza cada documento na lista.')}</p>
    </div>
  );
}

export function EssentialsPanel({ c, staff, reload, go }: PanelProps) {
  const { t } = useSession();
  const { busy, error, run } = useAction();
  const signed = c.signatures.some((s) => s.kind === 'nda');
  return (
    <>
      <PanelHead stage={3} />
      <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
        <SignCard c={c} kind="nda" staff={staff} reload={reload} />
        {signed && (
          <>
            <FolderLink c={c} reload={reload} />
            <Checklist c={c} staff={staff} reload={reload} stage={3} />
            {c.stage === 3 &&
              (staff ? (
                <div>
                  {error && <p className="error">{error}</p>}
                  <button className="btn primary" disabled={busy || c.status !== 'active'} onClick={() => run(async () => { await api.post(`/cases/${c.id}/advance`); await reload(); go(4); })}>
                    {t('Essentials reviewed: open deep verification', 'Essenciais revisados: abrir verificação completa')}
                  </button>
                </div>
              ) : (
                <p className="small muted">
                  {t(
                    'Once the essentials are in, our team reviews them and opens deep verification. You will see the next step here.',
                    'Quando os essenciais estiverem enviados, nossa equipe revisa e abre a verificação completa. O próximo passo aparecerá aqui.',
                  )}
                </p>
              ))}
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stage 4                                                             */
/* ------------------------------------------------------------------ */

const checkTone: Record<CheckStatus, 'good' | 'warn' | 'bad' | 'info' | undefined> = { pending: undefined, in_progress: 'info', clear: 'good', issue: 'bad' };

function CheckRow({ c, k, staff, reload }: { c: Case; k: (typeof CHECKS)[number]; staff: boolean; reload: () => Promise<void> }) {
  const { t, tl } = useSession();
  const cur = c.checks.find((x) => x.check_key === k.key);
  const status = cur?.status ?? 'pending';
  const [note, setNote] = useState(cur?.note ?? '');
  const { run } = useAction();
  const labels: Record<CheckStatus, string> = {
    pending: t('Not started', 'Não iniciado'),
    in_progress: t('In progress', 'Em andamento'),
    clear: t('Clear', 'Aprovado'),
    issue: t('Issue found', 'Pendência'),
  };
  const save = (s: CheckStatus, n: string) => run(async () => { await api.put(`/cases/${c.id}/checks/${k.key}`, { status: s, note: n }); await reload(); });

  return (
    <div className="inset pad-sm stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      <div className="row between wrapping">
        <div>
          <div style={{ fontWeight: 600 }}>{tl(k.label)}</div>
          <div className="small muted">{tl(k.blurb)}</div>
        </div>
        {staff ? (
          <select className="select" style={{ width: 'auto', minHeight: 38 }} value={status} onChange={(e) => save(e.target.value as CheckStatus, note)}>
            {(Object.keys(labels) as CheckStatus[]).map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        ) : (
          <Chip tone={checkTone[status]}>{labels[status]}</Chip>
        )}
      </div>
      {staff && (
        <input
          className="input"
          style={{ minHeight: 38 }}
          placeholder={t('Internal note (not shown to the applicant)', 'Nota interna (não aparece para o candidato)')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (cur?.note ?? '') && save(status, note)}
        />
      )}
    </div>
  );
}

export function VerificationPanel({ c, staff, reload }: PanelProps) {
  const { t } = useSession();
  return (
    <>
      <PanelHead stage={4} />
      <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
        <SignCard c={c} kind="background_consent" staff={staff} reload={reload} />
        <div className="stack">
          <h3>{t('Full document list', 'Lista completa de documentos')}</h3>
          <p className="small muted">{t('The rest of the attorney’s petition list. Upload what you have; skip what does not apply.', 'O restante da lista de petição do advogado. Envie o que tiver; pule o que não se aplica.')}</p>
          <Checklist c={c} staff={staff} reload={reload} stage={4} />
        </div>
        <div className="stack">
          <h3>{t('Verification', 'Verificação')}</h3>
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            {CHECKS.map((k) => (
              <CheckRow key={k.key} c={c} k={k} staff={staff} reload={reload} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stage 5                                                             */
/* ------------------------------------------------------------------ */

function DecisionView({ d }: { d: Decision }) {
  const { t, lang } = useSession();
  const meta = {
    proceed: { tone: 'good', label: t('Proceed', 'Prosseguir') },
    conditions: { tone: '', label: t('Proceed with conditions', 'Prosseguir com condições') },
    stop: { tone: 'bad', label: t('Do not proceed', 'Não prosseguir') },
  }[d.verdict];
  return (
    <div className="stack">
      <div className={`banner ${meta.tone}`}>
        <strong style={{ fontSize: '1.05rem' }}>{meta.label}</strong>
        <span className="faint"> · {fmtDate(d.at, lang)}</span>
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{d.summary}</p>
      {d.conditions.length > 0 && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            {t('Conditions', 'Condições')}
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {d.conditions.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DecisionPanel({ c, staff, reload }: PanelProps) {
  const { t, config } = useSession();
  const [verdict, setVerdict] = useState<Decision['verdict']>(c.decision?.verdict ?? 'conditions');
  const [summary, setSummary] = useState(c.decision?.summary ?? '');
  const [conditions, setConditions] = useState((c.decision?.conditions ?? []).join('\n'));
  const { busy, error, run } = useAction();
  const ai = useAction();

  if (!staff) {
    return (
      <>
        <PanelHead stage={5} />
        {c.decision ? <DecisionView d={c.decision} /> : <p className="muted">{t('Your case is in review. The recommendation will appear here.', 'Seu caso está em análise. A recomendação aparecerá aqui.')}</p>}
      </>
    );
  }

  const save = (release: boolean) =>
    run(async () => {
      await api.put(`/cases/${c.id}/decision`, {
        verdict,
        summary,
        conditions: conditions.split('\n').map((x) => x.trim()).filter(Boolean),
        release,
      });
      await reload();
    });

  return (
    <>
      <PanelHead stage={5}>{c.decision_released ? <Chip tone="good">{t('Released to applicant', 'Liberado ao candidato')}</Chip> : c.decision && <Chip>{t('Draft', 'Rascunho')}</Chip>}</PanelHead>
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <div className="seg">
          {(
            [
              ['proceed', t('Proceed', 'Prosseguir')],
              ['conditions', t('Proceed with conditions', 'Prosseguir com condições')],
              ['stop', t('Do not proceed', 'Não prosseguir')],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={verdict === v} onClick={() => setVerdict(v)}>
              {label}
            </button>
          ))}
        </div>
        <Field label={t('Summary for the applicant', 'Resumo para o candidato')}>
          <textarea className="textarea" style={{ minHeight: 190 }} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} />
        </Field>
        {config.ai && (
          <div className="row wrapping">
            <button
              className="btn sm"
              disabled={ai.busy}
              onClick={() => ai.run(async () => { const r = await api.post<{ brief: string }>(`/cases/${c.id}/brief`); setSummary((s) => (s.trim() ? `${s.trim()}\n\n${r.brief}` : r.brief)); })}
            >
              {ai.busy ? <Spinner size={14} /> : <Sparkles size={14} />} {t('Draft with AI', 'Rascunhar com IA')}
            </button>
            <span className="tiny faint">{t('Built from the screening results and document summaries. Edit before releasing.', 'Feito a partir dos resultados e resumos dos documentos. Edite antes de liberar.')}</span>
          </div>
        )}
        {ai.error && <p className="error">{ai.error}</p>}
        <Field label={t('Conditions, one per line', 'Condições, uma por linha')}>
          <textarea className="textarea" style={{ minHeight: 90 }} value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="row wrapping">
          <button className="btn" disabled={busy || !summary.trim()} onClick={() => save(false)}>
            {t('Save draft', 'Salvar rascunho')}
          </button>
          <button
            className="btn primary"
            disabled={busy || !summary.trim()}
            onClick={() => window.confirm(t('Release this decision to the applicant? They will see it immediately.', 'Liberar esta decisão ao candidato? Ele verá imediatamente.')) && save(true)}
          >
            {t('Release to applicant', 'Liberar ao candidato')}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function AuditLog({ caseId, stamp }: { caseId: string; stamp: number }) {
  const { t, lang } = useSession();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<{ at: number; actor_email: string | null; action: string; detail: string | null }[]>([]);
  useEffect(() => {
    if (open) api.get<{ events: typeof events }>(`/cases/${caseId}/audit`).then((r) => setEvents(r.events)).catch(() => undefined);
  }, [open, caseId, stamp]);
  return (
    <details className="glass pad-sm" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('Audit log', 'Registro de auditoria')}</summary>
      <div className="stack" style={{ '--gap': '6px', marginTop: 12, maxHeight: 320, overflow: 'auto' } as React.CSSProperties}>
        {events.map((e, i) => (
          <div key={i} className="row small" style={{ alignItems: 'baseline' }}>
            <span className="faint" style={{ flex: 'none', width: 150 }}>
              {new Date(e.at).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <span style={{ flex: 'none', fontWeight: 600 }}>{e.action}</span>
            <span className="muted grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.actor_email}
              {e.detail ? ` · ${e.detail}` : ''}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
