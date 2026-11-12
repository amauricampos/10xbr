import { describe, expect, it } from 'vitest';
import { STAGE1, scoreStage1, scoreStage2, stage2Complete, type Stage1Answers } from '../shared/process';
import { DOCS, docsFor } from '../shared/documents';

const best: Stage1Answers = Object.fromEntries(STAGE1.map((q) => [q.id, q.options.find((o) => o.level === 'pass')!.value]));

describe('stage 1: L-1 quick check', () => {
  it('rates an all-pass profile Strong', () => {
    const r = scoreStage1(best);
    expect(r).toMatchObject({ rating: 'strong', passed: true, score: 100 });
  });

  it('rates a single caution Possible and still passes the gate', () => {
    const r = scoreStage1({ ...best, us_plan: 'new_office' });
    expect(r).toMatchObject({ rating: 'possible', passed: true });
    expect(r.findings.find((f) => f.id === 'us_plan')?.note?.en).toMatch(/New-office/);
  });

  it.each([
    ['tenure', 'no'],
    ['pay_trail', 'no'],
    ['role', 'other'],
    ['employees', '0'],
    ['continues', 'no'],
    ['ownership', 'minority'],
    ['company_age', 'lt1'],
  ])('stops the case when %s = %s', (id, value) => {
    const r = scoreStage1({ ...best, [id]: value });
    expect(r).toMatchObject({ rating: 'not_yet', passed: false });
  });

  it('rejects incomplete or unknown answers', () => {
    expect(() => scoreStage1({ ...best, role: 'ceo-of-everything' })).toThrow();
    const { role: _role, ...partial } = best;
    expect(() => scoreStage1(partial)).toThrow();
  });
});

const foreign = { rev_y1: 3_000_000, rev_y2: 3_600_000, rev_y3: 4_200_000, profit: 600_000, cash: 1_500_000, debt: 300_000, tax_status: 'good', invest_usd: 900_000 };
const target = { us_price: 800_000, us_rev_prior: 1_400_000, us_rev: 1_500_000, us_earnings: 280_000, us_employees: 8, us_years: 9, us_premises: 'commercial', us_lease_years: 5 };

describe('stage 2: business snapshot', () => {
  it('rates a growing, profitable company with a sound target Healthy', () => {
    const r = scoreStage2({ ...foreign, ...target }, 'acquire');
    expect(r.rating).toBe('healthy');
    expect(r.metrics.map((m) => m.id)).toEqual([
      'rev_trend', 'margin', 'runway', 'debt', 'tax', 'funding', 'us_trend', 'us_multiple', 'us_salary', 'us_staff', 'us_history', 'us_premises',
    ]);
    expect(r.metrics.find((m) => m.id === 'rev_trend')?.value).toBe('+18.3%/yr');
    expect(r.metrics.find((m) => m.id === 'us_multiple')?.value).toBe('2.9×');
  });

  it('flags two straight revenue declines as weak', () => {
    const r = scoreStage2({ ...foreign, rev_y1: 5_000_000, rev_y2: 4_600_000, rev_y3: 4_200_000 }, 'new_office');
    expect(r.metrics.find((m) => m.id === 'rev_trend')?.grade).toBe('weak');
    expect(r.rating).toBe('watch');
  });

  it('rates a loss-making, indebted company Weak and closes the gate', () => {
    const r = scoreStage2({ ...foreign, profit: -200_000, cash: 20_000, debt: 2_000_000, tax_status: 'issues', invest_usd: 20_000 }, 'new_office');
    expect(r).toMatchObject({ rating: 'weak', passed: false });
  });

  it('grades a target whose owner is the business as weak on structure', () => {
    const r = scoreStage2({ ...foreign, ...target, us_employees: 1, us_earnings: 60_000, us_premises: 'home_virtual' }, 'acquire');
    const grade = (id: string) => r.metrics.find((m) => m.id === id)?.grade;
    expect([grade('us_staff'), grade('us_salary'), grade('us_premises'), grade('us_multiple')]).toEqual(['weak', 'weak', 'weak', 'weak']);
    expect(r.passed).toBe(false);
  });

  it('asks for U.S. figures only when there is a U.S. business to measure', () => {
    expect(stage2Complete(foreign, 'new_office')).toBe(true);
    expect(stage2Complete(foreign, 'acquire')).toBe(false);
    const { us_price: _price, ...existing } = target;
    expect(stage2Complete({ ...foreign, ...existing }, 'existing')).toBe(true);
    expect(stage2Complete({ ...foreign, rev_y1: -5 }, 'new_office')).toBe(false);
  });
});

describe('document checklist', () => {
  it('has unique keys', () => {
    expect(new Set(DOCS.map((d) => d.key)).size).toBe(DOCS.length);
  });

  it('keeps stage 3 short and opens the full attorney list at stage 4', () => {
    const essentials = docsFor('acquire', 3);
    expect(essentials.length).toBeLessThanOrEqual(12);
    expect(essentials.every((d) => d.stage === 3)).toBe(true);
    expect(docsFor('acquire', 4).length).toBeGreaterThan(45);
    expect(docsFor('new_office', 3).some((d) => d.key === 'us_listing')).toBe(false);
  });
});
