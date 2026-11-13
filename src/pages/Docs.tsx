import { Check, Download, FolderOpen, PenLine, Plus, RefreshCw, Send, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { docsFor, type DocItem } from '../../shared/documents';
import { NDA_VERSION, ndaText } from '../../shared/legal';
import { stage4Complete, type Owner } from '../../shared/process';
import { api, type Case, type Doc } from '../api';
import { useSession } from '../session';
import { Chip, Field, Spinner, fmtDate, fmtSize, useAction } from '../ui';
import { PanelHead, type PanelProps } from './Workspace';

type Common = { c: Case; staff: boolean; reload: () => Promise<void> };

/* ------------------------------------------------------------------ */
/* E-signature                                                         */
/* ------------------------------------------------------------------ */

function SignCard({ c, staff, reload }: Common) {
  const { t, lang, user, config } = useSession();
  const signed = c.signatures.find((s) => s.kind === 'nda');
  const [name, setName] = useState(user?.name ?? '');
  const [agree, setAgree] = useState(false);
  const { busy, error, run } = useAction();
  const title = t('Confidentiality agreement', 'Acordo de confidencialidade');

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
        {title}: {t('waiting for the owner to sign.', 'aguardando assinatura do responsável.')}
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="row">
        <PenLine size={18} style={{ color: 'var(--mint)' }} />
        <h3>{title}</h3>
        <span className="tiny faint">{NDA_VERSION}</span>
      </div>
      <p className="small muted">{t('It protects both sides. Sign once and the document area opens.', 'Protege os dois lados. Assine uma vez e a área de documentos é liberada.')}</p>
      <div className="inset legal" tabIndex={0}>
        {ndaText(config.entity)[lang]}
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
          onClick={() => run(async () => { await api.post(`/cases/${c.id}/sign`, { name, lang, agree: true }); await reload(); })}
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

function FileRow({ d, c, staff, reload }: Common & { d: Doc }) {
  const { t } = useSession();
  const { busy, run } = useAction();
  const ai = d.ai_result;
  const canDelete = staff || (d.review === 'received' && c.status === 'active');
  const act = (fn: () => Promise<unknown>) => run(async () => { await fn(); await reload(); });

  return (
    <div className="file">
      <div className="grow stack" style={{ '--gap': '6px', minWidth: 0 } as React.CSSProperties}>
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
          <ul className="small muted bullets">
            {ai.concerns.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        {staff && ai?.summary && (
          <details>
            <summary className="small" style={{ cursor: 'pointer', color: 'var(--text-2)' }}>
              {t('AI reading', 'Leitura da IA')} · {ai.doc_type}
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
                const note = window.prompt(t('What should the owner fix?', 'O que o responsável deve corrigir?')) ?? '';
                if (note.trim()) act(() => api.put(`/documents/${d.id}/review`, { review: 'rejected', note }));
              }}
            >
              <X size={16} />
            </button>
            <button className="btn ghost icon" title={t('Re-run AI reading', 'Refazer leitura da IA')} disabled={busy} onClick={() => act(() => api.post(`/documents/${d.id}/analyze`))}>
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

function DocRow({ item, c, staff, reload }: Common & { item: DocItem }) {
  const { t, tl } = useSession();
  const files = c.documents.filter((d) => d.item_key === item.key);
  const [over, setOver] = useState(false);
  const { busy, error, run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const open = staff ? c.status !== 'approved' && c.status !== 'declined' : c.status === 'active';

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    run(async () => {
      for (const file of Array.from(list)) {
        const form = new FormData();
        form.append('item_key', item.key);
        form.append('file', file);
        await api.post(`/cases/${c.id}/documents`, form);
      }
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

function Checklist({ c, staff, reload, stage }: Common & { stage: 3 | 4 }) {
  const { t } = useSession();
  const items = docsFor(c.kind, stage).filter((d) => d.stage === stage);
  const required = items.filter((i) => !i.optional);
  const have = required.filter((i) => c.documents.some((d) => d.item_key === i.key)).length;
  return (
    <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <div className="row">
        <div className="progress grow">
          <i style={{ width: `${required.length ? (have / required.length) * 100 : 0}%` }} />
        </div>
        <span className="small muted">
          {have}/{required.length} {t('received', 'recebidos')}
        </span>
      </div>
      <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        {items.map((i) => (
          <DocRow key={i.key} item={i} c={c} staff={staff} reload={reload} />
        ))}
      </div>
    </div>
  );
}

function FolderLink({ c, staff, reload }: Common) {
  const { t } = useSession();
  const [url, setUrl] = useState(c.folder_url ?? '');
  const { busy, error, run } = useAction();
  const dirty = url.trim() !== (c.folder_url ?? '');
  if (staff && !c.folder_url) return null;
  return (
    <div className="inset pad-sm stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      <div className="row">
        <FolderOpen size={17} style={{ color: 'var(--mint)', flex: 'none' }} />
        <span className="small" style={{ fontWeight: 600 }}>
          {staff ? t('Shared folder from the owner', 'Pasta compartilhada pelo responsável') : t('Already have everything in a shared folder?', 'Já tem tudo em uma pasta compartilhada?')}
        </span>
      </div>
      <div className="row">
        <input
          className="input grow"
          type="url"
          readOnly={staff}
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
      {!staff && <p className="help">{t('Share it with view access. Our team files each document into the list for you.', 'Compartilhe com acesso de leitura. Nossa equipe organiza cada documento na lista para você.')}</p>}
    </div>
  );
}

/** The owner hands the stage to the team. */
function SubmitBar({ c, staff, reload, stage }: Common & { stage: 3 | 4 }) {
  const { t } = useSession();
  const { busy, error, run } = useAction();
  if (staff || c.stage !== stage || c.status !== 'active') return null;
  return (
    <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      {error && <p className="error">{error}</p>}
      <div>
        <button className="btn primary lg" disabled={busy} onClick={() => run(async () => { await api.post(`/cases/${c.id}/submit`); await reload(); })}>
          <Send size={17} /> {t('Send for review', 'Enviar para revisão')}
        </button>
      </div>
      <p className="help">{t('AI reads everything first, then a person on our team reviews it.', 'A IA lê tudo primeiro e depois uma pessoa da nossa equipe revisa.')}</p>
    </div>
  );
}

export function DocumentsPanel({ c, staff, reload }: PanelProps) {
  const signed = c.signatures.some((s) => s.kind === 'nda');
  return (
    <>
      <PanelHead c={c} stage={3} />
      <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
        <SignCard c={c} staff={staff} reload={reload} />
        {signed && (
          <>
            <FolderLink c={c} staff={staff} reload={reload} />
            <Checklist c={c} staff={staff} reload={reload} stage={3} />
            <SubmitBar c={c} staff={staff} reload={reload} stage={3} />
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stage 4: owners, disclosures, remaining documents                   */
/* ------------------------------------------------------------------ */

function OwnersForm({ c, staff, reload }: Common) {
  const { t, tl, forms } = useSession();
  const [owners, setOwners] = useState<Owner[]>(c.s4_answers?.owners ?? [{ name: '', pct: 100, role: '' }]);
  const [disclosures, setDisclosures] = useState<Record<string, string>>(c.s4_answers?.disclosures ?? {});
  // A question added since the last save leaves the form unsaved until it is answered.
  const [saved, setSaved] = useState(stage4Complete(c.s4_answers, forms));
  const { busy, error, run } = useAction();
  const editable = !staff && c.stage === 4 && c.status === 'active';
  const total = owners.reduce((s, o) => s + (Number.isFinite(o.pct) ? o.pct : 0), 0);
  const patch = (i: number, p: Partial<Owner>) => {
    setOwners(owners.map((o, j) => (j === i ? { ...o, ...p } : o)));
    setSaved(false);
  };

  if (!editable) {
    if (!c.s4_answers) return <p className="muted">{t('Owners not listed yet.', 'Sócios ainda não informados.')}</p>;
    return (
      <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
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
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          {(c.s4_answers.asked ?? forms.s4).map((d) => {
            const yes = c.s4_answers!.disclosures[d.id] === 'yes';
            return (
              <div key={d.id} className="row between small">
                <span>{tl(d.label)}</span>
                <Chip tone={yes ? 'bad' : 'good'}>{yes ? t('Yes', 'Sim') : t('No', 'Não')}</Chip>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
      <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        {owners.map((o, i) => (
          <div key={i} className="owner-row">
            <input className="input" placeholder={t('Full name', 'Nome completo')} value={o.name} maxLength={120} onChange={(e) => patch(i, { name: e.target.value })} />
            <div className="affix">
              <span>%</span>
              <input className="input" inputMode="decimal" value={Number.isFinite(o.pct) ? o.pct : ''} onChange={(e) => patch(i, { pct: e.target.value === '' ? Number.NaN : Number(e.target.value.replace(',', '.')) })} />
            </div>
            <input className="input role" placeholder={t('Role (optional)', 'Cargo (opcional)')} value={o.role} maxLength={80} onChange={(e) => patch(i, { role: e.target.value })} />
            <button className="btn ghost icon" disabled={owners.length === 1} title={t('Remove', 'Remover')} onClick={() => { setOwners(owners.filter((_, j) => j !== i)); setSaved(false); }}>
              <X size={16} />
            </button>
          </div>
        ))}
        <div className="row between">
          <button className="btn ghost sm" onClick={() => { setOwners([...owners, { name: '', pct: Math.max(0, 100 - total), role: '' }]); setSaved(false); }}>
            <Plus size={14} /> {t('Add owner', 'Adicionar sócio')}
          </button>
          <span className="small" style={{ color: total > 100.01 ? 'var(--bad)' : 'var(--text-3)' }}>
            {t('Total', 'Total')}: {total}%
          </span>
        </div>
      </div>
      <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        {forms.s4.map((d) => (
          <div key={d.id} className="row between wrapping">
            <span className="small grow">{tl(d.label)}</span>
            <div className="seg" style={{ width: 150, flex: 'none' }}>
              {(['no', 'yes'] as const).map((v) => (
                <button type="button" key={v} aria-pressed={disclosures[d.id] === v} onClick={() => { setDisclosures({ ...disclosures, [d.id]: v }); setSaved(false); }}>
                  {v === 'yes' ? t('Yes', 'Sim') : t('No', 'Não')}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="help">{t('A “yes” does not stop the evaluation. We will ask for details.', 'Um “sim” não interrompe a avaliação. Vamos pedir detalhes.')}</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div>
        <button
          className="btn"
          disabled={busy || saved || !stage4Complete({ owners, disclosures }, forms)}
          onClick={() => run(async () => { await api.put(`/cases/${c.id}/stage4`, { owners, disclosures }); setSaved(true); await reload(); })}
        >
          {saved ? <Check size={15} /> : null} {saved ? t('Saved', 'Salvo') : t('Save owners', 'Salvar sócios')}
        </button>
      </div>
    </div>
  );
}

export function VerificationPanel({ c, staff, reload }: PanelProps) {
  const { t } = useSession();
  return (
    <>
      <PanelHead c={c} stage={4} />
      <div className="stack" style={{ '--gap': '26px' } as React.CSSProperties}>
        <div className="stack">
          <h3>{t('Owners', 'Sócios')}</h3>
          <OwnersForm c={c} staff={staff} reload={reload} />
        </div>
        <div className="stack">
          <h3>{t('Remaining documents', 'Documentos restantes')}</h3>
          <Checklist c={c} staff={staff} reload={reload} stage={4} />
        </div>
        <SubmitBar c={c} staff={staff} reload={reload} stage={4} />
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
