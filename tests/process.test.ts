import { describe, expect, it } from 'vitest';
import { DOCS, docsFor } from '../shared/documents';
import * as P from '../shared/process';
import { DEFAULT_FORMS as F, METRICS, canonicalForm, formProblem, mergeForms, planFor, type ChoiceQuestion, type Forms, type Kind, type Section, type Stage1Answers, type Stage2Answers, type Stage4Answers } from '../shared/process';

// The shipped questionnaires, unless a test passes its own.
const QUESTIONS = F.s1;
const scoreStage1 = (k: Kind, a: Stage1Answers, forms: Forms = F) => P.scoreStage1(k, a, forms);
const stage1Complete = (k: Kind, a: Stage1Answers, forms: Forms = F) => P.stage1Complete(k, a, forms);
const scoreStage2 = (k: Kind, a: Stage2Answers, forms: Forms = F) => P.scoreStage2(k, a, forms);
const stage2Complete = (k: Kind, a: Stage2Answers, forms: Forms = F) => P.stage2Complete(k, a, forms);
const stage4Complete = (a: Stage4Answers | null, forms: Forms = F) => P.stage4Complete(a, forms);

const best = (kind: Kind): Stage1Answers => Object.fromEntries(QUESTIONS[kind].map((q) => [q.id, q.options.find((o) => o.level === 'pass')!.value]));

describe.each(['us', 'br'] as const)('stage 1: L-1 screen (%s)', (kind) => {
  it('keeps the screen to nine questions, each tied to a requirement', () => {
    expect(QUESTIONS[kind]).toHaveLength(9);
    expect(QUESTIONS[kind].every((q) => q.req.en && q.req.pt)).toBe(true);
    expect(QUESTIONS[kind].every((q) => q.options.every((o) => o.level === 'pass' || o.note))).toBe(true);
  });

  it('rates an all-pass record Compliant', () => {
    expect(scoreStage1(kind, best(kind))).toMatchObject({ rating: 'compliant', passed: true, score: 100 });
  });

  it('rejects incomplete or unknown answers', () => {
    const first = QUESTIONS[kind][0].id;
    expect(() => scoreStage1(kind, { ...best(kind), [first]: 'made-up' })).toThrow();
    const { [first]: _dropped, ...partial } = best(kind);
    expect(stage1Complete(kind, partial)).toBe(false);
    expect(() => scoreStage1(kind, partial)).toThrow();
  });
});

describe('stage 1: U.S. business', () => {
  it('passes with gaps when the buyer would have to add structure', () => {
    const r = scoreStage1('us', { ...best('us'), employees: '1to2', premises: 'home_virtual' });
    expect(r).toMatchObject({ rating: 'gaps', passed: true });
    expect(r.findings.filter((f) => f.level === 'caution').map((f) => f.id)).toEqual(['employees', 'premises']);
  });

  it('treats a company under one year, or an asset sale, as a new-office gap', () => {
    for (const patch of [{ years: 'lt1' }, { structure: 'assets' }] as Stage1Answers[]) {
      expect(scoreStage1('us', { ...best('us'), ...patch })).toMatchObject({ rating: 'gaps', passed: true });
    }
  });

  it('stops a business where a tiny team leaves the owner doing the work', () => {
    const r = scoreStage1('us', { ...best('us'), employees: '1to2', runs: 'owner_does' });
    expect(r).toMatchObject({ rating: 'not_compliant', passed: false });
    expect(r.findings.find((f) => f.id === 'runs')).toMatchObject({ level: 'fail' });
    expect(scoreStage1('us', { ...best('us'), employees: '3to9', runs: 'owner_does' }).passed).toBe(true);
  });

  it.each([
    ['activity', 'passive'],
    ['employees', '0'],
    ['sale', 'minority'],
    ['transfer', 'no'],
    ['records', 'informal'],
  ])('stops the business when %s = %s', (id, value) => {
    expect(scoreStage1('us', { ...best('us'), [id]: value })).toMatchObject({ rating: 'not_compliant', passed: false });
  });
});

describe('stage 1: candidate', () => {
  it.each([
    ['role', 'other'],
    ['tenure', 'no'],
    ['pay_trail', 'no'],
    ['company_age', 'lt1'],
    ['employees', '0'],
    ['continues', 'no'],
    ['ownership', 'minority'],
    ['us_role', 'operate'],
  ])('stops the candidate when %s = %s', (id, value) => {
    expect(scoreStage1('br', { ...best('br'), [id]: value })).toMatchObject({ rating: 'not_compliant', passed: false });
  });

  it('accepts an affiliate structure and a function manager', () => {
    expect(scoreStage1('br', { ...best('br'), ownership: 'same_owners', manages: 'function' })).toMatchObject({ rating: 'compliant' });
  });

  it('stops a hands-on candidate with a tiny team', () => {
    expect(scoreStage1('br', { ...best('br'), manages: 'hands_on' })).toMatchObject({ rating: 'gaps', passed: true });
    expect(scoreStage1('br', { ...best('br'), manages: 'hands_on', employees: '1to2' })).toMatchObject({ rating: 'not_compliant', passed: false });
  });
});

const started = { as_of: '2026-11', started_year: 2015, started_month: 3 };
// Year to date covers January to October, so 1.25M scales to 1.5M a year.
const usGood = { ...started, price: 800_000, rev_2024: 1_300_000, rev_2025: 1_400_000, rev_ytd: 1_250_000, sde: 280_000, employees: 8, lease_years: 5, owner_hours: 20, top_customer_pct: 10, debt: 100_000, seller_note: 'yes20', sale_reason: 'retirement' };
const brGood = { ...started, rev_2024: 3_000_000, rev_2025: 3_600_000, rev_ytd: 3_500_000, profit: 600_000, cash: 1_500_000, debt: 300_000, invest_usd: 900_000, tax_status: 'good' };

describe('stage 2: U.S. business health', () => {
  it('rates a growing, staffed, fairly priced business Healthy', () => {
    const r = scoreStage2('us', usGood);
    expect(r).toMatchObject({ rating: 'healthy', passed: true, score: 100 });
    expect(r.metrics.map((m) => m.id)).toEqual(['rev_trend', 'margin', 'multiple', 'salary', 'return', 'debt', 'team', 'lease', 'owner', 'concentration', 'reason', 'financing']);
    expect(r.metrics.find((m) => m.id === 'multiple')?.value).toBe('2.9×');
    expect(r.metrics.find((m) => m.id === 'salary')?.value).toBe('$205,000');
    expect(r.metrics.find((m) => m.id === 'return')?.value).toBe('25.6%/yr');
    expect(r.metrics.find((m) => m.id === 'debt')?.value).toBe('0.4× earnings');
  });

  it('rates a business with a few soft spots Watch and keeps the gate open', () => {
    const r = scoreStage2('us', { ...usGood, lease_years: 0, owner_hours: 40, top_customer_pct: 25, employees: 4 });
    expect(r).toMatchObject({ rating: 'watch', passed: true });
  });

  it('rates an overpriced business that is its owner Weak and closes the gate', () => {
    const r = scoreStage2('us', { ...usGood, price: 900_000, sde: 60_000, employees: 1, owner_hours: 70, sale_reason: 'declining' });
    const grade = (id: string) => r.metrics.find((m) => m.id === id)?.grade;
    expect([grade('multiple'), grade('salary'), grade('return'), grade('team'), grade('owner'), grade('reason')]).toEqual(['weak', 'weak', 'weak', 'weak', 'weak', 'weak']);
    expect(r).toMatchObject({ rating: 'weak', passed: false });
  });

  it('shows a loss as a negative amount', () => {
    const r = scoreStage2('us', { ...usGood, sde: -20_000 });
    expect(r.metrics.find((m) => m.id === 'salary')?.value).toBe('-$95,000');
    expect(r.metrics.find((m) => m.id === 'multiple')?.value).toBe('n/a');
  });
});

describe('stage 2: candidate company health', () => {
  it('rates a growing, profitable, funded company Healthy', () => {
    const r = scoreStage2('br', brGood);
    expect(r).toMatchObject({ rating: 'healthy', passed: true });
    expect(r.metrics.map((m) => m.id)).toEqual(['rev_trend', 'margin', 'runway', 'debt', 'tax', 'capacity', 'funding']);
    expect(r.metrics.find((m) => m.id === 'rev_trend')?.value).toBe('+18.3%/yr');
  });

  it('sizes what the company can send after a reserve, its debt and a weaker real', () => {
    // 2025: 3.6M revenue − 0.6M profit = 3.0M costs, so a 3-month reserve is 750k. (1.5M − 750k − 300k) ÷ (5.5 × 1.15)
    expect(scoreStage2('br', brGood).metrics.find((m) => m.id === 'capacity')).toMatchObject({ value: '$71,146', grade: 'ok' });
    const funded = scoreStage2('br', { ...brGood, cash: 8_000_000 });
    expect(funded.metrics.find((m) => m.id === 'capacity')?.grade).toBe('good');
    expect(funded).toMatchObject({ rating: 'healthy', score: 100 });
  });

  it('flags two straight revenue declines as weak', () => {
    const r = scoreStage2('br', { ...brGood, rev_2024: 5_000_000, rev_2025: 4_600_000, rev_ytd: 3_500_000 });
    expect(r.metrics.find((m) => m.id === 'rev_trend')?.grade).toBe('weak');
    expect(r.rating).toBe('watch');
  });

  it('rates a loss-making, indebted, unfunded company Weak', () => {
    const r = scoreStage2('br', { ...brGood, profit: -200_000, cash: 20_000, debt: 2_000_000, tax_status: 'issues', invest_usd: 20_000 });
    expect(r).toMatchObject({ rating: 'weak', passed: false });
  });
});

describe('stage 2: periods', () => {
  const ids = (a: Record<string, number | string>) => planFor(a)?.periods.map((p) => `${p.id}:${p.months}`);

  it('asks for the two last full years and the year to date', () => {
    expect(ids(started)).toEqual(['rev_2024:12', 'rev_2025:12', 'rev_ytd:10']);
    expect(planFor(started)?.periods.map((p) => p.label.en)).toEqual(['2024', '2025', '2026, January to October']);
    expect(planFor(started)?.earnings.id).toBe('rev_2025');
  });

  it('skips periods before the business started', () => {
    expect(ids({ as_of: '2026-11', started_year: 2025, started_month: 5 })).toEqual(['rev_2025:8', 'rev_ytd:10']);
    expect(planFor({ as_of: '2026-11', started_year: 2025, started_month: 5 })?.periods[0].label.en).toBe('2025, from May');
    // Two months of 2025 are too few to report; earnings then come from the year to date.
    const late = { as_of: '2026-11', started_year: 2025, started_month: 11 };
    expect(ids(late)).toEqual(['rev_ytd:10']);
    expect(planFor(late)?.earnings.id).toBe('rev_ytd');
    expect(ids({ as_of: '2026-11', started_year: 2026, started_month: 4 })).toEqual(['rev_ytd:7']);
    expect(planFor({ as_of: '2026-11', started_year: 2026, started_month: 4 })?.periods[0].label.pt).toBe('2026, abril a outubro');
    expect(ids({ as_of: '2026-11', started_year: 2026, started_month: 11 })).toEqual(['rev_ytd:1']);
  });

  it('asks for three full years early in the year', () => {
    expect(ids({ as_of: '2027-02', started_year: 2015, started_month: 3 })).toEqual(['rev_2024:12', 'rev_2025:12', 'rev_2026:12']);
  });

  it('rejects a start in the future or a missing date', () => {
    expect(planFor({ as_of: '2026-11', started_year: 2026, started_month: 12 })).toBeNull();
    expect(planFor({ as_of: '2026-11', started_year: 2027, started_month: 1 })).toBeNull();
    expect(planFor({ as_of: '2026-11' })).toBeNull();
    expect(stage2Complete('us', { ...usGood, as_of: 'soon' })).toBe(false);
  });

  it('scales a partial year before comparing it', () => {
    // Opened May 2025: 800k in 8 months is 1.2M a year; 1.25M in 10 months is 1.5M a year.
    const { rev_2024: _unused, ...rest } = usGood;
    const r = scoreStage2('us', { ...rest, started_year: 2025, started_month: 5, rev_2025: 800_000, sde: 160_000 });
    expect(r.metrics.find((m) => m.id === 'rev_trend')?.value).toBe('+25.0%/yr');
    expect(r.metrics.find((m) => m.id === 'margin')?.value).toBe('20.0%');
    expect(r.metrics.find((m) => m.id === 'multiple')?.value).toBe('3.3×');
  });

  it('gives a business with one period no trend', () => {
    const { rev_2024: _a, rev_2025: _b, ...rest } = usGood;
    const r = scoreStage2('us', { ...rest, started_year: 2026, started_month: 2 });
    expect(r.metrics.find((m) => m.id === 'rev_trend')).toMatchObject({ value: 'n/a', grade: 'ok' });
  });
});

describe('stage 2: form layout', () => {
  it.each(['us', 'br'] as const)('asks every built-in %s question once', (kind) => {
    const asked = P.fieldsFor(kind, started, F).map((f) => f.id);
    const expected = [...planFor(started)!.periods.map((p) => p.id), ...P.BUILTIN_FIELDS[kind].filter((f) => f.kind !== 'revenue').map((f) => f.id)];
    expect([...asked].sort()).toEqual(expected.sort());
  });

  it('holds back the dated questions until the start date is known', () => {
    const sections = P.sectionsFor('us', { as_of: '2026-11' }, F);
    expect(sections[0]).toMatchObject({ awaitsStart: true, fields: [] });
    expect(sections.flatMap((s) => s.fields).map((f) => f.id)).not.toContain('sde');
    expect(P.sectionsFor('us', started, F)[1].fields[0].label.en).toBe('Owner’s earnings (SDE), 2025');
  });
});

describe('stage 2: input checks', () => {
  it('needs every field of its own track', () => {
    expect(stage2Complete('us', usGood)).toBe(true);
    expect(stage2Complete('br', brGood)).toBe(true);
    expect(stage2Complete('us', brGood)).toBe(false);
    const { price: _price, ...noPrice } = usGood;
    expect(stage2Complete('us', noPrice)).toBe(false);
  });

  it('rejects negative, out-of-range and unknown values', () => {
    expect(stage2Complete('us', { ...usGood, rev_2024: -5 })).toBe(false);
    expect(stage2Complete('us', { ...usGood, top_customer_pct: 140 })).toBe(false);
    expect(stage2Complete('us', { ...usGood, sale_reason: 'bored' })).toBe(false);
    expect(stage2Complete('us', { ...usGood, sde: -5 })).toBe(true);
    expect(() => scoreStage2('br', { ...brGood, cash: Number.NaN })).toThrow();
  });
});

describe('stage 4: owners and disclosures', () => {
  const disclosures = { lawsuits: 'no', tax_liens: 'no', bankruptcy: 'no', criminal: 'yes' };
  it('accepts a full owner list with every question answered', () => {
    expect(stage4Complete({ owners: [{ name: 'Ann Lee', pct: 60, role: 'CEO' }, { name: 'Bo Lee', pct: 40, role: '' }], disclosures })).toBe(true);
  });
  it('rejects missing owners, shares over 100% and unanswered questions', () => {
    expect(stage4Complete(null)).toBe(false);
    expect(stage4Complete({ owners: [], disclosures })).toBe(false);
    expect(stage4Complete({ owners: [{ name: 'Ann Lee', pct: 70, role: '' }, { name: 'Bo Lee', pct: 40, role: '' }], disclosures })).toBe(false);
    expect(stage4Complete({ owners: [{ name: 'Ann Lee', pct: 100, role: '' }], disclosures: { lawsuits: 'no' } })).toBe(false);
  });
});

describe('document checklists', () => {
  it('has unique keys', () => {
    expect(new Set(DOCS.map((d) => d.key)).size).toBe(DOCS.length);
  });

  it.each(['us', 'br'] as const)('asks %s for five core documents, then opens the rest', (kind) => {
    const core = docsFor(kind, 3);
    expect(core).toHaveLength(5);
    expect(core.every((d) => d.kind === kind && d.stage === 3 && !d.optional)).toBe(true);
    const all = docsFor(kind, 4);
    expect(all.length).toBeGreaterThan(core.length);
    expect(all.every((d) => d.kind === kind)).toBe(true);
  });
});

describe('editable questionnaires', () => {
  const edit = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

  it('accepts the shipped forms unchanged', () => {
    for (const key of P.FORM_KEYS) {
      const body = canonicalForm(key, P.getForm(F, key));
      expect(formProblem(key, body)).toBeNull();
      expect(body).toEqual(P.getForm(F, key));
    }
    expect(mergeForms({})).toBe(F);
  });

  it('scores an added, a removed and a reordered L-1 question', () => {
    const qs = edit(F.s1.us).filter((q) => q.id !== 'premises').reverse();
    const added: ChoiceQuestion = {
      id: 'q_new1',
      req: { en: 'Insurance', pt: '' },
      label: { en: 'Is the business insured?', pt: '' },
      options: [
        { value: 'o_yes', level: 'pass', label: { en: 'Yes', pt: 'Sim' } },
        { value: 'o_no', level: 'fail', label: { en: 'No', pt: 'Não' }, note: { en: 'Insurance is required.', pt: '' } },
      ],
    };
    const forms = mergeForms({ s1_us: [added, ...qs] });
    expect(forms.s1.us.map((q) => q.id)).toEqual(['q_new1', ...qs.map((q) => q.id)]);
    // Portuguese falls back to English when left blank.
    expect(forms.s1.us[0].req.pt).toBe('Insurance');

    expect(stage1Complete('us', best('us'), forms)).toBe(false);
    const { premises: _gone, ...rest } = best('us');
    const pass = scoreStage1('us', { ...rest, q_new1: 'o_yes' }, forms);
    expect(pass).toMatchObject({ rating: 'compliant', score: 100 });
    expect(pass.findings).toHaveLength(9);
    expect(pass.findings[0]).toMatchObject({ id: 'q_new1', topic: { en: 'Insurance' } });
    const fail = scoreStage1('us', { ...rest, q_new1: 'o_no' }, forms);
    expect(fail).toMatchObject({ rating: 'not_compliant', passed: false });
    expect(fail.findings[0].note?.en).toBe('Insurance is required.');
  });

  it('keeps the combined staffing rule only while both questions exist', () => {
    const answers = { ...best('us'), runs: 'owner_does', employees: '1to2' };
    expect(scoreStage1('us', answers).passed).toBe(false);
    const forms = mergeForms({ s1_us: F.s1.us.filter((q) => q.id !== 'employees') });
    const { employees: _gone, ...rest } = answers;
    expect(scoreStage1('us', rest, forms)).toMatchObject({ rating: 'gaps', passed: true });
  });

  it('refuses L-1 forms that could not be answered or passed', () => {
    const bad = (change: (qs: ChoiceQuestion[]) => void) => {
      const qs = edit(F.s1.us);
      change(qs);
      return formProblem('s1_us', canonicalForm('s1_us', qs))?.en;
    };
    expect(bad((qs) => qs.splice(0))).toMatch(/at least one question/);
    expect(bad((qs) => (qs[0].label.en = '  '))).toMatch(/Question 1 needs its text/);
    expect(bad((qs) => (qs[1].req.en = ''))).toMatch(/Question 2 needs a requirement name/);
    expect(bad((qs) => qs[0].options.splice(1))).toMatch(/at least two answers/);
    expect(bad((qs) => qs[0].options.forEach((o) => (o.level = 'fail')))).toMatch(/nobody could pass/);
    expect(bad((qs) => (qs[1].id = qs[0].id))).toMatch(/share an identifier/);
    expect(bad((qs) => (qs[0].options[1].value = qs[0].options[0].value))).toMatch(/share an identifier/);
    // A saved form that no longer validates falls back to the shipped one.
    expect(mergeForms({ s1_us: [], s4: 'garbage' })).toBe(F);
  });

  it('leaves out health results whose questions were removed', () => {
    const sections = edit(F.s2.us).map((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== 'price' && f.id !== 'lease_years') }));
    const forms = mergeForms({ s2_us: sections });
    const { price: _p, lease_years: _l, ...rest } = usGood;
    expect(stage2Complete('us', rest, forms)).toBe(true);
    const ids = scoreStage2('us', rest, forms).metrics.map((m) => m.id);
    const gone = METRICS.us.filter((m) => m.needs.includes('price') || m.needs.includes('lease_years')).map((m) => m.id);
    expect(gone).toEqual(['multiple', 'return', 'lease']);
    expect(ids).toEqual(METRICS.us.map((m) => m.id).filter((id) => !gone.includes(id)));
  });

  it('asks added health questions and scores the graded ones', () => {
    const sections: Section[] = [
      ...edit(F.s2.us),
      {
        id: 's_more',
        title: { en: 'More', pt: 'Mais' },
        fields: [
          {
            id: 'x_books',
            kind: 'choice',
            label: { en: 'Who keeps the books?', pt: 'Quem faz a contabilidade?' },
            options: [
              { value: 'o_cpa', label: { en: 'A CPA', pt: 'Um contador' }, grade: 'good' },
              { value: 'o_self', label: { en: 'The owner', pt: 'O dono' }, grade: 'weak', note: { en: 'Hire a bookkeeper.', pt: 'Contrate um contador.' } },
              { value: 'o_na', label: { en: 'Not sure', pt: 'Não sei' } },
            ],
          },
          { id: 'x_trucks', kind: 'number', label: { en: 'Vehicles', pt: 'Veículos' } },
          { id: 'x_notes', kind: 'text', label: { en: 'Anything else?', pt: 'Algo mais?' }, optional: true },
        ],
      },
    ];
    const forms = mergeForms({ s2_us: sections });
    expect(forms.s2.us).toHaveLength(5);
    expect(stage2Complete('us', usGood, forms)).toBe(false);
    const answers = { ...usGood, x_books: 'o_self', x_trucks: 4 };
    expect(stage2Complete('us', answers, forms)).toBe(true);
    expect(stage2Complete('us', { ...answers, x_books: 'nope' }, forms)).toBe(false);
    expect(stage2Complete('us', { ...answers, x_notes: 'x'.repeat(501) }, forms)).toBe(false);

    const r = scoreStage2('us', { ...answers, x_notes: 'Two locations' }, forms);
    expect(r.metrics.at(-1)).toMatchObject({ id: 'x_books', grade: 'weak', valueL: { pt: 'O dono' }, note: { en: 'Hire a bookkeeper.' } });
    expect(r.extra).toEqual([
      { id: 'x_trucks', label: { en: 'Vehicles', pt: 'Veículos' }, value: '4' },
      { id: 'x_notes', label: { en: 'Anything else?', pt: 'Algo mais?' }, value: 'Two locations' },
    ]);
    expect(r.score).toBeLessThan(100);
    // An ungraded answer is reported without counting toward the score.
    const neutral = scoreStage2('us', { ...answers, x_books: 'o_na' }, forms);
    expect(neutral.score).toBe(100);
    expect(neutral.extra?.[0]).toMatchObject({ id: 'x_books', valueL: { en: 'Not sure' } });
    expect(P.cleanStage2('us', { ...answers, junk: 1, x_notes: '' }, forms)).not.toHaveProperty('junk');
  });

  it('keeps the type and option values of built-in health questions fixed', () => {
    const sections = edit(F.s2.us) as unknown as { fields: Record<string, unknown>[] }[];
    const price = sections[3].fields[0];
    Object.assign(price, { kind: 'text', unit: 'BRL', allowNegative: true, label: { en: 'Price you want', pt: '' } });
    const note = sections[3].fields[1];
    note.options = [{ value: 'yes20', label: { en: 'Twenty or more', pt: '' } }, { value: 'made_up', label: { en: 'x', pt: 'x' } }];
    const body = canonicalForm('s2_us', sections) as Section[];
    expect(body[3].fields[0]).toEqual({ id: 'price', kind: 'money', unit: 'USD', label: { en: 'Price you want', pt: 'Price you want' } });
    expect(body[3].fields[1].options?.map((o) => o.value)).toEqual(['yes20', 'some', 'none']);
    // The reworded option is kept; the ones left out have no text, so the form is refused.
    expect(body[3].fields[1].options?.[0].label.en).toBe('Twenty or more');
    expect(formProblem('s2_us', body)?.en).toMatch(/Every answer/);
  });

  it('refuses health forms without revenue, with empty sections or foreign identifiers', () => {
    const bad = (change: (s: Section[]) => void) => {
      const sections = edit(F.s2.br);
      change(sections);
      return formProblem('s2_br', canonicalForm('s2_br', sections))?.en;
    };
    expect(bad((s) => s.shift())).toMatch(/revenue questions must stay/);
    expect(bad((s) => s[2].fields.splice(0))).toMatch(/has no questions/);
    expect(bad((s) => s[1].fields.push(s[1].fields[0]))).toMatch(/share an identifier/);
    expect(bad((s) => s[1].fields.push({ id: 'as_of', kind: 'text', label: { en: 'Hack', pt: '' } }))).toMatch(/identifier that is not allowed/);
    expect(bad((s) => s[1].fields.push({ id: 'x_abcd', kind: 'choice', label: { en: 'Pick', pt: '' }, options: [{ value: 'a', label: { en: 'A', pt: '' } }] }))).toMatch(/at least two answers/);
  });

  it('follows edited disclosures', () => {
    const forms = mergeForms({ s4: [...F.s4.slice(1), { id: 'q_env', label: { en: 'Any environmental claim?', pt: '' } }] });
    const owners = [{ name: 'Ann Lee', pct: 100, role: '' }];
    const all = Object.fromEntries(F.s4.map((d) => [d.id, 'no']));
    expect(stage4Complete({ owners, disclosures: all }, forms)).toBe(false);
    expect(stage4Complete({ owners, disclosures: { ...all, q_env: 'yes' } }, forms)).toBe(true);
    expect(stage4Complete({ owners, disclosures: {} }, mergeForms({ s4: [] }))).toBe(true);
  });
});
