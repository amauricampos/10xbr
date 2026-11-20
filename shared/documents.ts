import type { Kind, L } from './process';

/**
 * Document checklists per track, drawn from the attorney's L-1A petition list.
 * Stage 3 asks only for the core documents; stage 4 opens the rest.
 */

export type DocItem = {
  key: string;
  kind: Kind;
  stage: 3 | 4;
  label: L;
  hint?: L;
  optional?: boolean;
};

const d = (key: string, kind: Kind, stage: 3 | 4, en: string, pt: string, extra: Partial<DocItem> = {}): DocItem => ({
  key,
  kind,
  stage,
  label: { en, pt },
  ...extra,
});
const hint = (en: string, pt: string) => ({ hint: { en, pt } });
const optional = { optional: true };

export const DOCS: DocItem[] = [
  // U.S. business, core
  d('us_tax_returns', 'us', 3, 'Business tax returns, last two years', 'Declarações de imposto da empresa, dois últimos anos'),
  d('us_financials', 'us', 3, 'Profit and loss and balance sheet', 'DRE e balanço patrimonial', hint('Last full year and year to date.', 'Último ano completo e acumulado do ano.')),
  d('us_payroll', 'us', 3, 'Payroll report', 'Relatório de folha de pagamento', hint('Form 941 for the last four quarters, or a payroll service summary.', 'Formulário 941 dos últimos quatro trimestres, ou resumo do serviço de payroll.')),
  d('us_lease', 'us', 3, 'Lease or deed', 'Contrato de aluguel ou escritura'),
  d('us_formation', 'us', 3, 'Formation and ownership documents', 'Atos constitutivos e quadro societário', hint('Articles, operating agreement or bylaws, FEIN letter.', 'Articles, operating agreement ou bylaws, carta do FEIN.')),

  // U.S. business, verification
  d('us_owner_id', 'us', 4, 'Photo ID of each owner', 'Documento com foto de cada sócio'),
  d('us_bank', 'us', 4, 'Business bank statements, last 12 months', 'Extratos bancários da empresa, últimos 12 meses'),
  d('us_tax_third', 'us', 4, 'Business tax return, third year back', 'Declaração de imposto da empresa, terceiro ano anterior'),
  d('us_state_wage', 'us', 4, 'State quarterly wage reports, last four quarters', 'Relatórios estaduais de salários, últimos quatro trimestres'),
  d('us_staff_list', 'us', 4, 'Employee list with titles, duties and pay', 'Lista de funcionários com cargos, funções e salários', hint('An organizational chart works too.', 'Um organograma também serve.')),
  d('us_debts', 'us', 4, 'List of business debts and liens', 'Lista de dívidas e gravames do negócio', hint('Lender, balance and monthly payment. Write “none” if there are none.', 'Credor, saldo e parcela mensal. Escreva “nenhuma” se não houver.')),
  d('us_permits', 'us', 4, 'Business licenses and permits', 'Licenças e alvarás'),
  d('us_insurance', 'us', 4, 'Business insurance certificate', 'Certificado de seguro empresarial'),
  d('us_photos', 'us', 4, 'Photos of the premises, inside and outside', 'Fotos das instalações, internas e externas'),
  d('us_sales_tax', 'us', 4, 'Sales tax returns, last 12 months', 'Declarações de sales tax, últimos 12 meses', optional),
  d('us_customers', 'us', 4, 'Revenue by customer, top ten', 'Faturamento por cliente, dez maiores', optional),
  d('us_contracts', 'us', 4, 'Key customer, supplier or franchise agreements', 'Contratos-chave de clientes, fornecedores ou franquia', optional),
  d('us_assets', 'us', 4, 'Equipment and inventory list', 'Lista de equipamentos e estoque', optional),

  // Candidate, core
  d('br_formation', 'br', 3, 'Contrato social and amendments', 'Contrato social e alterações', hint('Showing the current owners and their shares.', 'Mostrando os sócios atuais e suas participações.')),
  d('br_tax_returns', 'br', 3, 'Company tax filings, last two years', 'Declarações fiscais da empresa, dois últimos anos', hint('ECF, DEFIS or PGDAS, as applicable.', 'ECF, DEFIS ou PGDAS, conforme o regime.')),
  d('br_financials', 'br', 3, 'Balance sheet and income statement, last two years', 'Balanço e DRE, dois últimos anos'),
  d('br_pay_records', 'br', 3, 'Your pay records for 12 continuous months', 'Seus comprovantes de remuneração de 12 meses contínuos', hint('Pró-labore, pay stubs or payroll.', 'Pró-labore, holerites ou folha.')),
  d('br_orgchart', 'br', 3, 'Organizational chart', 'Organograma', hint('Names, titles and who reports to whom.', 'Nomes, cargos e quem responde a quem.')),

  // Candidate, verification
  d('br_passport', 'br', 4, 'Passport', 'Passaporte'),
  d('br_resume', 'br', 4, 'Résumé / CV', 'Currículo'),
  d('br_bank', 'br', 4, 'Company bank statements, last 12 months', 'Extratos bancários da empresa, últimos 12 meses'),
  d('br_funds', 'br', 4, 'Proof of the funds to invest', 'Comprovação dos recursos para investir', hint('Statements showing where the money is and where it came from.', 'Extratos mostrando onde está o dinheiro e qual a origem.')),
  d('br_irpf', 'br', 4, 'Your personal income tax return (IRPF), last year', 'Sua declaração de imposto de renda (IRPF), último ano', hint('Shows your income from the company and where personal funds came from.', 'Mostra sua renda da empresa e a origem dos recursos pessoais.')),
  d('br_payroll', 'br', 4, 'Company payroll summary, last 12 months', 'Resumo da folha da empresa, últimos 12 meses'),
  d('br_clearance', 'br', 4, 'Tax clearance certificates', 'Certidões negativas de débitos', hint('Federal, state and municipal.', 'Federal, estadual e municipal.')),
  d('br_job_description', 'br', 4, 'Your job description with % of time per duty', 'Descrição do seu cargo com % de tempo por atividade'),
  d('br_successor', 'br', 4, 'Who runs the company after you move', 'Quem administra a empresa depois da sua mudança', hint('A short letter naming the person, plus the contrato social clause or power of attorney.', 'Uma carta curta indicando a pessoa, mais a cláusula do contrato social ou procuração.')),
  d('br_premises', 'br', 4, 'Lease or proof of premises', 'Contrato de aluguel ou prova do imóvel'),
  d('br_permits', 'br', 4, 'Business permits and registrations', 'Alvarás e registros'),
  d('br_invoices', 'br', 4, 'Sample of sales invoices', 'Amostra de notas fiscais de venda', optional),
  d('br_profile', 'br', 4, 'Company profile, website or photos', 'Perfil da empresa, site ou fotos', optional),
  d('br_diplomas', 'br', 4, 'Diplomas and certificates', 'Diplomas e certificados', optional),
];

/** Items requested from a track once it has reached the given stage. */
export function docsFor(kind: Kind, upToStage: number): DocItem[] {
  return DOCS.filter((x) => x.kind === kind && x.stage <= upToStage);
}

export const docLabel = (key: string): string => DOCS.find((x) => x.key === key)?.label.en ?? key;
