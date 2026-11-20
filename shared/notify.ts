import type { L } from './process';

/**
 * The emails a person can switch on or off. They always go to the email the account signs in with.
 * Emails a person asked for themselves (scorecard, password reset, invitation) are not listed: they are always sent.
 */
export type NotifyEvent = { id: string; role: 'staff' | 'applicant'; on: boolean; title: L; help: L };

export const NOTIFY_EVENTS: NotifyEvent[] = [
  {
    id: 'lead_new',
    role: 'staff',
    on: true,
    title: { en: 'New lead', pt: 'Novo contato' },
    help: { en: 'Someone answers the L-1 questions and leaves a name and email for the first time.', pt: 'Alguém responde às perguntas L-1 e deixa nome e e-mail pela primeira vez.' },
  },
  {
    id: 'account_created',
    role: 'staff',
    on: false,
    title: { en: 'New account', pt: 'Nova conta' },
    help: { en: 'An owner or candidate creates an account.', pt: 'Um dono ou candidato cria uma conta.' },
  },
  {
    id: 'review_requested',
    role: 'staff',
    on: true,
    title: { en: 'Step sent for review', pt: 'Etapa enviada para revisão' },
    help: { en: 'A record is waiting for a decision from the team.', pt: 'Um registro aguarda uma decisão da equipe.' },
  },
  {
    id: 'record_stopped',
    role: 'staff',
    on: false,
    title: { en: 'Record stopped at a gate', pt: 'Registro parado em uma etapa' },
    help: { en: 'An account’s L-1 screen or business health does not pass.', pt: 'A triagem L-1 ou a saúde do negócio de uma conta não passa.' },
  },
  {
    id: 'answers_changed',
    role: 'staff',
    on: false,
    title: { en: 'Answers changed', pt: 'Respostas alteradas' },
    help: { en: 'An owner changes answers already given, or takes a step back from review.', pt: 'Um dono altera respostas já dadas ou retira uma etapa da revisão.' },
  },
  {
    id: 'decision',
    role: 'applicant',
    on: true,
    title: { en: 'Decisions on your evaluation', pt: 'Decisões sobre a sua avaliação' },
    help: { en: 'Our team approves a step, sends one back with a note, or closes or reopens the evaluation.', pt: 'Nossa equipe aprova uma etapa, devolve uma com uma nota, ou encerra ou reabre a avaliação.' },
  },
];

/** The settings in force for a person: their saved choices over the defaults, limited to what their role can receive. */
export function notifyPrefs(role: 'staff' | 'applicant', stored: Record<string, unknown> | null | undefined): Record<string, boolean> {
  return Object.fromEntries(NOTIFY_EVENTS.filter((e) => e.role === role).map((e) => [e.id, typeof stored?.[e.id] === 'boolean' ? (stored[e.id] as boolean) : e.on]));
}
