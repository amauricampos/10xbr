/**
 * The 10xBR evaluation process, as data.
 *
 * Two independent tracks share the same four stages:
 *   us: an existing U.S. business, filled in by its owner. Is it a compliant
 *       L-1 acquisition, and is it a sound investment?
 *   br: a candidate's Brazilian business. Does it qualify the candidate for
 *       L-1, and can it support an acquisition?
 *
 * Everything that decides an outcome lives here: questions, thresholds and
 * scoring. The browser uses it for the instant result and the Worker
 * re-computes it as the authoritative one. This is a screening tool, never a
 * legal opinion: the attorney confirms.
 */

export type Lang = 'en' | 'pt';
export type L = { en: string; pt: string };
export type Level = 'pass' | 'caution' | 'fail';
export type Kind = 'us' | 'br';

/** Tunable defaults. Calibrate with the immigration attorney and the broker. */
export const PARAMS = {
  managerSalaryUsd: 75_000,
  residualMinPctOfEarnings: 0.2,
  priceMultipleGood: 3.5,
  priceMultipleOk: 5,
  fundsGoodUsd: 300_000,
  fundsOkUsd: 150_000,
  healthyMinPct: 0.75,
  watchMinPct: 0.5,
  watchMaxWeak: 2,
} as const;

export const KINDS: Record<Kind, { title: L; who: L; blurb: L }> = {
  us: {
    title: { en: 'U.S. business', pt: 'Negócio nos EUA' },
    who: { en: 'I own a business in the U.S.', pt: 'Tenho um negócio nos EUA' },
    blurb: {
      en: 'Find out if your business qualifies for our international buyers.',
      pt: 'Descubra se o seu negócio se qualifica para os nossos compradores internacionais.',
    },
  },
  br: {
    title: { en: 'Candidate', pt: 'Candidato' },
    who: { en: 'I own a business in Brazil', pt: 'Tenho uma empresa no Brasil' },
    blurb: {
      en: 'Find out if your company can support an L-1 visa through a U.S. acquisition.',
      pt: 'Descubra se a sua empresa sustenta um visto L-1 por meio de uma aquisição nos EUA.',
    },
  },
};

export type StageDef = { id: number; title: Record<Kind, L>; blurb: Record<Kind, L>; time: L };
const same = (en: string, pt: string): Record<Kind, L> => ({ us: { en, pt }, br: { en, pt } });

export const STAGES: StageDef[] = [
  {
    id: 1,
    title: { us: { en: 'L-1 compliance', pt: 'Conformidade L-1' }, br: { en: 'L-1 qualification', pt: 'Qualificação L-1' } },
    blurb: {
      us: { en: 'Eight one-tap questions about the business.', pt: 'Oito perguntas de um toque sobre o negócio.' },
      br: { en: 'Eight one-tap questions about you and your company.', pt: 'Oito perguntas de um toque sobre você e a sua empresa.' },
    },
    time: { en: '2 min', pt: '2 min' },
  },
  {
    id: 2,
    title: same('Business health', 'Saúde do negócio'),
    blurb: same('A handful of numbers that show health and trend.', 'Alguns números que mostram saúde e tendência.'),
    time: { en: '5 min', pt: '5 min' },
  },
  {
    id: 3,
    title: same('Core documents', 'Documentos principais'),
    blurb: same('Sign the NDA, then share five documents. AI reads each one first.', 'Assine o NDA e envie cinco documentos. A IA lê cada um primeiro.'),
    time: { en: '1–3 days', pt: '1–3 dias' },
  },
  {
    id: 4,
    title: { us: { en: 'Owners and verification', pt: 'Sócios e verificação' }, br: { en: 'Owners and verification', pt: 'Sócios e verificação' } },
    blurb: same('Who owns the company, a few disclosures and the remaining documents.', 'Quem são os sócios, algumas declarações e os documentos restantes.'),
    time: { en: '1–2 weeks', pt: '1–2 semanas' },
  },
];
export const LAST_STAGE = STAGES.length;

/* ------------------------------------------------------------------ */
/* Stage 1: L-1 screen                                                 */
/* ------------------------------------------------------------------ */

export type Option = { value: string; label: L; level: Level; note?: L };
export type ChoiceQuestion = { id: string; label: L; help?: L; options: Option[] };

const yes: L = { en: 'Yes', pt: 'Sim' };
const no: L = { en: 'No', pt: 'Não' };

/** Is this U.S. business something an L-1 investor can buy? */
const US_QUESTIONS: ChoiceQuestion[] = [
  {
    id: 'activity',
    label: { en: 'What does the business do?', pt: 'O que o negócio faz?' },
    help: { en: 'L-1 needs a business that actively sells goods or services.', pt: 'O L-1 exige um negócio que venda bens ou serviços ativamente.' },
    options: [
      { value: 'active', level: 'pass', label: { en: 'Sells goods or services all year', pt: 'Vende bens ou serviços o ano todo' } },
      {
        value: 'seasonal',
        level: 'caution',
        label: { en: 'Seasonal or part-time operation', pt: 'Operação sazonal ou em meio período' },
        note: { en: 'The business must operate regularly and continuously. Seasonal activity needs explaining.', pt: 'O negócio precisa operar de forma regular e contínua. Atividade sazonal precisa de explicação.' },
      },
      {
        value: 'passive',
        level: 'fail',
        label: { en: 'Mostly holds property or investments', pt: 'Principalmente detém imóveis ou investimentos' },
        note: { en: 'Passive holdings do not count as doing business for L-1.', pt: 'Participações passivas não contam como atividade empresarial para o L-1.' },
      },
    ],
  },
  {
    id: 'years',
    label: { en: 'How long has it been operating?', pt: 'Há quanto tempo opera?' },
    options: [
      {
        value: 'lt1',
        level: 'caution',
        label: { en: 'Less than 1 year', pt: 'Menos de 1 ano' },
        note: { en: 'Under one year, the stricter new-office rules apply to the buyer.', pt: 'Com menos de um ano, o comprador cai nas regras mais rígidas de new office.' },
      },
      { value: '1to3', level: 'pass', label: { en: '1 to 3 years', pt: '1 a 3 anos' } },
      { value: 'gt3', level: 'pass', label: { en: 'More than 3 years', pt: 'Mais de 3 anos' } },
    ],
  },
  {
    id: 'employees',
    label: { en: 'How many employees are on payroll, not counting owners?', pt: 'Quantos funcionários estão na folha, sem contar os sócios?' },
    options: [
      {
        value: '0',
        level: 'fail',
        label: { en: 'None, or contractors only', pt: 'Nenhum, ou apenas prestadores' },
        note: { en: 'An L-1 manager needs employees to manage. With none, the buyer would be doing the work.', pt: 'Um gerente L-1 precisa de funcionários para gerenciar. Sem eles, o comprador faria o trabalho.' },
      },
      {
        value: '1to2',
        level: 'caution',
        label: { en: '1 or 2', pt: '1 ou 2' },
        note: { en: 'A very small team makes the managerial role hard to show. The buyer may need to hire.', pt: 'Uma equipe muito pequena dificulta comprovar o cargo gerencial. O comprador pode precisar contratar.' },
      },
      { value: '3to9', level: 'pass', label: { en: '3 to 9', pt: '3 a 9' } },
      { value: '10plus', level: 'pass', label: { en: '10 or more', pt: '10 ou mais' } },
    ],
  },
  {
    id: 'runs',
    label: { en: 'Who runs the business day to day?', pt: 'Quem toca o negócio no dia a dia?' },
    options: [
      { value: 'managers', level: 'pass', label: { en: 'Managers or supervisors, the owner oversees', pt: 'Gerentes ou supervisores, o dono supervisiona' } },
      {
        value: 'owner_with_staff',
        level: 'caution',
        label: { en: 'The owner, with staff doing the frontline work', pt: 'O dono, com a equipe fazendo o trabalho operacional' },
        note: { en: 'Workable, but a supervisor layer makes the buyer’s managerial role clearer.', pt: 'Funciona, mas uma camada de supervisão deixa mais claro o cargo gerencial do comprador.' },
      },
      {
        value: 'owner_does',
        level: 'caution',
        label: { en: 'The owner does most of the work', pt: 'O dono faz a maior parte do trabalho' },
        note: { en: 'The buyer cannot do the frontline work under L-1. Staff would have to take it over.', pt: 'O comprador não pode fazer o trabalho operacional no L-1. A equipe teria de assumir.' },
      },
    ],
  },
  {
    id: 'premises',
    label: { en: 'Where does it operate?', pt: 'Onde opera?' },
    options: [
      { value: 'commercial', level: 'pass', label: { en: 'Commercial location, leased or owned', pt: 'Ponto comercial, alugado ou próprio' } },
      {
        value: 'home_virtual',
        level: 'caution',
        label: { en: 'Home-based or virtual', pt: 'Residencial ou virtual' },
        note: { en: 'L-1 expects real commercial premises. A location would have to be secured.', pt: 'O L-1 espera um ponto comercial real. Seria preciso garantir um local.' },
      },
    ],
  },
  {
    id: 'sale',
    label: { en: 'How much of the business is for sale?', pt: 'Quanto do negócio está à venda?' },
    help: { en: 'The buyer’s company needs ownership and control.', pt: 'A empresa do comprador precisa de propriedade e controle.' },
    options: [
      { value: 'all', level: 'pass', label: { en: '100%', pt: '100%' } },
      { value: 'majority', level: 'pass', label: { en: 'A majority, with control', pt: 'A maioria, com controle' } },
      {
        value: 'half',
        level: 'caution',
        label: { en: 'Exactly half', pt: 'Exatamente metade' },
        note: { en: 'A 50/50 deal can qualify with equal control and veto power. The attorney must structure it.', pt: 'Um negócio 50/50 pode qualificar com controle igual e poder de veto. O advogado precisa estruturar.' },
      },
      {
        value: 'minority',
        level: 'fail',
        label: { en: 'Less than half', pt: 'Menos da metade' },
        note: { en: 'Without majority ownership or control there is no qualifying relationship.', pt: 'Sem maioria ou controle não há vínculo qualificado.' },
      },
    ],
  },
  {
    id: 'transfer',
    label: { en: 'Can a foreign-owned company become the owner?', pt: 'Uma empresa de dono estrangeiro pode se tornar a proprietária?' },
    help: { en: 'Think of licenses, the franchise agreement and the lease.', pt: 'Considere licenças, contrato de franquia e aluguel.' },
    options: [
      { value: 'yes', level: 'pass', label: { en: 'Yes, nothing prevents it', pt: 'Sim, nada impede' } },
      {
        value: 'approval',
        level: 'caution',
        label: { en: 'Yes, with approval from a franchisor, landlord or board', pt: 'Sim, com aprovação de franqueador, locador ou órgão' },
        note: { en: 'Get the approval terms in writing before listing.', pt: 'Obtenha os termos da aprovação por escrito antes de anunciar.' },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No, a license or contract requires a U.S. owner', pt: 'Não, uma licença ou contrato exige dono americano' },
        note: { en: 'If ownership cannot transfer to a foreign-owned company, an L-1 buyer cannot acquire it.', pt: 'Se a propriedade não pode ir para uma empresa de dono estrangeiro, um comprador L-1 não pode adquiri-la.' },
      },
    ],
  },
  {
    id: 'records',
    label: { en: 'How are the books kept?', pt: 'Como é a contabilidade?' },
    options: [
      { value: 'clean', level: 'pass', label: { en: 'Tax returns filed every year, payroll through a payroll service', pt: 'Declarações todo ano, folha por serviço de payroll' } },
      {
        value: 'partial',
        level: 'caution',
        label: { en: 'Returns filed, but some pay or sales are informal', pt: 'Declarações em dia, mas parte de salários ou vendas é informal' },
        note: { en: 'Only what is on the returns and payroll reports counts as evidence.', pt: 'Só o que está nas declarações e relatórios de folha conta como prova.' },
      },
      {
        value: 'informal',
        level: 'fail',
        label: { en: 'Mostly cash, returns missing or late', pt: 'Quase tudo em dinheiro, declarações faltando ou atrasadas' },
        note: { en: 'Without filed returns and payroll records the business cannot be documented for L-1.', pt: 'Sem declarações e registros de folha o negócio não pode ser documentado para o L-1.' },
      },
    ],
  },
];

/** Does the candidate and the Brazilian company meet the core L-1A requirements? */
const BR_QUESTIONS: ChoiceQuestion[] = [
  {
    id: 'role',
    label: { en: 'What is your role at the company in Brazil?', pt: 'Qual é o seu cargo na empresa no Brasil?' },
    help: { en: 'L-1A is for managers and executives.', pt: 'O L-1A é para gerentes e executivos.' },
    options: [
      { value: 'owner_exec', level: 'pass', label: { en: 'Owner or partner who runs it', pt: 'Sócio ou dono que administra' } },
      { value: 'executive', level: 'pass', label: { en: 'Executive, director or manager', pt: 'Executivo, diretor ou gerente' } },
      {
        value: 'other',
        level: 'fail',
        label: { en: 'Other, or I do not work there', pt: 'Outro, ou não trabalho lá' },
        note: { en: 'L-1A requires a managerial or executive role at the company abroad.', pt: 'O L-1A exige cargo gerencial ou executivo na empresa no exterior.' },
      },
    ],
  },
  {
    id: 'tenure',
    label: { en: 'Have you worked there for one continuous year within the last three?', pt: 'Você trabalhou lá por um ano contínuo nos últimos três?' },
    options: [
      { value: 'yes', level: 'pass', label: yes },
      {
        value: 'almost',
        level: 'caution',
        label: { en: 'Not yet, but within six months', pt: 'Ainda não, mas em até seis meses' },
        note: { en: 'The petition can only be filed once the continuous year is complete.', pt: 'A petição só pode ser protocolada quando o ano contínuo estiver completo.' },
      },
      {
        value: 'no',
        level: 'fail',
        label: no,
        note: { en: 'One continuous year of employment abroad in the last three is a core L-1 requirement.', pt: 'Um ano contínuo de trabalho no exterior nos últimos três é requisito central do L-1.' },
      },
    ],
  },
  {
    id: 'pay_trail',
    label: { en: 'Is that employment documented?', pt: 'Esse vínculo está documentado?' },
    help: { en: 'Payroll, pay stubs or pró-labore.', pt: 'Folha de pagamento, holerites ou pró-labore.' },
    options: [
      { value: 'yes', level: 'pass', label: { en: 'Yes, every month', pt: 'Sim, todos os meses' } },
      {
        value: 'partial',
        level: 'caution',
        label: { en: 'Partly, with gaps', pt: 'Em parte, com lacunas' },
        note: { en: 'Gaps in the pay record are the most common weakness. Other corporate records may fill them.', pt: 'Lacunas no registro de pagamento são a fraqueza mais comum. Outros registros societários podem supri-las.' },
      },
      {
        value: 'no',
        level: 'fail',
        label: no,
        note: { en: 'Without a pay record the year of employment cannot be proven. Formalize it now: the record takes 12 months to build.', pt: 'Sem registro de pagamento o ano de trabalho não pode ser comprovado. Formalize agora: o histórico leva 12 meses.' },
      },
    ],
  },
  {
    id: 'manages',
    label: { en: 'What do you mostly do day to day?', pt: 'O que você mais faz no dia a dia?' },
    options: [
      { value: 'people', level: 'pass', label: { en: 'Manage managers, supervisors or professionals', pt: 'Gerencio gerentes, supervisores ou profissionais' } },
      { value: 'function', level: 'pass', label: { en: 'Run an essential function or department', pt: 'Dirijo uma função ou departamento essencial' } },
      {
        value: 'hands_on',
        level: 'caution',
        label: { en: 'Mostly the hands-on work myself', pt: 'Principalmente o trabalho operacional' },
        note: { en: 'Managerial capacity means directing others or a key function, not doing the frontline work.', pt: 'Capacidade gerencial significa dirigir pessoas ou uma função-chave, não executar o trabalho operacional.' },
      },
    ],
  },
  {
    id: 'company_age',
    label: { en: 'How long has the company been operating?', pt: 'Há quanto tempo a empresa opera?' },
    options: [
      {
        value: 'lt1',
        level: 'fail',
        label: { en: 'Less than 1 year', pt: 'Menos de 1 ano' },
        note: { en: 'The company must have employed you for a full year before a petition is possible.', pt: 'A empresa precisa ter empregado você por um ano completo antes da petição.' },
      },
      { value: '1to3', level: 'pass', label: { en: '1 to 3 years', pt: '1 a 3 anos' } },
      { value: 'gt3', level: 'pass', label: { en: 'More than 3 years', pt: 'Mais de 3 anos' } },
    ],
  },
  {
    id: 'employees',
    label: { en: 'How many employees does it have, besides you?', pt: 'Quantos funcionários ela tem, além de você?' },
    options: [
      {
        value: '0',
        level: 'fail',
        label: { en: 'None', pt: 'Nenhum' },
        note: { en: 'A company with no staff reads as a shell and cannot show a managerial role.', pt: 'Uma empresa sem equipe parece uma casca e não demonstra cargo gerencial.' },
      },
      {
        value: '1to2',
        level: 'caution',
        label: { en: '1 or 2', pt: '1 ou 2' },
        note: { en: 'A very small team makes the managerial role harder to prove.', pt: 'Uma equipe muito pequena dificulta comprovar o cargo gerencial.' },
      },
      { value: '3to9', level: 'pass', label: { en: '3 to 9', pt: '3 a 9' } },
      { value: '10plus', level: 'pass', label: { en: '10 or more', pt: '10 ou mais' } },
    ],
  },
  {
    id: 'continues',
    label: { en: 'Will the company in Brazil keep operating after you move?', pt: 'A empresa no Brasil continuará operando depois da sua mudança?' },
    options: [
      { value: 'yes_successor', level: 'pass', label: { en: 'Yes, and someone is ready to run it', pt: 'Sim, e já há quem a administre' } },
      {
        value: 'yes_unsure',
        level: 'caution',
        label: { en: 'Yes, but no one is named yet', pt: 'Sim, mas ainda sem responsável definido' },
        note: { en: 'Name who will run the company in Brazil and formalize their authority.', pt: 'Defina quem administrará a empresa no Brasil e formalize os poderes.' },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No, it would close or pause', pt: 'Não, ela fecharia ou pararia' },
        note: { en: 'The company abroad must keep doing business for the whole L-1 period.', pt: 'A empresa no exterior precisa continuar operando durante todo o período do L-1.' },
      },
    ],
  },
  {
    id: 'ownership',
    label: { en: 'Who would own the U.S. business after the purchase?', pt: 'Quem seria o dono do negócio nos EUA após a compra?' },
    help: { en: 'The two companies need a qualifying relationship: parent, subsidiary or affiliate.', pt: 'As duas empresas precisam de vínculo qualificado: matriz, subsidiária ou afiliada.' },
    options: [
      { value: 'majority', level: 'pass', label: { en: 'The Brazilian company or its same owners, over 50%', pt: 'A empresa brasileira ou os mesmos sócios, acima de 50%' } },
      {
        value: 'fifty',
        level: 'caution',
        label: { en: '50/50 with a partner', pt: '50/50 com um sócio' },
        note: { en: 'A 50/50 structure can qualify with equal control and veto power. The attorney should structure it.', pt: 'Uma estrutura 50/50 pode qualificar com controle igual e poder de veto. O advogado deve estruturá-la.' },
      },
      {
        value: 'unsure',
        level: 'caution',
        label: { en: 'Not sure yet', pt: 'Ainda não sei' },
        note: { en: 'Ownership must be settled before filing. The attorney will advise on structure.', pt: 'A estrutura societária precisa estar definida antes do protocolo. O advogado orientará.' },
      },
      {
        value: 'minority',
        level: 'fail',
        label: { en: 'Less than 50%', pt: 'Menos de 50%' },
        note: { en: 'Without ownership and control there is no qualifying relationship.', pt: 'Sem propriedade e controle não há vínculo qualificado.' },
      },
    ],
  },
];

export const QUESTIONS: Record<Kind, ChoiceQuestion[]> = { us: US_QUESTIONS, br: BR_QUESTIONS };

export type Stage1Answers = Record<string, string>;
export type Finding = { id: string; level: Level; topic: L; label: L; note?: L };
export type Stage1Rating = 'compliant' | 'gaps' | 'not_compliant';
export type Stage1Result = { rating: Stage1Rating; passed: boolean; score: number; findings: Finding[] };

export const STAGE1_RATING: Record<Stage1Rating, L> = {
  compliant: { en: 'Compliant', pt: 'Conforme' },
  gaps: { en: 'Gaps to fix', pt: 'Pontos a corrigir' },
  not_compliant: { en: 'Not compliant', pt: 'Não conforme' },
};

export function stage1Complete(kind: Kind, a: Stage1Answers): boolean {
  return QUESTIONS[kind].every((q) => q.options.some((o) => o.value === a[q.id]));
}

export function scoreStage1(kind: Kind, a: Stage1Answers): Stage1Result {
  const questions = QUESTIONS[kind];
  const findings: Finding[] = [];
  let points = 0;
  for (const q of questions) {
    const opt = q.options.find((o) => o.value === a[q.id]);
    if (!opt) throw new Error(`Missing answer: ${q.id}`);
    points += opt.level === 'pass' ? 2 : opt.level === 'caution' ? 1 : 0;
    findings.push({ id: q.id, level: opt.level, topic: q.label, label: opt.label, note: opt.note });
  }
  const fails = findings.filter((f) => f.level === 'fail').length;
  const cautions = findings.filter((f) => f.level === 'caution').length;
  return {
    rating: fails > 0 ? 'not_compliant' : cautions > 0 ? 'gaps' : 'compliant',
    passed: fails === 0,
    score: Math.round((points / (questions.length * 2)) * 100),
    findings,
  };
}

/* ------------------------------------------------------------------ */
/* Stage 2: business health                                            */
/* ------------------------------------------------------------------ */

export type FieldDef = {
  id: string;
  kind: 'money' | 'number' | 'choice';
  label: L;
  help?: L;
  unit?: 'BRL' | 'USD' | 'years' | 'people' | 'hours' | '%';
  max?: number;
  options?: { value: string; label: L }[];
  allowNegative?: boolean;
};

const US_FIELDS: FieldDef[] = [
  { id: 'price', kind: 'money', unit: 'USD', label: { en: 'Asking price', pt: 'Preço pedido' } },
  { id: 'rev_y1', kind: 'money', unit: 'USD', label: { en: 'Revenue, two years ago', pt: 'Faturamento, há dois anos' } },
  { id: 'rev_y2', kind: 'money', unit: 'USD', label: { en: 'Revenue, last year', pt: 'Faturamento, ano passado' } },
  { id: 'rev_y3', kind: 'money', unit: 'USD', label: { en: 'Revenue, most recent 12 months', pt: 'Faturamento, últimos 12 meses' } },
  {
    id: 'sde',
    kind: 'money',
    unit: 'USD',
    allowNegative: true,
    label: { en: 'Owner’s earnings (SDE), most recent 12 months', pt: 'Lucro do proprietário (SDE), últimos 12 meses' },
    help: { en: 'Profit before the owner’s pay. Use a negative number for a loss.', pt: 'Lucro antes da remuneração do dono. Use número negativo para prejuízo.' },
  },
  { id: 'employees', kind: 'number', unit: 'people', max: 100_000, label: { en: 'Employees on payroll (W-2)', pt: 'Funcionários na folha (W-2)' } },
  {
    id: 'lease_years',
    kind: 'number',
    unit: 'years',
    max: 99,
    label: { en: 'Lease years remaining, with options', pt: 'Anos restantes de aluguel, com opções' },
    help: { en: 'Enter 10 if the business owns the property.', pt: 'Digite 10 se o imóvel for próprio.' },
  },
  { id: 'owner_hours', kind: 'number', unit: 'hours', max: 120, label: { en: 'Hours the owner works per week', pt: 'Horas que o dono trabalha por semana' } },
  { id: 'top_customer_pct', kind: 'number', unit: '%', max: 100, label: { en: 'Largest customer, share of revenue', pt: 'Maior cliente, parcela do faturamento' } },
  {
    id: 'sale_reason',
    kind: 'choice',
    label: { en: 'Main reason for selling', pt: 'Principal motivo da venda' },
    options: [
      { value: 'retirement', label: { en: 'Retirement', pt: 'Aposentadoria' } },
      { value: 'new_venture', label: { en: 'Another venture or move', pt: 'Outro negócio ou mudança' } },
      { value: 'personal', label: { en: 'Health or family', pt: 'Saúde ou família' } },
      { value: 'declining', label: { en: 'Business is declining', pt: 'O negócio está em queda' } },
    ],
  },
];

const BR_FIELDS: FieldDef[] = [
  { id: 'rev_y1', kind: 'money', unit: 'BRL', label: { en: 'Revenue, two years ago', pt: 'Faturamento, há dois anos' } },
  { id: 'rev_y2', kind: 'money', unit: 'BRL', label: { en: 'Revenue, last year', pt: 'Faturamento, ano passado' } },
  { id: 'rev_y3', kind: 'money', unit: 'BRL', label: { en: 'Revenue, most recent 12 months', pt: 'Faturamento, últimos 12 meses' } },
  {
    id: 'profit',
    kind: 'money',
    unit: 'BRL',
    allowNegative: true,
    label: { en: 'Net profit, most recent 12 months', pt: 'Lucro líquido, últimos 12 meses' },
    help: { en: 'Use a negative number for a loss.', pt: 'Use número negativo para prejuízo.' },
  },
  { id: 'cash', kind: 'money', unit: 'BRL', label: { en: 'Cash and liquid investments today', pt: 'Caixa e aplicações líquidas hoje' } },
  { id: 'debt', kind: 'money', unit: 'BRL', label: { en: 'Total debt today', pt: 'Dívida total hoje' } },
  {
    id: 'invest_usd',
    kind: 'money',
    unit: 'USD',
    label: { en: 'Funds available to buy a U.S. business', pt: 'Recursos disponíveis para comprar um negócio nos EUA' },
    help: { en: 'In US dollars. Company funds are the cleanest source.', pt: 'Em dólares. Recursos da empresa são a origem mais limpa.' },
  },
  {
    id: 'tax_status',
    kind: 'choice',
    label: { en: 'Taxes and filings', pt: 'Impostos e obrigações' },
    options: [
      { value: 'good', label: { en: 'All current', pt: 'Tudo em dia' } },
      { value: 'plan', label: { en: 'On a payment plan', pt: 'Em parcelamento' } },
      { value: 'issues', label: { en: 'Overdue or in dispute', pt: 'Em atraso ou em disputa' } },
    ],
  },
];

export const FIELDS: Record<Kind, FieldDef[]> = { us: US_FIELDS, br: BR_FIELDS };

export type Stage2Answers = Record<string, number | string>;
export type Grade = 'good' | 'ok' | 'weak';
export type Metric = {
  id: string;
  label: L;
  /** Pre-formatted, language-neutral value such as "+12.4%" or "3.1×". */
  value: string;
  grade: Grade;
  note: L;
};
export type Stage2Rating = 'healthy' | 'watch' | 'weak';
export type Stage2Result = { rating: Stage2Rating; passed: boolean; score: number; metrics: Metric[] };

export const STAGE2_RATING: Record<Stage2Rating, L> = {
  healthy: { en: 'Healthy', pt: 'Saudável' },
  watch: { en: 'Watch', pt: 'Atenção' },
  weak: { en: 'Weak', pt: 'Fraco' },
};

const pct = (n: number, signed = false) => `${signed && n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export function stage2Complete(kind: Kind, a: Stage2Answers): boolean {
  return FIELDS[kind].every((f) => {
    const v = a[f.id];
    if (f.kind === 'choice') return f.options!.some((o) => o.value === v);
    return typeof v === 'number' && Number.isFinite(v) && (f.allowNegative || v >= 0) && (f.max === undefined || v <= f.max);
  });
}

type Add = (id: string, label: L, value: string, grade: Grade, notes: Record<Grade, L>) => void;

/** Compound annual growth over two years; two straight declines are weak. */
function revenueTrend(add: Add, y1: number, y2: number, y3: number) {
  const growth = y1 > 0 && y3 > 0 ? Math.sqrt(y3 / y1) - 1 : y3 > y1 ? 1 : -1;
  const twoDeclines = y2 < y1 && y3 < y2;
  const grade: Grade = twoDeclines || growth < -0.05 ? 'weak' : growth >= 0.05 ? 'good' : 'ok';
  add('rev_trend', { en: 'Revenue trend', pt: 'Tendência de faturamento' }, `${pct(growth, true)}/yr`, grade, {
    good: { en: 'Growing year over year.', pt: 'Crescendo ano a ano.' },
    ok: { en: 'Roughly flat.', pt: 'Praticamente estável.' },
    weak: twoDeclines
      ? { en: 'Down two years in a row.', pt: 'Queda por dois anos seguidos.' }
      : { en: 'Shrinking.', pt: 'Em queda.' },
  });
}

function scoreUs(a: Record<string, number>, reason: string, add: Add) {
  const { price, rev_y1, rev_y2, rev_y3, sde, employees, lease_years, owner_hours, top_customer_pct } = a;

  revenueTrend(add, rev_y1, rev_y2, rev_y3);
  {
    const margin = rev_y3 > 0 ? sde / rev_y3 : -1;
    const grade: Grade = margin >= 0.15 ? 'good' : margin >= 0.08 ? 'ok' : 'weak';
    add('margin', { en: 'Earnings margin', pt: 'Margem de lucro' }, rev_y3 > 0 ? pct(margin) : 'n/a', grade, {
      good: { en: 'Solid earnings for the revenue.', pt: 'Lucro sólido para o faturamento.' },
      ok: { en: 'Thin but positive.', pt: 'Baixa, mas positiva.' },
      weak: { en: 'Little or no earnings.', pt: 'Pouco ou nenhum lucro.' },
    });
  }
  {
    const mult = sde > 0 ? price / sde : Infinity;
    const grade: Grade = mult <= PARAMS.priceMultipleGood ? 'good' : mult <= PARAMS.priceMultipleOk ? 'ok' : 'weak';
    add('multiple', { en: 'Price ÷ earnings', pt: 'Preço ÷ lucro' }, Number.isFinite(mult) ? `${mult.toFixed(1)}×` : 'n/a', grade, {
      good: { en: 'Within the usual range for small businesses.', pt: 'Dentro da faixa usual para pequenos negócios.' },
      ok: { en: 'On the high side. Needs a reason.', pt: 'No limite superior. Precisa de justificativa.' },
      weak: { en: 'Priced above what earnings support.', pt: 'Preço acima do que o lucro sustenta.' },
    });
  }
  {
    const residual = sde - PARAMS.managerSalaryUsd;
    const grade: Grade = sde > 0 && residual >= PARAMS.residualMinPctOfEarnings * sde ? 'good' : residual >= 0 ? 'ok' : 'weak';
    add('salary', { en: 'After a manager salary', pt: 'Após salário de gerente' }, usd(residual), grade, {
      good: { en: 'Earnings pay the L-1 manager and leave a margin.', pt: 'O lucro paga o gerente L-1 e deixa margem.' },
      ok: { en: 'Earnings barely cover a manager salary.', pt: 'O lucro mal cobre o salário de um gerente.' },
      weak: { en: 'Earnings cannot pay a manager salary.', pt: 'O lucro não paga o salário de um gerente.' },
    });
  }
  {
    const grade: Grade = employees >= 6 ? 'good' : employees >= 3 ? 'ok' : 'weak';
    add('team', { en: 'Team', pt: 'Equipe' }, `${employees} W-2`, grade, {
      good: { en: 'Enough staff for a managerial role.', pt: 'Equipe suficiente para um cargo gerencial.' },
      ok: { en: 'Small team. A supervisor hire may be needed.', pt: 'Equipe pequena. Pode ser preciso contratar um supervisor.' },
      weak: { en: 'Too few employees to manage.', pt: 'Poucos funcionários para gerenciar.' },
    });
  }
  {
    const grade: Grade = lease_years >= 3 ? 'good' : lease_years >= 1 ? 'ok' : 'weak';
    add('lease', { en: 'Lease', pt: 'Aluguel' }, `${lease_years} yr`, grade, {
      good: { en: 'Premises secured for the first L-1 period.', pt: 'Local garantido para o primeiro período do L-1.' },
      ok: { en: 'A lease extension should be a closing condition.', pt: 'A extensão do aluguel deve ser condição de fechamento.' },
      weak: { en: 'Under one year left on the lease.', pt: 'Menos de um ano de aluguel restante.' },
    });
  }
  {
    const grade: Grade = owner_hours <= 25 ? 'good' : owner_hours <= 45 ? 'ok' : 'weak';
    add('owner', { en: 'Owner dependence', pt: 'Dependência do dono' }, `${owner_hours} h/wk`, grade, {
      good: { en: 'Runs largely without the owner.', pt: 'Funciona em grande parte sem o dono.' },
      ok: { en: 'The owner works a full week in the business.', pt: 'O dono trabalha uma semana cheia no negócio.' },
      weak: { en: 'The business leans heavily on the owner.', pt: 'O negócio depende muito do dono.' },
    });
  }
  {
    const grade: Grade = top_customer_pct <= 15 ? 'good' : top_customer_pct <= 30 ? 'ok' : 'weak';
    add('concentration', { en: 'Largest customer', pt: 'Maior cliente' }, `${top_customer_pct}%`, grade, {
      good: { en: 'Revenue is spread across customers.', pt: 'Faturamento distribuído entre clientes.' },
      ok: { en: 'One customer carries a notable share.', pt: 'Um cliente responde por parcela relevante.' },
      weak: { en: 'Losing one customer would hurt badly.', pt: 'Perder um cliente causaria grande impacto.' },
    });
  }
  {
    const grade: Grade = reason === 'declining' ? 'weak' : 'good';
    const text: Record<string, string> = { retirement: 'Retirement', new_venture: 'New venture', personal: 'Personal', declining: 'Declining' };
    add('reason', { en: 'Reason for sale', pt: 'Motivo da venda' }, text[reason] ?? reason, grade, {
      good: { en: 'Unrelated to how the business performs.', pt: 'Sem relação com o desempenho do negócio.' },
      ok: { en: '', pt: '' },
      weak: { en: 'The owner is selling because the business is declining.', pt: 'O dono vende porque o negócio está em queda.' },
    });
  }
}

function scoreBr(a: Record<string, number>, tax: string, add: Add) {
  const { rev_y1, rev_y2, rev_y3, profit, cash, debt, invest_usd } = a;

  revenueTrend(add, rev_y1, rev_y2, rev_y3);
  {
    const margin = rev_y3 > 0 ? profit / rev_y3 : -1;
    const grade: Grade = margin >= 0.1 ? 'good' : margin >= 0.03 ? 'ok' : 'weak';
    add('margin', { en: 'Net margin', pt: 'Margem líquida' }, rev_y3 > 0 ? pct(margin) : 'n/a', grade, {
      good: { en: 'Solidly profitable.', pt: 'Lucratividade sólida.' },
      ok: { en: 'Thin but positive.', pt: 'Baixa, mas positiva.' },
      weak: { en: 'Little or no profit to support an acquisition.', pt: 'Pouco ou nenhum lucro para sustentar uma aquisição.' },
    });
  }
  {
    // Months of operating costs covered by cash.
    const monthlyCosts = Math.max(rev_y3 - profit, 0) / 12;
    const months = monthlyCosts > 0 ? cash / monthlyCosts : cash > 0 ? 99 : 0;
    const grade: Grade = months >= 3 ? 'good' : months >= 1 ? 'ok' : 'weak';
    add('runway', { en: 'Cash runway', pt: 'Fôlego de caixa' }, `${months >= 12 ? '12+' : months.toFixed(1)} mo`, grade, {
      good: { en: 'Covers three months of costs or more.', pt: 'Cobre três meses de custos ou mais.' },
      ok: { en: 'Covers one to three months of costs.', pt: 'Cobre de um a três meses de custos.' },
      weak: { en: 'Under one month of costs in cash.', pt: 'Menos de um mês de custos em caixa.' },
    });
  }
  {
    // Years of profit needed to repay debt.
    const years = debt <= 0 ? 0 : profit > 0 ? debt / profit : Infinity;
    const grade: Grade = years <= 2 ? 'good' : years <= 4 ? 'ok' : 'weak';
    add('debt', { en: 'Debt load', pt: 'Endividamento' }, Number.isFinite(years) ? `${years.toFixed(1)}× profit` : 'n/a', grade, {
      good: { en: 'Light or no debt.', pt: 'Pouca ou nenhuma dívida.' },
      ok: { en: 'Manageable debt.', pt: 'Dívida administrável.' },
      weak: { en: 'Debt is heavy relative to profit.', pt: 'Dívida alta em relação ao lucro.' },
    });
  }
  {
    const grade: Grade = tax === 'good' ? 'good' : tax === 'plan' ? 'ok' : 'weak';
    add('tax', { en: 'Tax standing', pt: 'Situação fiscal' }, { good: 'Current', plan: 'Payment plan', issues: 'Overdue' }[tax] ?? tax, grade, {
      good: { en: 'Clearance certificates should be easy to obtain.', pt: 'As certidões devem sair sem dificuldade.' },
      ok: { en: 'Acceptable while the plan is kept current.', pt: 'Aceitável enquanto o parcelamento estiver em dia.' },
      weak: { en: 'Regularize before filing.', pt: 'Regularizar antes do protocolo.' },
    });
  }
  {
    const grade: Grade = invest_usd >= PARAMS.fundsGoodUsd ? 'good' : invest_usd >= PARAMS.fundsOkUsd ? 'ok' : 'weak';
    add('funding', { en: 'Funds to invest', pt: 'Recursos para investir' }, usd(invest_usd), grade, {
      good: { en: 'Enough to buy and run a staffed U.S. business.', pt: 'Suficiente para comprar e operar um negócio com equipe nos EUA.' },
      ok: { en: 'Limits the choice of businesses. SBA loans are not available to L-1 buyers.', pt: 'Limita as opções de negócios. Empréstimos SBA não estão disponíveis para compradores L-1.' },
      weak: { en: 'Likely too little for a business that supports L-1.', pt: 'Provavelmente insuficiente para um negócio que sustente o L-1.' },
    });
  }
}

export function scoreStage2(kind: Kind, a: Stage2Answers): Stage2Result {
  if (!stage2Complete(kind, a)) throw new Error('Incomplete numbers');
  const metrics: Metric[] = [];
  const add: Add = (id, label, value, grade, notes) => metrics.push({ id, label, value, grade, note: notes[grade] });
  const nums = a as Record<string, number>;
  if (kind === 'us') scoreUs(nums, String(a.sale_reason), add);
  else scoreBr(nums, String(a.tax_status), add);

  const points = metrics.reduce((s, x) => s + (x.grade === 'good' ? 2 : x.grade === 'ok' ? 1 : 0), 0);
  const ratio = points / (metrics.length * 2);
  const weak = metrics.filter((x) => x.grade === 'weak').length;
  const rating: Stage2Rating =
    weak === 0 && ratio >= PARAMS.healthyMinPct ? 'healthy' : weak <= PARAMS.watchMaxWeak && ratio >= PARAMS.watchMinPct ? 'watch' : 'weak';
  return { rating, passed: rating !== 'weak', score: Math.round(ratio * 100), metrics };
}

/* ------------------------------------------------------------------ */
/* Stage 4: owners and disclosures                                     */
/* ------------------------------------------------------------------ */

export type Owner = { name: string; pct: number; role: string };
export type Stage4Answers = { owners: Owner[]; disclosures: Record<string, string> };

/** Answered about the business and every owner. A "yes" is flagged for the team, not an automatic stop. */
export const DISCLOSURES: { id: string; label: L }[] = [
  { id: 'lawsuits', label: { en: 'Any lawsuit pending against the business or an owner?', pt: 'Há processo judicial em andamento contra a empresa ou um sócio?' } },
  { id: 'tax_liens', label: { en: 'Any unpaid taxes, liens or judgments?', pt: 'Há impostos não pagos, ônus ou condenações?' } },
  { id: 'bankruptcy', label: { en: 'Has any owner filed for bankruptcy in the last seven years?', pt: 'Algum sócio pediu falência ou recuperação nos últimos sete anos?' } },
  { id: 'criminal', label: { en: 'Has any owner been convicted of a crime?', pt: 'Algum sócio já foi condenado por crime?' } },
];

export function stage4Complete(a: Stage4Answers | null | undefined): boolean {
  if (!a || !Array.isArray(a.owners) || a.owners.length === 0) return false;
  const ownersOk = a.owners.every((o) => o.name.trim().length >= 2 && Number.isFinite(o.pct) && o.pct > 0 && o.pct <= 100);
  const total = a.owners.reduce((s, o) => s + o.pct, 0);
  return ownersOk && total <= 100.01 && DISCLOSURES.every((d) => a.disclosures?.[d.id] === 'yes' || a.disclosures?.[d.id] === 'no');
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type Status = 'active' | 'review' | 'stopped' | 'approved' | 'declined';

export const STATUS: Record<Status, L> = {
  active: { en: 'In progress', pt: 'Em andamento' },
  review: { en: 'Needs review', pt: 'Aguardando revisão' },
  stopped: { en: 'Stopped at gate', pt: 'Parado na etapa' },
  approved: { en: 'Approved', pt: 'Aprovado' },
  declined: { en: 'Declined', pt: 'Recusado' },
};
