/**
 * The 10x BR evaluation process, as data.
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
  /** Return on the price after paying a manager: (earnings − manager salary) ÷ price. */
  returnGood: 0.2,
  returnOk: 0.1,
  /** Business debt as a multiple of owner's earnings. In a sale of the company itself the debt stays with it. */
  debtToEarningsGood: 1,
  debtToEarningsOk: 2.5,
  /** BRL per USD used to size what the Brazilian company can send, before the stress below. Update when the rate moves. */
  brlPerUsd: 5.5,
  fxStressPct: 0.15,
  /** Months of its own costs the Brazilian company keeps after funding the purchase. */
  brReserveMonths: 3,
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
      us: { en: 'Nine one-tap questions about the business.', pt: 'Nove perguntas de um toque sobre o negócio.' },
      br: { en: 'Nine one-tap questions about you and your company.', pt: 'Nove perguntas de um toque sobre você e a sua empresa.' },
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
/** `req` names the L-1 requirement the question screens; it heads the row on the scorecard. */
export type ChoiceQuestion = { id: string; req: L; label: L; help?: L; options: Option[] };

const yes: L = { en: 'Yes', pt: 'Sim' };
const no: L = { en: 'No', pt: 'Não' };

/**
 * Is this U.S. business something an L-1A buyer can acquire and petition on?
 * Each question screens one requirement of 8 CFR 214.2(l); see docs/l1-requirements.md.
 */
const US_QUESTIONS: ChoiceQuestion[] = [
  {
    id: 'activity',
    req: { en: 'Doing business', pt: 'Atividade empresarial' },
    label: { en: 'What does the business do?', pt: 'O que o negócio faz?' },
    options: [
      { value: 'active', level: 'pass', label: { en: 'Sells goods or services all year', pt: 'Vende bens ou serviços o ano todo' } },
      {
        value: 'seasonal',
        level: 'caution',
        label: { en: 'Seasonal or part-time operation', pt: 'Operação sazonal ou em meio período' },
        note: {
          en: 'The business must operate regularly and continuously. Show activity, staff and revenue outside the season.',
          pt: 'O negócio precisa operar de forma regular e contínua. Mostre atividade, equipe e faturamento fora da temporada.',
        },
      },
      {
        value: 'passive',
        level: 'fail',
        label: { en: 'Mostly holds property or investments', pt: 'Principalmente detém imóveis ou investimentos' },
        note: {
          en: 'Holding property or investments is not “doing business” under the L-1 rules.',
          pt: 'Deter imóveis ou investimentos não é “atividade empresarial” pelas regras do L-1.',
        },
      },
    ],
  },
  {
    id: 'years',
    req: { en: 'Operating history', pt: 'Histórico de operação' },
    label: { en: 'How long has the company operated under its current legal entity?', pt: 'Há quanto tempo a empresa opera sob a pessoa jurídica atual?' },
    help: { en: 'The LLC or corporation that files the tax returns today.', pt: 'A LLC ou corporation que entrega as declarações hoje.' },
    options: [
      {
        value: 'lt1',
        level: 'caution',
        label: { en: 'Less than 1 year', pt: 'Menos de 1 ano' },
        note: {
          en: 'Under one year the buyer falls under the “new office” rules: approval for one year only, a business plan and closer review.',
          pt: 'Com menos de um ano o comprador cai nas regras de “new office”: aprovação por apenas um ano, plano de negócios e análise mais rigorosa.',
        },
      },
      { value: '1to3', level: 'pass', label: { en: '1 to 3 years', pt: '1 a 3 anos' } },
      { value: 'gt3', level: 'pass', label: { en: 'More than 3 years', pt: 'Mais de 3 anos' } },
    ],
  },
  {
    id: 'employees',
    req: { en: 'Staff to manage', pt: 'Equipe para gerenciar' },
    label: { en: 'How many W-2 employees are on payroll, not counting owners?', pt: 'Quantos funcionários W-2 estão na folha, sem contar os sócios?' },
    help: { en: 'Leave out contractors paid on a 1099.', pt: 'Não inclua prestadores pagos por 1099.' },
    options: [
      {
        value: '0',
        level: 'fail',
        label: { en: 'None, or contractors only', pt: 'Nenhum, ou apenas prestadores' },
        note: {
          en: 'An L-1A manager must work through employees. With none, the buyer would be doing the work, which does not qualify.',
          pt: 'Um gerente L-1A precisa atuar por meio de funcionários. Sem eles, o comprador faria o trabalho, o que não qualifica.',
        },
      },
      {
        value: '1to2',
        level: 'caution',
        label: { en: '1 or 2', pt: '1 ou 2' },
        note: {
          en: 'There is no legal minimum, but with so few staff it is hard to show the buyer manages instead of operating. Expect to hire.',
          pt: 'Não há mínimo legal, mas com tão poucos funcionários é difícil mostrar que o comprador gerencia em vez de operar. Será preciso contratar.',
        },
      },
      { value: '3to9', level: 'pass', label: { en: '3 to 9', pt: '3 a 9' } },
      { value: '10plus', level: 'pass', label: { en: '10 or more', pt: '10 ou mais' } },
    ],
  },
  {
    id: 'runs',
    req: { en: 'Managerial structure', pt: 'Estrutura gerencial' },
    label: { en: 'Who runs the business day to day?', pt: 'Quem toca o negócio no dia a dia?' },
    options: [
      { value: 'managers', level: 'pass', label: { en: 'Managers or supervisors, the owner oversees', pt: 'Gerentes ou supervisores, o dono supervisiona' } },
      {
        value: 'owner_with_staff',
        level: 'caution',
        label: { en: 'The owner, with staff doing the frontline work', pt: 'O dono, com a equipe fazendo o trabalho operacional' },
        note: {
          en: 'A first-line supervisor of frontline staff does not qualify as a manager. Name or hire a supervisor before the sale.',
          pt: 'Um supervisor direto de equipe operacional não qualifica como gerente. Nomeie ou contrate um supervisor antes da venda.',
        },
      },
      {
        value: 'owner_does',
        level: 'caution',
        label: { en: 'The owner does most of the work', pt: 'O dono faz a maior parte do trabalho' },
        note: {
          en: 'An L-1A buyer cannot mainly do the operational work. Staff would have to take it over before or at closing.',
          pt: 'Um comprador L-1A não pode fazer principalmente o trabalho operacional. A equipe teria de assumi-lo antes ou no fechamento.',
        },
      },
    ],
  },
  {
    id: 'premises',
    req: { en: 'Physical premises', pt: 'Instalações físicas' },
    label: { en: 'Where does it operate?', pt: 'Onde opera?' },
    options: [
      { value: 'commercial', level: 'pass', label: { en: 'Commercial location, leased or owned', pt: 'Ponto comercial, alugado ou próprio' } },
      {
        value: 'home_virtual',
        level: 'caution',
        label: { en: 'Home-based or virtual', pt: 'Residencial ou virtual' },
        note: {
          en: 'The petition needs a lease or deed and photos of real premises. A commercial location would have to be secured.',
          pt: 'A petição exige contrato de aluguel ou escritura e fotos de instalações reais. Seria preciso garantir um ponto comercial.',
        },
      },
    ],
  },
  {
    id: 'sale',
    req: { en: 'Ownership and control', pt: 'Propriedade e controle' },
    label: { en: 'How much of the business is for sale?', pt: 'Quanto do negócio está à venda?' },
    options: [
      { value: 'all', level: 'pass', label: { en: '100%', pt: '100%' } },
      { value: 'majority', level: 'pass', label: { en: 'A majority, with control', pt: 'A maioria, com controle' } },
      {
        value: 'half',
        level: 'caution',
        label: { en: 'Exactly half', pt: 'Exatamente metade' },
        note: {
          en: 'A 50/50 joint venture qualifies only with equal control and veto power. The attorney must structure it.',
          pt: 'Uma joint venture 50/50 só qualifica com controle igual e poder de veto. O advogado precisa estruturar.',
        },
      },
      {
        value: 'minority',
        level: 'fail',
        label: { en: 'Less than half', pt: 'Menos da metade' },
        note: {
          en: 'Without majority ownership or actual control there is no qualifying relationship between the two companies.',
          pt: 'Sem maioria ou controle efetivo não há vínculo qualificado entre as duas empresas.',
        },
      },
    ],
  },
  {
    id: 'structure',
    req: { en: 'Company can be acquired', pt: 'A empresa pode ser adquirida' },
    label: { en: 'Would you sell the company itself, or only its assets?', pt: 'Você venderia a empresa em si ou apenas os ativos?' },
    help: {
      en: 'Selling the company means selling its stock or LLC membership interests.',
      pt: 'Vender a empresa significa vender as ações ou cotas da LLC.',
    },
    options: [
      { value: 'entity', level: 'pass', label: { en: 'The company itself', pt: 'A empresa em si' } },
      { value: 'either', level: 'pass', label: { en: 'Either one', pt: 'Qualquer um dos dois' } },
      {
        value: 'assets',
        level: 'caution',
        label: { en: 'Assets only', pt: 'Apenas os ativos' },
        note: {
          en: 'Assets go into a new company with no history, so the buyer is treated as a “new office”. A sale of the company itself avoids that.',
          pt: 'Os ativos vão para uma empresa nova, sem histórico, e o comprador é tratado como “new office”. A venda da própria empresa evita isso.',
        },
      },
    ],
  },
  {
    id: 'transfer',
    req: { en: 'Transferable to a foreign owner', pt: 'Transferível a dono estrangeiro' },
    label: { en: 'Can a foreign-owned company take over and keep operating?', pt: 'Uma empresa de dono estrangeiro pode assumir e continuar operando?' },
    help: { en: 'Think of licenses, the franchise agreement and the lease.', pt: 'Considere licenças, contrato de franquia e aluguel.' },
    options: [
      { value: 'yes', level: 'pass', label: { en: 'Yes, nothing prevents it', pt: 'Sim, nada impede' } },
      {
        value: 'approval',
        level: 'caution',
        label: { en: 'Yes, with approval from a franchisor, landlord or board', pt: 'Sim, com aprovação de franqueador, locador ou órgão' },
        note: { en: 'Get the approval terms in writing before the sale.', pt: 'Obtenha os termos da aprovação por escrito antes da venda.' },
      },
      {
        value: 'owner_license',
        level: 'caution',
        label: { en: 'It depends on a license only I hold', pt: 'Depende de uma licença que só eu tenho' },
        note: {
          en: 'A licensed employee must stay, or the business cannot operate after you leave.',
          pt: 'Um funcionário licenciado precisa permanecer, ou o negócio não opera depois da sua saída.',
        },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No, a license or contract requires a U.S. owner', pt: 'Não, uma licença ou contrato exige dono americano' },
        note: {
          en: 'If ownership cannot pass to a foreign-owned company, an L-1 buyer cannot acquire it.',
          pt: 'Se a propriedade não pode ir para uma empresa de dono estrangeiro, um comprador L-1 não pode adquiri-la.',
        },
      },
    ],
  },
  {
    id: 'records',
    req: { en: 'Documented operations', pt: 'Operação documentada' },
    label: { en: 'How are the books kept?', pt: 'Como é a contabilidade?' },
    options: [
      { value: 'clean', level: 'pass', label: { en: 'Tax returns filed every year, payroll through a payroll service', pt: 'Declarações todo ano, folha por serviço de payroll' } },
      {
        value: 'partial',
        level: 'caution',
        label: { en: 'Returns filed, but some pay or sales are informal', pt: 'Declarações em dia, mas parte de salários ou vendas é informal' },
        note: {
          en: 'Only what appears on the returns and payroll reports counts as evidence, for the visa and for the price.',
          pt: 'Só o que aparece nas declarações e nos relatórios de folha conta como prova, para o visto e para o preço.',
        },
      },
      {
        value: 'informal',
        level: 'fail',
        label: { en: 'Mostly cash, returns missing or late', pt: 'Quase tudo em dinheiro, declarações faltando ou atrasadas' },
        note: {
          en: 'Without filed returns and payroll records the business cannot be documented for an L-1 petition.',
          pt: 'Sem declarações e registros de folha o negócio não pode ser documentado para uma petição L-1.',
        },
      },
    ],
  },
];

/** Do the candidate and the Brazilian company meet the core L-1A requirements? */
const BR_QUESTIONS: ChoiceQuestion[] = [
  {
    id: 'role',
    req: { en: 'Managerial or executive role', pt: 'Cargo gerencial ou executivo' },
    label: { en: 'What is your role at the company in Brazil?', pt: 'Qual é o seu cargo na empresa no Brasil?' },
    options: [
      { value: 'owner_exec', level: 'pass', label: { en: 'Owner or partner who runs it (sócio-administrador)', pt: 'Sócio-administrador' } },
      { value: 'executive', level: 'pass', label: { en: 'Executive, director or manager', pt: 'Executivo, diretor ou gerente' } },
      {
        value: 'other',
        level: 'fail',
        label: { en: 'Other, or I do not work there', pt: 'Outro, ou não trabalho lá' },
        note: {
          en: 'L-1A requires that you worked abroad as a manager or executive of the company.',
          pt: 'O L-1A exige que você tenha trabalhado no exterior como gerente ou executivo da empresa.',
        },
      },
    ],
  },
  {
    id: 'tenure',
    req: { en: 'One continuous year abroad', pt: 'Um ano contínuo no exterior' },
    label: { en: 'Have you worked there full time for one continuous year within the last three?', pt: 'Você trabalhou lá em tempo integral por um ano contínuo nos últimos três?' },
    help: { en: 'Count only time worked in Brazil.', pt: 'Conte apenas o tempo trabalhado no Brasil.' },
    options: [
      { value: 'yes', level: 'pass', label: yes },
      {
        value: 'almost',
        level: 'caution',
        label: { en: 'Not yet, but within six months', pt: 'Ainda não, mas em até seis meses' },
        note: { en: 'The petition can be filed only once the continuous year is complete.', pt: 'A petição só pode ser protocolada quando o ano contínuo estiver completo.' },
      },
      {
        value: 'no',
        level: 'fail',
        label: no,
        note: {
          en: 'One continuous year of full-time work abroad within the last three is a core L-1 requirement.',
          pt: 'Um ano contínuo de trabalho em tempo integral no exterior nos últimos três é requisito central do L-1.',
        },
      },
    ],
  },
  {
    id: 'pay_trail',
    req: { en: 'Documented employment', pt: 'Vínculo documentado' },
    label: { en: 'Is that work documented?', pt: 'Esse trabalho está documentado?' },
    help: { en: 'Pró-labore, pay stubs or payroll records.', pt: 'Pró-labore, holerites ou folha.' },
    options: [
      { value: 'yes', level: 'pass', label: { en: 'Yes, every month', pt: 'Sim, todos os meses' } },
      {
        value: 'partial',
        level: 'caution',
        label: { en: 'Partly, with gaps', pt: 'Em parte, com lacunas' },
        note: {
          en: 'Gaps in the pay record are the most common weakness. Other corporate records may fill them, at the attorney’s discretion.',
          pt: 'Lacunas no registro de pagamento são a fraqueza mais comum. Outros registros societários podem supri-las, a critério do advogado.',
        },
      },
      {
        value: 'no',
        level: 'fail',
        label: no,
        note: {
          en: 'Without a pay record the year cannot be proven. Formalize pró-labore now: the record takes 12 months to build.',
          pt: 'Sem registro de pagamento o ano não pode ser comprovado. Formalize o pró-labore agora: o histórico leva 12 meses.',
        },
      },
    ],
  },
  {
    id: 'manages',
    req: { en: 'Managerial capacity abroad', pt: 'Capacidade gerencial no exterior' },
    label: { en: 'What do you mostly do day to day?', pt: 'O que você mais faz no dia a dia?' },
    help: { en: 'Think of a typical week.', pt: 'Pense em uma semana típica.' },
    options: [
      { value: 'people', level: 'pass', label: { en: 'Manage managers, supervisors or professionals', pt: 'Gerencio gerentes, supervisores ou profissionais' } },
      { value: 'function', level: 'pass', label: { en: 'Run an essential function or department', pt: 'Dirijo uma função ou departamento essencial' } },
      {
        value: 'hands_on',
        level: 'caution',
        label: { en: 'Mostly the hands-on work myself', pt: 'Principalmente o trabalho operacional' },
        note: {
          en: 'You must primarily manage people or an essential function. Delegate the hands-on work and document it before filing.',
          pt: 'Você precisa principalmente gerenciar pessoas ou uma função essencial. Delegue o trabalho operacional e documente isso antes do protocolo.',
        },
      },
    ],
  },
  {
    id: 'company_age',
    req: { en: 'Active company abroad', pt: 'Empresa ativa no exterior' },
    label: { en: 'Is the company in Brazil active, and for how long?', pt: 'A empresa no Brasil está ativa, e há quanto tempo?' },
    options: [
      { value: 'gt3', level: 'pass', label: { en: 'Active for more than 3 years', pt: 'Ativa há mais de 3 anos' } },
      { value: '1to3', level: 'pass', label: { en: 'Active for 1 to 3 years', pt: 'Ativa há 1 a 3 anos' } },
      {
        value: 'lt1',
        level: 'fail',
        label: { en: 'Active for less than 1 year', pt: 'Ativa há menos de 1 ano' },
        note: {
          en: 'The company must have employed you for a full year before a petition is possible.',
          pt: 'A empresa precisa ter empregado você por um ano completo antes da petição.',
        },
      },
      {
        value: 'inactive',
        level: 'fail',
        label: { en: 'Inactive, or a MEI', pt: 'Inativa, ou MEI' },
        note: {
          en: 'The company abroad must be actively selling goods or services, with a structure a manager can lead.',
          pt: 'A empresa no exterior precisa vender bens ou serviços ativamente, com estrutura que um gerente possa liderar.',
        },
      },
    ],
  },
  {
    id: 'employees',
    req: { en: 'Staff abroad', pt: 'Equipe no exterior' },
    label: { en: 'How many employees does it have, besides you?', pt: 'Quantos funcionários ela tem, além de você?' },
    options: [
      {
        value: '0',
        level: 'fail',
        label: { en: 'None', pt: 'Nenhum' },
        note: {
          en: 'With no staff there is no one to manage, and no one to keep the company running after you move.',
          pt: 'Sem equipe não há quem gerenciar, nem quem mantenha a empresa funcionando depois da sua mudança.',
        },
      },
      {
        value: '1to2',
        level: 'caution',
        label: { en: '1 or 2', pt: '1 ou 2' },
        note: {
          en: 'There is no legal minimum, but a very small team makes the managerial role harder to prove.',
          pt: 'Não há mínimo legal, mas uma equipe muito pequena dificulta comprovar o cargo gerencial.',
        },
      },
      { value: '3to9', level: 'pass', label: { en: '3 to 9', pt: '3 a 9' } },
      { value: '10plus', level: 'pass', label: { en: '10 or more', pt: '10 ou mais' } },
    ],
  },
  {
    id: 'continues',
    req: { en: 'Company keeps operating', pt: 'A empresa continua operando' },
    label: { en: 'Will the company in Brazil keep operating after you move?', pt: 'A empresa no Brasil continuará operando depois da sua mudança?' },
    options: [
      { value: 'yes_successor', level: 'pass', label: { en: 'Yes, and someone is ready to run it', pt: 'Sim, e já há quem a administre' } },
      {
        value: 'yes_unsure',
        level: 'caution',
        label: { en: 'Yes, but no one is named yet', pt: 'Sim, mas ainda sem responsável definido' },
        note: {
          en: 'Name who will run the company in Brazil and formalize their authority in the contrato social or by power of attorney.',
          pt: 'Defina quem administrará a empresa no Brasil e formalize os poderes no contrato social ou por procuração.',
        },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No, it would close or pause', pt: 'Não, ela fecharia ou pararia' },
        note: {
          en: 'If the company abroad stops doing business, the L-1 status ends with it.',
          pt: 'Se a empresa no exterior deixar de operar, o status L-1 termina com ela.',
        },
      },
    ],
  },
  {
    id: 'ownership',
    req: { en: 'Qualifying relationship', pt: 'Vínculo qualificado' },
    label: { en: 'Who would own the U.S. business after the purchase?', pt: 'Quem seria o dono do negócio nos EUA após a compra?' },
    options: [
      { value: 'majority', level: 'pass', label: { en: 'The Brazilian company, with more than 50%', pt: 'A empresa brasileira, com mais de 50%' } },
      {
        value: 'same_owners',
        level: 'pass',
        label: { en: 'The same owners as in Brazil, in the same proportions', pt: 'Os mesmos sócios do Brasil, nas mesmas proporções' },
      },
      {
        value: 'fifty',
        level: 'caution',
        label: { en: '50/50 with an outside partner', pt: '50/50 com um sócio de fora' },
        note: {
          en: 'A 50/50 joint venture qualifies only with equal control and veto power. The attorney should structure it.',
          pt: 'Uma joint venture 50/50 só qualifica com controle igual e poder de veto. O advogado deve estruturá-la.',
        },
      },
      {
        value: 'unsure',
        level: 'caution',
        label: { en: 'Not sure yet', pt: 'Ainda não sei' },
        note: {
          en: 'Ownership must be in place before filing. Ownership by the Brazilian company is the cleanest structure.',
          pt: 'A estrutura societária precisa estar definida antes do protocolo. A participação pela empresa brasileira é a estrutura mais limpa.',
        },
      },
      {
        value: 'minority',
        level: 'fail',
        label: { en: 'Less than 50%, without control', pt: 'Menos de 50%, sem controle' },
        note: { en: 'Without ownership and control there is no qualifying relationship.', pt: 'Sem propriedade e controle não há vínculo qualificado.' },
      },
    ],
  },
  {
    id: 'us_role',
    req: { en: 'Managerial role in the U.S.', pt: 'Cargo gerencial nos EUA' },
    label: { en: 'What would you do in the U.S. business?', pt: 'O que você faria no negócio nos EUA?' },
    options: [
      { value: 'manage', level: 'pass', label: { en: 'Direct it through managers and staff', pt: 'Dirigir por meio de gerentes e equipe' } },
      {
        value: 'mixed',
        level: 'caution',
        label: { en: 'Manage it, and work hands-on at first', pt: 'Gerenciar e, no início, pôr a mão na massa' },
        note: {
          en: 'Hands-on work must stay a small part of your time. Choose a business with enough staff to cover operations from day one.',
          pt: 'O trabalho operacional precisa ser uma parte pequena do seu tempo. Escolha um negócio com equipe suficiente para a operação desde o primeiro dia.',
        },
      },
      {
        value: 'operate',
        level: 'fail',
        label: { en: 'Do most of the work myself', pt: 'Fazer a maior parte do trabalho' },
        note: {
          en: 'A role that is mainly operational does not qualify for L-1A, whatever the title.',
          pt: 'Um cargo principalmente operacional não qualifica para o L-1A, qualquer que seja o título.',
        },
      },
    ],
  },
];

export const QUESTIONS: Record<Kind, ChoiceQuestion[]> = { us: US_QUESTIONS, br: BR_QUESTIONS };

/**
 * Requirements that depend on two answers together. The staffing rule looks at
 * the reasonable needs of the business: a tiny team plus a hands-on manager
 * leaves no managerial role, even though neither answer fails alone.
 */
const CROSS_RULES: Record<Kind, { when: (a: Stage1Answers) => boolean; id: string; note: L }[]> = {
  us: [
    {
      id: 'runs',
      when: (a) => a.runs === 'owner_does' && a.employees === '1to2',
      note: {
        en: 'With one or two employees and the owner doing most of the work, there is no managerial role for an L-1A buyer to step into.',
        pt: 'Com um ou dois funcionários e o dono fazendo a maior parte do trabalho, não há cargo gerencial para um comprador L-1A assumir.',
      },
    },
  ],
  br: [
    {
      id: 'manages',
      when: (a) => a.manages === 'hands_on' && a.employees === '1to2',
      note: {
        en: 'With one or two employees and mostly hands-on work, a managerial role cannot be shown today. Build a team and delegate first.',
        pt: 'Com um ou dois funcionários e trabalho principalmente operacional, não é possível demonstrar cargo gerencial hoje. Monte uma equipe e delegue antes.',
      },
    },
  ],
};

export type Stage1Answers = Record<string, string>;
export type Finding = { id: string; level: Level; topic: L; label: L; note?: L };
export type Stage1Rating = 'compliant' | 'gaps' | 'not_compliant';
export type Stage1Result = { rating: Stage1Rating; passed: boolean; score: number; findings: Finding[] };

export const STAGE1_RATING: Record<Stage1Rating, L> = {
  compliant: { en: 'Compliant', pt: 'Conforme' },
  gaps: { en: 'Gaps to fix', pt: 'Pontos a corrigir' },
  not_compliant: { en: 'Not compliant', pt: 'Não conforme' },
};

export const STAGE1_HEADLINE: Record<Kind, Record<Stage1Rating, L>> = {
  us: {
    compliant: { en: 'Good news. Your business qualifies for our international buyers.', pt: 'Boa notícia. O seu negócio se qualifica para os nossos compradores internacionais.' },
    gaps: {
      en: 'Your business can qualify for our international buyers. A few points need attention.',
      pt: 'O seu negócio pode se qualificar para os nossos compradores internacionais. Alguns pontos precisam de atenção.',
    },
    not_compliant: { en: 'As it stands, our L-1 buyers cannot acquire this business.', pt: 'Do jeito que está, os nossos compradores L-1 não podem adquirir este negócio.' },
  },
  br: {
    compliant: { en: 'You and your company meet the core L-1A requirements we screen for.', pt: 'Você e sua empresa atendem aos requisitos centrais do L-1A que analisamos.' },
    gaps: { en: 'Your profile can work. A few points need attention.', pt: 'Seu perfil pode funcionar. Alguns pontos precisam de atenção.' },
    not_compliant: { en: 'Something essential is missing today. Here is what to fix.', pt: 'Falta algo essencial hoje. Veja o que corrigir.' },
  },
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
    const cross = CROSS_RULES[kind].find((r) => r.id === q.id && r.when(a));
    const level: Level = cross ? 'fail' : opt.level;
    points += level === 'pass' ? 2 : level === 'caution' ? 1 : 0;
    findings.push({ id: q.id, level, topic: q.req, label: opt.label, note: cross?.note ?? opt.note });
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
    id: 'debt',
    kind: 'money',
    unit: 'USD',
    label: { en: 'Business debt today', pt: 'Dívida do negócio hoje' },
    help: { en: 'Loans, credit lines and equipment financing. Enter 0 if none.', pt: 'Empréstimos, linhas de crédito e financiamento de equipamentos. Digite 0 se não houver.' },
  },
  {
    id: 'seller_note',
    kind: 'choice',
    label: { en: 'Would you finance part of the price?', pt: 'Você financiaria parte do preço?' },
    options: [
      { value: 'yes20', label: { en: 'Yes, 20% or more', pt: 'Sim, 20% ou mais' } },
      { value: 'some', label: { en: 'Yes, less than 20%', pt: 'Sim, menos de 20%' } },
      { value: 'none', label: { en: 'No, cash only', pt: 'Não, só à vista' } },
    ],
  },
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
    help: { en: 'In US dollars, company and personal funds together.', pt: 'Em dólares, somando recursos da empresa e pessoais.' },
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

function scoreUs(a: Record<string, number>, reason: string, sellerNote: string, add: Add) {
  const { price, rev_y1, rev_y2, rev_y3, sde, employees, lease_years, owner_hours, top_customer_pct, debt } = a;

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
    const ret = price > 0 ? (sde - PARAMS.managerSalaryUsd) / price : -1;
    const grade: Grade = ret >= PARAMS.returnGood ? 'good' : ret >= PARAMS.returnOk ? 'ok' : 'weak';
    add('return', { en: 'Return on price', pt: 'Retorno sobre o preço' }, price > 0 ? `${pct(ret)}/yr` : 'n/a', grade, {
      good: { en: 'A strong yearly return after paying a manager.', pt: 'Retorno anual forte depois de pagar um gerente.' },
      ok: { en: 'A modest return after paying a manager.', pt: 'Retorno modesto depois de pagar um gerente.' },
      weak: { en: 'Too little is left for the buyer at this price.', pt: 'Sobra pouco para o comprador a este preço.' },
    });
  }
  {
    const ratio = debt <= 0 ? 0 : sde > 0 ? debt / sde : Infinity;
    const grade: Grade = ratio <= PARAMS.debtToEarningsGood ? 'good' : ratio <= PARAMS.debtToEarningsOk ? 'ok' : 'weak';
    add('debt', { en: 'Debt load', pt: 'Endividamento' }, Number.isFinite(ratio) ? `${ratio.toFixed(1)}× earnings` : 'n/a', grade, {
      good: { en: 'Little or no debt passes to the buyer.', pt: 'Pouca ou nenhuma dívida passa ao comprador.' },
      ok: { en: 'Debt stays with the company in a sale. It should be paid off at closing or priced in.', pt: 'A dívida fica com a empresa na venda. Deve ser quitada no fechamento ou descontada do preço.' },
      weak: { en: 'Debt is heavy against earnings and must be cleared at closing.', pt: 'A dívida é alta frente ao lucro e precisa ser quitada no fechamento.' },
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
    const grade: Grade = top_customer_pct <= 20 ? 'good' : top_customer_pct <= 30 ? 'ok' : 'weak';
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
  {
    const grade: Grade = sellerNote === 'yes20' ? 'good' : 'ok';
    const text: Record<string, string> = { yes20: '20%+', some: 'Under 20%', none: 'Cash only' };
    add('financing', { en: 'Seller financing', pt: 'Financiamento do vendedor' }, text[sellerNote] ?? sellerNote, grade, {
      good: { en: 'Widens the pool of international buyers, who cannot use SBA loans.', pt: 'Amplia o número de compradores internacionais, que não podem usar empréstimos SBA.' },
      ok:
        sellerNote === 'none'
          ? { en: 'Cash-only terms narrow the pool: these buyers cannot use SBA loans.', pt: 'Venda só à vista reduz o número de compradores: eles não podem usar empréstimos SBA.' }
          : { en: 'Helps, but most of the price must come in cash.', pt: 'Ajuda, mas a maior parte do preço precisa vir à vista.' },
      weak: { en: '', pt: '' },
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
    // What the company can send and still pay its own bills, at a stressed exchange rate.
    const reserve = (Math.max(rev_y3 - profit, 0) / 12) * PARAMS.brReserveMonths;
    const capacity = Math.max(cash - reserve - Math.max(debt, 0), 0) / (PARAMS.brlPerUsd * (1 + PARAMS.fxStressPct));
    const grade: Grade = capacity >= invest_usd && invest_usd > 0 ? 'good' : capacity > 0 ? 'ok' : 'weak';
    add('capacity', { en: 'Company can fund', pt: 'A empresa consegue aportar' }, usd(capacity), grade, {
      good: { en: 'The company can fund the planned investment and keep a reserve.', pt: 'A empresa consegue aportar o investimento planejado e manter uma reserva.' },
      ok: {
        en: 'The company covers only part of the planned investment. The rest would be personal funds, which the attorney must document.',
        pt: 'A empresa cobre apenas parte do investimento planejado. O restante viria de recursos pessoais, que o advogado precisa documentar.',
      },
      weak: {
        en: 'After its own costs and debt the company has nothing to send. Funding from the company is the cleanest trail.',
        pt: 'Depois dos próprios custos e dívidas a empresa não tem o que enviar. O aporte pela empresa é o caminho mais limpo.',
      },
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
  if (kind === 'us') scoreUs(nums, String(a.sale_reason), String(a.seller_note), add);
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
