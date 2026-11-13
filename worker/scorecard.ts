import { KINDS, STAGE1_HEADLINE, STAGE1_RATING, type Kind, type Stage1Result } from '../shared/process';
import type { Env } from './env';

type Lang = 'en' | 'pt';

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const COLOR = { pass: '#16a34a', caution: '#d97706', fail: '#dc2626' } as const;
const RATING_COLOR = { compliant: COLOR.pass, gaps: COLOR.caution, not_compliant: COLOR.fail } as const;
const MARK = { pass: '✓', caution: '!', fail: '✕' } as const;
const STATUS = {
  pass: { en: 'Met', pt: 'Atendido' },
  caution: { en: 'Needs attention', pt: 'Requer atenção' },
  fail: { en: 'Not met', pt: 'Não atendido' },
} as const;

/** The stage 1 result as an email. Every interpolated value is escaped. */
export function scorecardEmail(o: { kind: Kind; lang: Lang; name: string; result: Stage1Result; link: string }) {
  const { kind, lang, result } = o;
  const en = lang === 'en';
  const met = result.findings.filter((f) => f.level === 'pass').length;
  const total = result.findings.length;
  const headline = STAGE1_HEADLINE[kind][result.rating][lang];
  const rating = STAGE1_RATING[result.rating][lang];
  const first = o.name.trim().split(/\s+/)[0] ?? '';
  const subject = en ? `Your L-1 scorecard: ${met} of ${total} requirements met` : `Seu scorecard L-1: ${met} de ${total} requisitos atendidos`;
  const metLine = en ? `${met} of ${total} requirements met` : `${met} de ${total} requisitos atendidos`;
  const cta = result.passed ? (en ? 'Continue the evaluation' : 'Continuar a avaliação') : en ? 'Save and talk to our team' : 'Salvar e falar com a equipe';
  const next = result.passed
    ? en
      ? 'Next step: five minutes on the business numbers.'
      : 'Próximo passo: cinco minutos sobre os números do negócio.'
    : en
      ? 'Our team reviews every result and will reach out if there is a path forward.'
      : 'Nossa equipe revisa todo resultado e entrará em contato se houver um caminho.';
  const disclaimer = en
    ? '10xBR is a screening tool, not legal or investment advice. Only a licensed immigration attorney can advise on visa eligibility.'
    : 'A 10xBR é uma ferramenta de triagem, não aconselhamento jurídico ou de investimento. Somente um advogado de imigração habilitado pode orientar sobre elegibilidade a vistos.';

  const rows = result.findings
    .map(
      (f) => `<tr>
<td style="padding:12px 0;border-top:1px solid #e5e7eb;vertical-align:top;width:28px;font-weight:700;color:${COLOR[f.level]}">${MARK[f.level]}</td>
<td style="padding:12px 0;border-top:1px solid #e5e7eb;vertical-align:top">
<div style="font-size:13px;color:#6b7280">${esc(f.topic[lang])}</div>
<div style="font-weight:600;color:#111827">${esc(f.label[lang])}</div>
${f.level !== 'pass' && f.note ? `<div style="font-size:13px;color:#4b5563;margin-top:2px">${esc(f.note[lang])}</div>` : ''}
</td>
<td style="padding:12px 0 12px 12px;border-top:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;font-size:13px;font-weight:600;color:${COLOR[f.level]}">${STATUS[f.level][lang]}</td>
</tr>`,
    )
    .join('\n');

  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#070b14;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700">10x<span style="color:#8fb8ff;font-weight:400">BR</span>
<span style="float:right;font-size:12px;font-weight:400;color:#9ca3af;line-height:26px">${esc(KINDS[kind].title[lang])} · ${en ? 'L-1 scorecard' : 'Scorecard L-1'}</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px">${en ? 'Hi' : 'Olá'} ${esc(first)},</p>
<p style="margin:0 0 20px;color:#374151">${en ? 'Thank you for your answers. Here is your scorecard.' : 'Obrigado pelas respostas. Aqui está o seu scorecard.'}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px"><tr><td style="padding:18px 20px">
<div style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#ffffff;background:${RATING_COLOR[result.rating]}">${esc(rating)}</div>
<div style="font-size:26px;font-weight:700;margin-top:10px">${metLine}</div>
<div style="margin-top:6px;color:#374151">${esc(headline)}</div>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">${rows}</table>
<p style="margin:24px 0 8px"><a href="${esc(o.link)}" style="display:inline-block;background:#3b9bff;color:#06101f;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:999px">${cta}</a></p>
<p style="margin:0;color:#4b5563;font-size:14px">${next}</p>
</td></tr>
<tr><td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5">${disclaimer}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `${en ? 'Hi' : 'Olá'} ${first},`,
    '',
    `${rating}: ${metLine}`,
    headline,
    '',
    ...result.findings.map((f) => `[${STATUS[f.level][lang]}] ${f.topic[lang]} ${f.label[lang]}${f.level !== 'pass' && f.note ? ` (${f.note[lang]})` : ''}`),
    '',
    `${cta}: ${o.link}`,
    next,
    '',
    disclaimer,
  ].join('\n');

  return { subject, html, text };
}

export const mailReady = (env: Env) => !!(env.RESEND_API_KEY && env.MAIL_FROM);

/** Sends through Resend. Returns false when mail is not configured or the provider rejects it. */
export async function sendMail(env: Env, m: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  if (!mailReady(env)) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}) }),
  });
  if (!res.ok) console.error('mail_failed', res.status, (await res.text()).slice(0, 300));
  return res.ok;
}
