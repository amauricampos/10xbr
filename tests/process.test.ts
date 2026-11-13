import { describe, expect, it } from 'vitest';
import { DOCS, docsFor } from '../shared/documents';
import { QUESTIONS, fieldsFor, groupsFor, planFor, scoreStage1, scoreStage2, stage1Complete, stage2Complete, stage4Complete, type Kind, type Stage1Answers } from '../shared/process';

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
  it.each(['us', 'br'] as const)('places every %s field in exactly one group', (kind) => {
    const grouped = groupsFor(kind, started).flatMap((g) => g.fields);
    expect([...grouped].sort()).toEqual(fieldsFor(kind, started).map((f) => f.id).sort());
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
