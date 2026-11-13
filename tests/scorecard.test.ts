import { describe, expect, it } from 'vitest';
import { QUESTIONS, scoreStage1, type Kind, type Stage1Answers } from '../shared/process';
import { scorecardEmail } from '../worker/scorecard';

const pick = (kind: Kind, level: 'pass' | 'fail'): Stage1Answers =>
  Object.fromEntries(QUESTIONS[kind].map((q) => [q.id, (q.options.find((o) => o.level === level) ?? q.options[0]).value]));

describe('scorecard email', () => {
  it('reports requirements met instead of a percentage', () => {
    const result = scoreStage1('us', pick('us', 'pass'));
    const mail = scorecardEmail({ kind: 'us', lang: 'en', name: 'Dana Reyes', result, link: 'https://10xbr.com/resume/abc' });
    expect(mail.subject).toBe('Your L-1 scorecard: 8 of 8 requirements met');
    expect(mail.html).toContain('Hi Dana,');
    expect(mail.html).toContain('https://10xbr.com/resume/abc');
    expect(mail.text).toContain('8 of 8 requirements met');
  });

  it('lists every requirement and marks the failed ones', () => {
    const result = scoreStage1('br', pick('br', 'fail'));
    const mail = scorecardEmail({ kind: 'br', lang: 'pt', name: 'Ana', result, link: 'https://x.test/r' });
    expect(mail.html.match(/<tr>\n<td style="padding:12px 0;border-top/g)).toHaveLength(8);
    expect(mail.html).toContain('Não atendido');
    expect(mail.subject).toMatch(/^Seu scorecard L-1: \d de 8/);
  });

  it('escapes the name', () => {
    const result = scoreStage1('us', pick('us', 'pass'));
    const mail = scorecardEmail({ kind: 'us', lang: 'en', name: '<img src=x onerror=alert(1)> B', result, link: 'https://x.test/r' });
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img');
  });
});
