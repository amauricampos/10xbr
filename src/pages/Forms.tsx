import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, History, Lock, Pencil, Plus, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BUILTIN_FIELDS,
  CROSS_RULES,
  FORM_KEYS,
  FORM_TITLES,
  LIMITS,
  METRICS,
  canonicalForm,
  formProblem,
  getForm,
  isBuiltin,
  type ChoiceQuestion,
  type Disclosure,
  type FieldDef,
  type FieldOption,
  type FormBody,
  type FormKey,
  type Forms,
  type Grade,
  type Kind,
  type L,
  type Level,
  type Option,
  type Section,
} from '../../shared/process';
import { api } from '../api';
import { useSession } from '../session';
import { Chip, PageLoader, useAction } from '../ui';

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

const newId = (prefix: string) => prefix + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
const blank = (): L => ({ en: '', pt: '' });
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** A list reordered by dragging the grip, or with the arrow keys once the grip has focus. */
function Sortable<T>({ items, idOf, onMove, render }: { items: T[]; idOf: (item: T) => string; onMove: (from: number, to: number) => void; render: (item: T, index: number, grip: ReactNode) => ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map(idOf);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[vertical]}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableRow key={ids[i]} id={ids[i]}>
            {(grip) => render(item, i, grip)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (grip: ReactNode) => ReactNode }) {
  const { t } = useSession();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const grip = (
    <button type="button" className="grip" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={t('Drag to reorder', 'Arraste para reordenar')} title={t('Drag to reorder', 'Arraste para reordenar')}>
      <GripVertical size={16} />
    </button>
  );
  return (
    <div ref={setNodeRef} className={isDragging ? 'sortable dragging' : 'sortable'} style={{ transform: CSS.Translate.toString(transform), transition }}>
      {children(grip)}
    </div>
  );
}

/** One text in both languages, side by side. */
function Text({ label, hint, value, onChange, area, max = LIMITS.label }: { label?: string; hint?: string; value: L | undefined; onChange: (l: L) => void; area?: boolean; max?: number }) {
  const { t } = useSession();
  const v = value ?? blank();
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="l-pair">
        {(['en', 'pt'] as const).map((k) => {
          const props = {
            value: v[k],
            maxLength: max,
            'aria-label': `${label ?? ''} ${k.toUpperCase()}`.trim(),
            placeholder: k === 'pt' ? t('Same as English if left blank', 'Igual ao inglês se ficar em branco') : undefined,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...v, [k]: e.target.value }),
          };
          return (
            <div className="l-cell" key={k}>
              <span className="l-tag">{k.toUpperCase()}</span>
              {area ? <textarea className="textarea" rows={2} {...props} /> : <input className="input" {...props} />}
            </div>
          );
        })}
      </div>
      {hint && <span className="help">{hint}</span>}
    </div>
  );
}

function Card({ grip, n, title, sub, chips, open, onToggle, onRemove, removeLabel, children }: { grip: ReactNode; n?: number; title: string; sub?: string; chips?: ReactNode; open?: boolean; onToggle?: () => void; onRemove?: () => void; removeLabel?: string; children?: ReactNode }) {
  return (
    <div className={open ? 'q-card open' : 'q-card'}>
      <div className="q-head">
        {grip}
        <button type="button" className="q-title" onClick={onToggle} disabled={!onToggle} aria-expanded={onToggle ? !!open : undefined}>
          {n !== undefined && <span className="num">{n}</span>}
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="q-name">{title}</span>
            {sub && <span className="q-sub">{sub}</span>}
          </span>
          {chips && <span className="q-chips">{chips}</span>}
          {onToggle && (open ? <ChevronDown size={18} className="faint" /> : <ChevronRight size={18} className="faint" />)}
        </button>
        {onRemove && (
          <button type="button" className="btn ghost icon danger" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {open && children && <div className="q-body">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* L-1 screen                                                          */
/* ------------------------------------------------------------------ */

const LEVEL_TONE = { pass: 'good', caution: 'warn', fail: 'bad' } as const;

function ScreenEditor({ kind, value, onChange }: { kind: Kind; value: ChoiceQuestion[]; onChange: (v: ChoiceQuestion[]) => void }) {
  const { t, tl } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const level: Record<Level, string> = { pass: t('Met', 'Atendido'), caution: t('Needs attention', 'Requer atenção'), fail: t('Not met', 'Não atendido') };
  const patch = (i: number, p: Partial<ChoiceQuestion>) => onChange(value.map((q, j) => (j === i ? { ...q, ...p } : q)));

  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      <p className="small muted">
        {t(
          'One question per screen, in this order. Each answer is Met, Needs attention or Not met. One “Not met” stops the record.',
          'Uma pergunta por tela, nesta ordem. Cada resposta é Atendido, Requer atenção ou Não atendido. Um “Não atendido” interrompe o registro.',
        )}
      </p>
      <Sortable
        items={value}
        idOf={(q) => q.id}
        onMove={(from, to) => onChange(arrayMove(value, from, to))}
        render={(q, i, grip) => {
          const setOption = (j: number, p: Partial<Option>) => patch(i, { options: q.options.map((o, k) => (k === j ? { ...o, ...p } : o)) });
          // A rule that joins this question with another one, shown while both are still on the form.
          const rule = CROSS_RULES[kind].find((r) => r.id === q.id && q.options.some((o) => o.value === r.value) && value.some((x) => x.id === r.other && x.options.some((o) => o.value === r.otherValue)));
          const other = rule && value.find((x) => x.id === rule.other)!;
          return (
            <Card
              grip={grip}
              n={i + 1}
              title={tl(q.label) || t('New question', 'Nova pergunta')}
              sub={tl(q.req)}
              chips={q.options.map((o) => <i key={o.value} className={`dot ${LEVEL_TONE[o.level]}`} title={level[o.level]} />)}
              open={open === q.id}
              onToggle={() => setOpen(open === q.id ? null : q.id)}
              removeLabel={t('Remove question', 'Remover pergunta')}
              onRemove={() => {
                if (confirm(t(`Remove “${q.label.en || 'this question'}”?`, `Remover “${q.label.pt || q.label.en || 'esta pergunta'}”?`))) onChange(value.filter((_, j) => j !== i));
              }}
            >
              <Text label={t('Question', 'Pergunta')} value={q.label} onChange={(label) => patch(i, { label })} />
              <Text
                label={t('Requirement it screens', 'Requisito que avalia')}
                hint={t('Heads this row on the scorecard and in the email.', 'Dá título a esta linha no scorecard e no e-mail.')}
                value={q.req}
                onChange={(req) => patch(i, { req })}
              />
              <Text label={t('Help under the question (optional)', 'Ajuda abaixo da pergunta (opcional)')} value={q.help} onChange={(help) => patch(i, { help })} />
              <div className="field">
                <label>{t('Answers', 'Respostas')}</label>
                <Sortable
                  items={q.options}
                  idOf={(o) => o.value}
                  onMove={(from, to) => patch(i, { options: arrayMove(q.options, from, to) })}
                  render={(o, j, optionGrip) => (
                    <div className={`opt ${LEVEL_TONE[o.level]}`}>
                      <div className="opt-row">
                        {optionGrip}
                        <div className="grow">
                          <Text value={o.label} onChange={(label) => setOption(j, { label })} />
                        </div>
                        <select className="select" style={{ width: 170, flex: 'none' }} value={o.level} aria-label={t('Result', 'Resultado')} onChange={(e) => setOption(j, { level: e.target.value as Level })}>
                          {(['pass', 'caution', 'fail'] as const).map((l) => (
                            <option key={l} value={l}>
                              {level[l]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn ghost icon danger"
                          disabled={q.options.length <= 2}
                          aria-label={t('Remove answer', 'Remover resposta')}
                          title={t('Remove answer', 'Remover resposta')}
                          onClick={() => patch(i, { options: q.options.filter((_, k) => k !== j) })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {o.level !== 'pass' && (
                        <div className="opt-note">
                          <Text area max={LIMITS.note} label={t('What the scorecard says for this answer', 'O que o scorecard diz para esta resposta')} value={o.note} onChange={(note) => setOption(j, { note })} />
                        </div>
                      )}
                    </div>
                  )}
                />
                <div>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={q.options.length >= LIMITS.options}
                    onClick={() => patch(i, { options: [...q.options, { value: newId('o_'), label: blank(), level: 'caution' }] })}
                  >
                    <Plus size={14} /> {t('Add answer', 'Adicionar resposta')}
                  </button>
                </div>
              </div>
              {rule && other && (
                <p className="small muted">
                  <strong>{t('Combined rule.', 'Regra combinada.')}</strong>{' '}
                  {t(
                    `“${q.options.find((o) => o.value === rule.value)!.label.en}” here together with “${other.options.find((o) => o.value === rule.otherValue)!.label.en}” on “${other.req.en}” counts as Not met.`,
                    `“${q.options.find((o) => o.value === rule.value)!.label.pt}” aqui, junto com “${other.options.find((o) => o.value === rule.otherValue)!.label.pt}” em “${other.req.pt}”, conta como Não atendido.`,
                  )}
                </p>
              )}
            </Card>
          );
        }}
      />
      <div>
        <button
          type="button"
          className="btn sm"
          disabled={value.length >= LIMITS.questions}
          onClick={() => {
            const id = newId('q_');
            onChange([
              ...value,
              {
                id,
                req: blank(),
                label: blank(),
                options: [
                  { value: newId('o_'), label: { en: 'Yes', pt: 'Sim' }, level: 'pass' },
                  { value: newId('o_'), label: { en: 'No', pt: 'Não' }, level: 'fail' },
                ],
              },
            ]);
            setOpen(id);
          }}
        >
          <Plus size={14} /> {t('Add question', 'Adicionar pergunta')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Business health                                                     */
/* ------------------------------------------------------------------ */

const TYPES = ['number', 'percent', 'usd', 'brl', 'choice', 'text'] as const;
type FieldType = (typeof TYPES)[number];
const typeOf = (f: FieldDef): FieldType => (f.kind === 'money' ? (f.unit === 'BRL' ? 'brl' : 'usd') : f.kind === 'number' ? (f.unit === '%' ? 'percent' : 'number') : f.kind === 'choice' ? 'choice' : 'text');

function HealthEditor({ kind, value, onChange }: { kind: Kind; value: Section[]; onChange: (v: Section[]) => void }) {
  const { t, tl } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const typeLabel: Record<FieldType, string> = {
    number: t('Number', 'Número'),
    percent: t('Percent', 'Percentual'),
    usd: t('Amount in USD', 'Valor em USD'),
    brl: t('Amount in BRL', 'Valor em BRL'),
    choice: t('Choice', 'Escolha'),
    text: t('Text', 'Texto'),
  };
  const gradeLabel: Record<Grade, string> = { good: t('Good', 'Bom'), ok: t('Fair', 'Regular'), weak: t('Weak', 'Fraco') };
  const asked = value.flatMap((s) => s.fields);
  const missing = BUILTIN_FIELDS[kind].filter((b) => !asked.some((f) => f.id === b.id));
  const feeds = (id: string) => METRICS[kind].filter((m) => m.needs.includes(id));

  const patchSection = (i: number, p: Partial<Section>) => onChange(value.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const patchField = (i: number, id: string, next: FieldDef) => patchSection(i, { fields: value[i].fields.map((f) => (f.id === id ? next : f)) });

  return (
    <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <p className="small muted">
        {t(
          'The built-in questions feed the health score. You can reword, move or remove them; a result is left out of the score while one of its questions is off the form. Questions you add are shown to the team, and a choice whose answers you grade also counts toward the score.',
          'As perguntas padrão alimentam a nota de saúde. Você pode reescrever, mover ou remover; um resultado sai da nota enquanto uma de suas perguntas estiver fora do formulário. Perguntas que você adicionar aparecem para a equipe, e uma escolha com respostas avaliadas também conta para a nota.',
        )}
      </p>
      <div className="q-section locked">
        <div className="q-section-head">
          <span className="grip" aria-hidden>
            <Lock size={14} />
          </span>
          <span className="num">1</span>
          <div className="grow">
            <strong>{kind === 'us' ? t('The business', 'O negócio') : t('The company', 'A empresa')}</strong>
            <div className="small muted">{t('Name, what it does, city and state, and when it started. Always asked first.', 'Nome, o que faz, cidade e estado, e quando começou. Sempre perguntado primeiro.')}</div>
          </div>
        </div>
      </div>
      <Sortable
        items={value}
        idOf={(s) => s.id}
        onMove={(from, to) => onChange(arrayMove(value, from, to))}
        render={(s, i, grip) => (
          <div className="q-section">
            <div className="q-section-head">
              {grip}
              <span className="num">{i + 2}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <strong>{tl(s.title) || t('New section', 'Nova seção')}</strong>
                {s.hint && <div className="small muted">{tl(s.hint)}</div>}
              </div>
              <button type="button" className="btn ghost sm" aria-pressed={editing === s.id} onClick={() => setEditing(editing === s.id ? null : s.id)}>
                <Pencil size={14} /> <span className="hide-sm">{t('Title', 'Título')}</span>
              </button>
              <button
                type="button"
                className="btn ghost icon danger"
                aria-label={t('Remove section', 'Remover seção')}
                title={t('Remove section', 'Remover seção')}
                onClick={() => {
                  if (s.fields.some((f) => f.kind === 'revenue')) return alert(t('Move the revenue questions to another section first.', 'Mova as perguntas de faturamento para outra seção primeiro.'));
                  if (s.fields.length === 0 || confirm(t(`Remove “${s.title.en}” and its ${s.fields.length} question(s)?`, `Remover “${s.title.pt || s.title.en}” e sua(s) ${s.fields.length} pergunta(s)?`))) onChange(value.filter((_, j) => j !== i));
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            {editing === s.id && (
              <div className="q-body">
                <Text label={t('Section title', 'Título da seção')} value={s.title} onChange={(title) => patchSection(i, { title })} />
                <Text label={t('Line under the title (optional)', 'Linha abaixo do título (opcional)')} value={s.hint} onChange={(hint) => patchSection(i, { hint })} />
              </div>
            )}
            <div className="q-list">
              <Sortable
                items={s.fields}
                idOf={(f) => f.id}
                onMove={(from, to) => patchSection(i, { fields: arrayMove(s.fields, from, to) })}
                render={(f, _j, fieldGrip) => {
                  if (f.kind === 'revenue') {
                    return (
                      <Card
                        grip={fieldGrip}
                        title={tl(f.label)}
                        sub={t('One box per calendar year since the start date, up to three. Always asked.', 'Um campo por ano desde a data de início, até três. Sempre perguntado.')}
                        chips={<Chip tone="info">{t('Scored', 'Pontuada')}</Chip>}
                      />
                    );
                  }
                  const fixed = isBuiltin(kind, f.id);
                  const used = fixed ? feeds(f.id) : [];
                  const scored = fixed ? used.length > 0 : !!f.options?.some((o) => o.grade);
                  const set = (p: Partial<FieldDef>) => patchField(i, f.id, { ...f, ...p });
                  const setOption = (k: number, p: Partial<FieldOption>) => set({ options: f.options!.map((o, n) => (n === k ? { ...o, ...p } : o)) });
                  const optionRow = (o: FieldOption, k: number, optionGrip?: ReactNode) => (
                    <div className={`opt ${o.grade ? { good: 'good', ok: 'warn', weak: 'bad' }[o.grade] : ''}`}>
                      <div className="opt-row">
                        {optionGrip}
                        <div className="grow">
                          <Text value={o.label} onChange={(label) => setOption(k, { label })} />
                        </div>
                        {!fixed && (
                          <>
                            <select
                              className="select"
                              style={{ width: 150, flex: 'none' }}
                              value={o.grade ?? ''}
                              aria-label={t('Grade', 'Avaliação')}
                              onChange={(e) => {
                                const { grade: _grade, note: _note, ...rest } = o;
                                set({ options: f.options!.map((x, n) => (n === k ? (e.target.value ? { ...o, grade: e.target.value as Grade } : rest) : x)) });
                              }}
                            >
                              <option value="">{t('Not scored', 'Sem nota')}</option>
                              {(['good', 'ok', 'weak'] as const).map((g) => (
                                <option key={g} value={g}>
                                  {gradeLabel[g]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn ghost icon danger"
                              disabled={f.options!.length <= 2}
                              aria-label={t('Remove answer', 'Remover resposta')}
                              title={t('Remove answer', 'Remover resposta')}
                              onClick={() => set({ options: f.options!.filter((_, n) => n !== k) })}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                      {!fixed && o.grade && (
                        <div className="opt-note">
                          <Text area max={LIMITS.note} label={t('Note shown with the result (optional)', 'Nota mostrada com o resultado (opcional)')} value={o.note} onChange={(note) => setOption(k, { note })} />
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <Card
                      grip={fieldGrip}
                      title={tl(f.label) || t('New question', 'Nova pergunta')}
                      sub={fixed && used.length ? `${t('Feeds', 'Alimenta')}: ${used.map((m) => tl(m.label)).join(', ')}` : undefined}
                      chips={
                        <>
                          <Chip>{typeLabel[typeOf(f)]}</Chip>
                          {scored && <Chip tone="info">{t('Scored', 'Pontuada')}</Chip>}
                          {f.optional && <Chip>{t('Optional', 'Opcional')}</Chip>}
                        </>
                      }
                      open={open === f.id}
                      onToggle={() => setOpen(open === f.id ? null : f.id)}
                      removeLabel={t('Remove question', 'Remover pergunta')}
                      onRemove={() => {
                        const names = used.map((m) => m.label.en).join(', ');
                        const namesPt = used.map((m) => m.label.pt).join(', ');
                        const ask = used.length
                          ? t(`Remove “${f.label.en}”? These results leave the health score: ${names}. You can add it back later.`, `Remover “${f.label.pt || f.label.en}”? Estes resultados saem da nota de saúde: ${namesPt}. Você pode adicioná-la de volta depois.`)
                          : t(`Remove “${f.label.en || 'this question'}”?`, `Remover “${f.label.pt || f.label.en || 'esta pergunta'}”?`);
                        if (confirm(ask)) patchSection(i, { fields: s.fields.filter((x) => x.id !== f.id) });
                      }}
                    >
                      <Text label={t('Question', 'Pergunta')} value={f.label} onChange={(label) => set({ label })} />
                      <Text label={t('Help under the box (optional)', 'Ajuda abaixo do campo (opcional)')} value={f.help} onChange={(help) => set({ help })} max={LIMITS.note} />
                      <div className="row wrapping" style={{ alignItems: 'flex-end', '--gap': '14px' } as React.CSSProperties}>
                        {!fixed && (
                          <div className="field" style={{ width: 190 }}>
                            <label>{t('Answer type', 'Tipo de resposta')}</label>
                            <select
                              className="select"
                              value={typeOf(f)}
                              onChange={(e) => {
                                const type = e.target.value as FieldType;
                                const base = { id: f.id, label: f.label, ...(f.help ? { help: f.help } : {}), ...(f.optional ? { optional: true } : {}) };
                                const next: FieldDef =
                                  type === 'choice'
                                    ? { ...base, kind: 'choice', options: f.options ?? [{ value: newId('o_'), label: blank() }, { value: newId('o_'), label: blank() }] }
                                    : type === 'text'
                                      ? { ...base, kind: 'text' }
                                      : type === 'number'
                                        ? { ...base, kind: 'number' }
                                        : type === 'percent'
                                          ? { ...base, kind: 'number', unit: '%' }
                                          : { ...base, kind: 'money', unit: type === 'usd' ? 'USD' : 'BRL' };
                                patchField(i, f.id, next);
                              }}
                            >
                              {TYPES.map((x) => (
                                <option key={x} value={x}>
                                  {typeLabel[x]}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {value.length > 1 && (
                          <div className="field" style={{ width: 220 }}>
                            <label>{t('Section', 'Seção')}</label>
                            <select
                              className="select"
                              value={s.id}
                              onChange={(e) =>
                                onChange(value.map((x) => (x.id === s.id ? { ...x, fields: x.fields.filter((y) => y.id !== f.id) } : x.id === e.target.value ? { ...x, fields: [...x.fields, f] } : x)))
                              }
                            >
                              {value.map((x, n) => (
                                <option key={x.id} value={x.id}>
                                  {n + 2}. {tl(x.title)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {!fixed && (
                          <label className="check" style={{ paddingBottom: 12 }}>
                            <input type="checkbox" checked={!f.optional} onChange={(e) => set({ optional: !e.target.checked })} /> {t('Required', 'Obrigatória')}
                          </label>
                        )}
                      </div>
                      {fixed && <p className="small muted">{t('Built-in question: its answer type is fixed because the score depends on it.', 'Pergunta padrão: o tipo de resposta é fixo porque a nota depende dele.')}</p>}
                      {f.kind === 'choice' && (
                        <div className="field">
                          <label>{t('Answers', 'Respostas')}</label>
                          {fixed ? (
                            f.options!.map((o, k) => <div key={o.value}>{optionRow(o, k)}</div>)
                          ) : (
                            <>
                              <Sortable items={f.options!} idOf={(o) => o.value} onMove={(from, to) => set({ options: arrayMove(f.options!, from, to) })} render={(o, k, optionGrip) => optionRow(o, k, optionGrip)} />
                              <div>
                                <button type="button" className="btn ghost sm" disabled={f.options!.length >= LIMITS.options} onClick={() => set({ options: [...f.options!, { value: newId('o_'), label: blank() }] })}>
                                  <Plus size={14} /> {t('Add answer', 'Adicionar resposta')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                }}
              />
              <div className="row wrapping">
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={asked.length >= LIMITS.fields}
                  onClick={() => {
                    const id = newId('x_');
                    patchSection(i, { fields: [...s.fields, { id, kind: 'number', label: blank() }] });
                    setOpen(id);
                  }}
                >
                  <Plus size={14} /> {t('Add question', 'Adicionar pergunta')}
                </button>
                {missing.length > 0 && (
                  <select
                    className="select sm"
                    value=""
                    aria-label={t('Add back a built-in question', 'Adicionar de volta uma pergunta padrão')}
                    onChange={(e) => {
                      const b = missing.find((x) => x.id === e.target.value);
                      if (b) patchSection(i, { fields: [...s.fields, b] });
                    }}
                  >
                    <option value="">{t('Add back a built-in question…', 'Adicionar de volta uma pergunta padrão…')}</option>
                    {missing.map((b) => (
                      <option key={b.id} value={b.id}>
                        {tl(b.label)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}
      />
      <div>
        <button
          type="button"
          className="btn sm"
          disabled={value.length >= LIMITS.sections}
          onClick={() => {
            const id = newId('s_');
            onChange([...value, { id, title: blank(), fields: [] }]);
            setEditing(id);
          }}
        >
          <Plus size={14} /> {t('Add section', 'Adicionar seção')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Disclosures                                                         */
/* ------------------------------------------------------------------ */

function DisclosureEditor({ value, onChange }: { value: Disclosure[]; onChange: (v: Disclosure[]) => void }) {
  const { t } = useSession();
  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      <p className="small muted">
        {t(
          'Asked at the last step about the business and every owner. Each is answered Yes or No. A “yes” is flagged for the team; it does not stop the record.',
          'Perguntadas na última etapa sobre a empresa e cada sócio. Cada uma é respondida com Sim ou Não. Um “sim” é sinalizado para a equipe; não interrompe o registro.',
        )}
      </p>
      <Sortable
        items={value}
        idOf={(d) => d.id}
        onMove={(from, to) => onChange(arrayMove(value, from, to))}
        render={(d, i, grip) => (
          <div className="q-card">
            <div className="opt-row" style={{ padding: '10px 12px' }}>
              {grip}
              <span className="num">{i + 1}</span>
              <div className="grow">
                <Text value={d.label} onChange={(label) => onChange(value.map((x, j) => (j === i ? { ...x, label } : x)))} />
              </div>
              <button type="button" className="btn ghost icon danger" aria-label={t('Remove question', 'Remover pergunta')} title={t('Remove question', 'Remover pergunta')} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}
      />
      <div>
        <button type="button" className="btn sm" disabled={value.length >= LIMITS.disclosures} onClick={() => onChange([...value, { id: newId('q_'), label: blank() }])}>
          <Plus size={14} /> {t('Add question', 'Adicionar pergunta')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The tab                                                             */
/* ------------------------------------------------------------------ */

type Version = { id: number; edited: number; created_at: number; created_by: string };
type Data = { forms: Forms; defaults: Forms; versions: Record<FormKey, Version[]> };
const same = (key: FormKey, a: FormBody, b: FormBody) => JSON.stringify(canonicalForm(key, a)) === JSON.stringify(canonicalForm(key, b));

export function Questionnaires() {
  const { t, tl, lang, refresh } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [key, setKey] = useState<FormKey>('s1_us');
  const [draft, setDraft] = useState<FormBody | null>(null);
  /** Bumped whenever the editor should start over, so open cards close. */
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(false);
  const { busy, error, run, setError } = useAction();

  const load = useCallback(async () => setData(await api.get<Data>('/admin/forms')), []);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const current = data ? getForm(data.forms, key) : null;
  const body = draft ?? current;
  const dirty = useMemo(() => !!draft && !!current && !same(key, draft, current), [key, draft, current]);
  const problem = useMemo(() => (dirty && body ? formProblem(key, canonicalForm(key, body)) : null), [dirty, key, body]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!data || !current || !body) return <PageLoader />;

  const kind: Kind = key.endsWith('_br') ? 'br' : 'us';
  const versions = data.versions[key] ?? [];
  const inUse = versions[0];
  const isDefault = same(key, body, getForm(data.defaults, key));
  const leave = () => !dirty || confirm(t('Discard the changes you have not saved?', 'Descartar as alterações não salvas?'));
  const startOver = (next: FormBody | null) => {
    setDraft(next);
    setRound((n) => n + 1);
    setSaved(false);
    setError('');
  };
  const edit = (next: FormBody) => {
    setDraft(next);
    setSaved(false);
  };
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const count = key.startsWith('s2') ? (body as Section[]).reduce((n, s) => n + s.fields.length, 0) : body.length;

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div className="form-picker" role="tablist">
        {FORM_KEYS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-pressed={key === k}
            onClick={() => {
              if (k === key || !leave()) return;
              setKey(k);
              startOver(null);
            }}
          >
            {tl(FORM_TITLES[k])}
            {data.versions[k]?.[0]?.edited ? <i className="dot info" title={t('Edited', 'Editado')} /> : null}
          </button>
        ))}
      </div>

      <div className="glass pad stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <div className="row between wrapping" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ '--gap': '4px' } as React.CSSProperties}>
            <h3>{tl(FORM_TITLES[key])}</h3>
            <p className="small muted">
              {count} {t('question(s)', 'pergunta(s)')} ·{' '}
              {inUse?.edited
                ? t(`Edited by ${inUse.created_by} on ${when(inUse.created_at)}`, `Editado por ${inUse.created_by} em ${when(inUse.created_at)}`)
                : t('Original version in use', 'Versão original em uso')}
            </p>
          </div>
          <div className="row wrapping" style={{ '--gap': '8px' } as React.CSSProperties}>
            {!isDefault && (
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy}
                onClick={() => {
                  if (confirm(t('Load the original questions into the editor? Nothing changes until you save.', 'Carregar as perguntas originais no editor? Nada muda até você salvar.'))) startOver(getForm(data.defaults, key));
                }}
              >
                <RotateCcw size={14} /> {t('Reset to original', 'Voltar ao original')}
              </button>
            )}
            {dirty && (
              <button type="button" className="btn sm" disabled={busy} onClick={() => startOver(null)}>
                <Undo2 size={14} /> {t('Discard changes', 'Descartar alterações')}
              </button>
            )}
            <button
              type="button"
              className="btn primary sm"
              disabled={busy || !dirty || !!problem}
              onClick={() =>
                run(async () => {
                  await api.put(`/admin/forms/${key}`, { body: canonicalForm(key, body), base: inUse?.id ?? 0 });
                  await load();
                  await refresh();
                  startOver(null);
                  setSaved(true);
                })
              }
            >
              <Save size={14} /> {t('Save changes', 'Salvar alterações')}
            </button>
          </div>
        </div>

        {problem && <p className="error">{tl(problem)}</p>}
        {error && <p className="error">{error}</p>}
        {saved && !dirty && <div className="banner good">{t('Saved. People who answer from now on get this version.', 'Salvo. Quem responder a partir de agora recebe esta versão.')}</div>}
        {dirty && !problem && (
          <div className="banner">
            {t(
              'You have changes that are not saved. Once saved they apply to everyone who answers from then on; results already given keep their wording and score.',
              'Há alterações não salvas. Depois de salvas, valem para quem responder a partir de então; resultados já emitidos mantêm o texto e a nota.',
            )}
          </div>
        )}

        {key === 's4' ? (
          <DisclosureEditor key={round} value={body as Disclosure[]} onChange={edit} />
        ) : key.startsWith('s1') ? (
          <ScreenEditor key={round} kind={kind} value={body as ChoiceQuestion[]} onChange={edit} />
        ) : (
          <HealthEditor key={round} kind={kind} value={body as Section[]} onChange={edit} />
        )}

        {versions.length > 0 && (
          <details className="versions">
            <summary>
              <History size={14} /> {t('Earlier versions', 'Versões anteriores')} ({versions.length})
            </summary>
            <div className="stack" style={{ '--gap': '6px', marginTop: 10 } as React.CSSProperties}>
              {versions.map((v, i) => (
                <div key={v.id} className="row between small wrapping">
                  <span>
                    {when(v.created_at)} <span className="faint">· {v.created_by}</span> {!v.edited && <Chip>{t('Original', 'Original')}</Chip>} {i === 0 && <Chip tone="good">{t('In use', 'Em uso')}</Chip>}
                  </span>
                  {i > 0 && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busy}
                      onClick={() => {
                        if (!leave()) return;
                        run(async () => startOver((await api.get<{ body: FormBody }>(`/admin/forms/${key}/versions/${v.id}`)).body));
                      }}
                    >
                      {t('Load into editor', 'Carregar no editor')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
