import type { L, UsPlan } from './process';

/**
 * Document checklist, derived from the attorney's L-1A petition document list.
 * Stage 3 asks only for the essentials; stage 4 opens the rest of the list.
 */

export type DocSection = 'beneficiary' | 'foreign' | 'us' | 'role_abroad' | 'role_us';

export const SECTIONS: Record<DocSection, L> = {
  beneficiary: { en: 'You', pt: 'Você' },
  foreign: { en: 'Company abroad', pt: 'Empresa no exterior' },
  us: { en: 'U.S. company', pt: 'Empresa nos EUA' },
  role_abroad: { en: 'Your role abroad', pt: 'Seu cargo no exterior' },
  role_us: { en: 'Your U.S. role', pt: 'Seu cargo nos EUA' },
};

export type DocItem = {
  key: string;
  section: DocSection;
  stage: 3 | 4;
  label: L;
  hint?: L;
  /** Limit the item to some U.S. plans. Absent = always shown. */
  plans?: UsPlan[];
  optional?: boolean;
};

const d = (
  key: string,
  section: DocSection,
  stage: 3 | 4,
  en: string,
  pt: string,
  extra: Partial<DocItem> = {},
): DocItem => ({ key, section, stage, label: { en, pt }, ...extra });

export const DOCS: DocItem[] = [
  // Stage 3 — essentials
  d('passport', 'beneficiary', 3, 'Passport', 'Passaporte'),
  d('resume', 'beneficiary', 3, 'Résumé / CV', 'Currículo'),
  d('employment_proof', 'beneficiary', 3, 'Pay records for one continuous year', 'Comprovantes de remuneração de um ano contínuo', {
    hint: { en: 'Pay stubs, payroll or pró-labore within the last three years.', pt: 'Holerites, folha ou pró-labore dos últimos três anos.' },
  }),
  d('f_incorporation', 'foreign', 3, 'Incorporation and ownership documents', 'Atos constitutivos e quadro societário', {
    hint: { en: 'Articles, amendments, share ledger or ownership chart.', pt: 'Contrato social, alterações e quadro de sócios.' },
  }),
  d('f_tax_returns', 'foreign', 3, 'Company tax returns, last two years', 'Declarações de imposto da empresa, dois últimos anos'),
  d('f_financials', 'foreign', 3, 'Financial statements, last two years', 'Demonstrações financeiras, dois últimos anos'),
  d('f_bank', 'foreign', 3, 'Bank statements, last 12 months', 'Extratos bancários, últimos 12 meses'),
  d('f_payroll', 'foreign', 3, 'Payroll summary, last year', 'Resumo da folha de pagamento, último ano'),
  d('f_orgchart', 'foreign', 3, 'Organizational chart', 'Organograma'),
  d('us_listing', 'us', 3, 'Listing, CIM or broker package', 'Anúncio, CIM ou pacote do corretor', { plans: ['acquire'] }),
  d('us_target_financials', 'us', 3, 'Seller financials (P&L, tax returns as available)', 'Financeiro do vendedor (DRE, declarações disponíveis)', {
    plans: ['acquire'],
  }),
  d('us_incorporation', 'us', 3, 'Incorporation documents and FEIN letter', 'Atos constitutivos e carta do FEIN', { plans: ['existing'] }),
  d('us_financials', 'us', 3, 'Latest balance sheet or financial statements', 'Balanço ou demonstrações financeiras mais recentes', {
    plans: ['existing'],
  }),
  d('us_business_plan', 'us', 3, 'Business plan, draft is fine', 'Plano de negócios, pode ser rascunho', {
    plans: ['new_office', 'undecided'],
    optional: true,
  }),

  // Stage 4 — remainder of the attorney list
  d('diplomas', 'beneficiary', 4, 'Diplomas and transcripts', 'Diplomas e históricos'),
  d('certifications', 'beneficiary', 4, 'Certificates, licenses, professional certifications', 'Certificados, licenças e certificações', { optional: true }),
  d('exec_evidence', 'beneficiary', 4, 'Evidence of executive or managerial authority', 'Evidências de autoridade executiva ou gerencial', {
    hint: { en: 'Minutes, signed contracts, approvals, strategic emails.', pt: 'Atas, contratos assinados, aprovações, e-mails estratégicos.' },
  }),

  d('f_permits', 'foreign', 4, 'Business permits, licenses and registrations', 'Alvarás, licenças e registros'),
  d('f_bank_letter', 'foreign', 4, 'Bank reference letter', 'Carta de referência bancária'),
  d('f_premises', 'foreign', 4, 'Lease, deed or other evidence of premises', 'Contrato de aluguel, escritura ou prova do imóvel'),
  d('f_floorplan', 'foreign', 4, 'Office floor plan', 'Planta do escritório', { optional: true }),
  d('f_invoices', 'foreign', 4, 'Sales or commercial invoices', 'Notas fiscais de venda'),
  d('f_profile', 'foreign', 4, 'Annual report, brochure or company profile', 'Relatório anual, folder ou perfil da empresa'),
  d('f_dnb', 'foreign', 4, 'Dun & Bradstreet report', 'Relatório Dun & Bradstreet', { optional: true }),
  d('f_press', 'foreign', 4, 'Articles, promotional or advertising materials', 'Matérias, materiais promocionais ou publicitários', { optional: true }),
  d('f_web', 'foreign', 4, 'Website and social media screenshots', 'Capturas do site e redes sociais'),
  d('f_photos', 'foreign', 4, 'Photos of the facilities, inside and outside', 'Fotos das instalações, internas e externas'),

  d('us_fein', 'us', 4, 'FEIN issuance letter', 'Carta de emissão do FEIN', { plans: ['acquire', 'new_office', 'undecided'] }),
  d('us_inc_full', 'us', 4, 'Incorporation documents, bylaws, share certificates', 'Atos constitutivos, estatuto, certificados de ações', {
    plans: ['acquire', 'new_office', 'undecided'],
  }),
  d('us_branch', 'us', 4, 'State qualification to do business', 'Qualificação estadual para operar', { optional: true }),
  d('us_permits', 'us', 4, 'Business permits, licenses and registrations', 'Alvarás, licenças e registros'),
  d('us_tax_return', 'us', 4, 'Company tax return, most recent', 'Declaração de imposto da empresa, mais recente', { optional: true }),
  d('us_bank_letter', 'us', 4, 'U.S. bank reference letter', 'Carta de referência de banco dos EUA'),
  d('us_bank', 'us', 4, 'U.S. company bank statements', 'Extratos bancários da empresa nos EUA'),
  d('us_insurance', 'us', 4, 'Business insurance policy or certificate', 'Apólice ou certificado de seguro empresarial'),
  d('us_plan_final', 'us', 4, 'Business plan', 'Plano de negócios', { optional: true }),
  d('us_lease', 'us', 4, 'Lease, deed, mortgage statement or rent receipts', 'Contrato de aluguel, escritura ou recibos'),
  d('us_floorplan', 'us', 4, 'Office floor plan', 'Planta do escritório', { optional: true }),
  d('us_invoices', 'us', 4, 'Sales or commercial invoices', 'Notas fiscais de venda', { optional: true }),
  d('us_orgchart', 'us', 4, 'Organizational chart', 'Organograma'),
  d('us_941', 'us', 4, 'IRS Form 941, last four quarters', 'Formulário 941 do IRS, últimos quatro trimestres', { optional: true }),
  d('us_state_wage', 'us', 4, 'State quarterly wage reports, last four quarters', 'Relatórios estaduais de salários, últimos quatro trimestres', { optional: true }),
  d('us_profile', 'us', 4, 'Annual report, brochure or company profile', 'Relatório anual, folder ou perfil da empresa', { optional: true }),
  d('us_web', 'us', 4, 'Website and social media screenshots', 'Capturas do site e redes sociais', { optional: true }),
  d('us_photos', 'us', 4, 'Photos of the facilities, inside and outside', 'Fotos das instalações, internas e externas'),
  d('us_structure_changes', 'us', 4, 'Changes affecting the corporate structure', 'Mudanças na estrutura societária', { optional: true }),

  d('ra_job_description', 'role_abroad', 4, 'Detailed job description with % of time per duty', 'Descrição detalhada do cargo com % de tempo por atividade'),
  d('ra_orgchart', 'role_abroad', 4, 'Personnel chart: names, titles, duties, education, salary', 'Organograma de pessoal: nomes, cargos, funções, formação, salário'),
  d('ra_supervision', 'role_abroad', 4, 'Work product showing supervision', 'Evidências de supervisão', {
    hint: { en: 'Performance reviews, hiring recommendations, approvals, delegation records.', pt: 'Avaliações, recomendações de contratação, aprovações, delegações.' },
  }),
  d('ra_payroll', 'role_abroad', 4, 'Payroll records of the employees you direct', 'Folha dos funcionários sob sua direção'),
  d('ra_agreements', 'role_abroad', 4, 'Employment agreements for recent hires', 'Contratos de trabalho de contratações recentes', { optional: true }),

  d('ru_job_description', 'role_us', 4, 'Detailed U.S. job description with % of time per duty', 'Descrição detalhada do cargo nos EUA com % de tempo por atividade'),
  d('ru_orgchart', 'role_us', 4, 'Proposed U.S. personnel chart', 'Organograma de pessoal proposto nos EUA'),
  d('ru_supervision', 'role_us', 4, 'Evidence of how you will supervise', 'Evidências de como você vai supervisionar', {
    hint: { en: 'Reporting lines, review templates, corporate resolutions.', pt: 'Linhas de reporte, modelos de avaliação, resoluções societárias.' },
  }),
  d('ru_payroll', 'role_us', 4, 'Payroll records of the U.S. employees you will direct', 'Folha dos funcionários nos EUA sob sua direção', { optional: true }),
  d('ru_assignment', 'role_us', 4, 'Assignment letter or employment agreement', 'Carta de transferência ou contrato de trabalho', {
    hint: { en: 'Terms of assignment, compensation and salary.', pt: 'Termos da transferência, remuneração e salário.' },
  }),
];

export function docsFor(plan: UsPlan, upToStage: number): DocItem[] {
  return DOCS.filter((x) => x.stage <= upToStage && (!x.plans || x.plans.includes(plan)));
}

export const DOC_KEYS = new Set(DOCS.map((x) => x.key));

/** Staff-run verification steps in stage 4. */
export const CHECKS: { key: string; label: L; blurb: L }[] = [
  {
    key: 'identity',
    label: { en: 'Identity and background check', pt: 'Identidade e antecedentes' },
    blurb: { en: 'With your written consent.', pt: 'Com o seu consentimento por escrito.' },
  },
  {
    key: 'sanctions',
    label: { en: 'Sanctions and watchlist screening', pt: 'Listas de sanções e restrições' },
    blurb: { en: 'Applicant, company and owners.', pt: 'Candidato, empresa e sócios.' },
  },
  {
    key: 'ownership',
    label: { en: 'Ownership chain', pt: 'Cadeia societária' },
    blurb: { en: 'Who owns and controls each company.', pt: 'Quem detém e controla cada empresa.' },
  },
  {
    key: 'tax_analysis',
    label: { en: 'Tax return analysis', pt: 'Análise das declarações de imposto' },
    blurb: { en: 'Returns against financial statements.', pt: 'Declarações contra demonstrações financeiras.' },
  },
  {
    key: 'bank_analysis',
    label: { en: 'Bank statement reconciliation', pt: 'Conciliação de extratos bancários' },
    blurb: { en: 'Deposits against reported revenue.', pt: 'Depósitos contra o faturamento declarado.' },
  },
  {
    key: 'source_of_funds',
    label: { en: 'Source and path of funds', pt: 'Origem e caminho dos recursos' },
    blurb: { en: 'From the company abroad to the U.S. company.', pt: 'Da empresa no exterior até a empresa nos EUA.' },
  },
  {
    key: 'public_records',
    label: { en: 'Public records, liens and litigation', pt: 'Registros públicos, ônus e processos' },
    blurb: { en: 'Both companies.', pt: 'Ambas as empresas.' },
  },
  {
    key: 'attorney_review',
    label: { en: 'Attorney review', pt: 'Revisão do advogado' },
    blurb: { en: 'Immigration counsel confirms the file.', pt: 'O advogado de imigração confirma o dossiê.' },
  },
];

export const CHECK_KEYS = new Set(CHECKS.map((c) => c.key));
export type CheckStatus = 'pending' | 'in_progress' | 'clear' | 'issue';
