/**
 * The 10xBR evaluation process, as data.
 *
 * Everything that decides an outcome lives here: questions, thresholds and
 * scoring. The browser uses it for the instant preview and the Worker
 * re-computes it as the authoritative result. This is a screening tool, never
 * a legal opinion: the attorney confirms.
 */

export type Lang = 'en' | 'pt';
export type L = { en: string; pt: string };
export type Level = 'pass' | 'caution' | 'fail';

/** Tunable defaults. Calibrate with the immigration attorney. */
export const PARAMS = {
  managerSalaryUsd: 75_000,
  residualMinPctOfEarnings: 0.2,
  newOfficeFundsGoodUsd: 150_000,
  newOfficeFundsOkUsd: 75_000,
  acquisitionFundsGoodPct: 1.0,
  acquisitionFundsOkPct: 0.6,
  priceMultipleGood: 3.5,
  priceMultipleOk: 5,
  healthyMinPct: 0.75,
  watchMinPct: 0.5,
  watchMaxWeak: 2,
} as const;

export const STAGES: { id: number; key: string; title: L; blurb: L; time: L }[] = [
  {
    id: 1,
    key: 'qualification',
    title: { en: 'L-1 quick check', pt: 'Pré-qualificação L-1' },
    blurb: {
      en: 'Nine one-tap questions on the core L-1A requirements.',
      pt: 'Nove perguntas de um toque sobre os requisitos centrais do L-1A.',
    },
    time: { en: '2 min', pt: '2 min' },
  },
  {
    id: 2,
    key: 'snapshot',
    title: { en: 'Business snapshot', pt: 'Retrato do negócio' },
    blurb: {
      en: 'A handful of numbers that show health and trend.',
      pt: 'Alguns números que mostram saúde e tendência.',
    },
    time: { en: '5 min', pt: '5 min' },
  },
  {
    id: 3,
    key: 'essentials',
    title: { en: 'Essential documents', pt: 'Documentos essenciais' },
    blurb: {
      en: 'Sign the NDA, then share the core documents. AI reads each one.',
      pt: 'Assine o NDA e envie os documentos principais. A IA lê cada um.',
    },
    time: { en: '1–3 days', pt: '1–3 dias' },
  },
  {
    id: 4,
    key: 'verification',
    title: { en: 'Deep verification', pt: 'Verificação completa' },
    blurb: {
      en: 'Full attorney document list, tax and bank analysis, background checks.',
      pt: 'Lista completa do advogado, análise fiscal e bancária, verificação de antecedentes.',
    },
    time: { en: '1–2 weeks', pt: '1–2 semanas' },
  },
  {
    id: 5,
    key: 'decision',
    title: { en: 'Decision', pt: 'Decisão' },
    blurb: {
      en: 'A clear recommendation with conditions and next steps.',
      pt: 'Uma recomendação clara com condições e próximos passos.',
    },
    time: { en: '', pt: '' },
  },
];

/* ------------------------------------------------------------------ */
/* Stage 1 — L-1 quick check                                           */
/* ------------------------------------------------------------------ */

export type Option = { value: string; label: L; level: Level; note?: L };
export type ChoiceQuestion = { id: string; label: L; help?: L; options: Option[] };

export const STAGE1: ChoiceQuestion[] = [
  {
    id: 'role',
    label: { en: 'What is your role at the company abroad?', pt: 'Qual é o seu cargo na empresa no exterior?' },
    help: {
      en: 'L-1A is for managers and executives.',
      pt: 'O L-1A é para gerentes e executivos.',
    },
    options: [
      { value: 'owner_exec', level: 'pass', label: { en: 'Owner or partner who runs it', pt: 'Sócio ou dono que administra' } },
      { value: 'executive', level: 'pass', label: { en: 'Executive or director', pt: 'Executivo ou diretor' } },
      { value: 'manager', level: 'pass', label: { en: 'Manager', pt: 'Gerente' } },
      {
        value: 'specialist',
        level: 'caution',
        label: { en: 'Specialist with deep company knowledge', pt: 'Especialista com conhecimento profundo da empresa' },
        note: {
          en: 'Specialist roles point to L-1B, a different path. The attorney should confirm which applies.',
          pt: 'Cargos de especialista apontam para o L-1B, um caminho diferente. O advogado deve confirmar qual se aplica.',
        },
      },
      {
        value: 'other',
        level: 'fail',
        label: { en: 'Other, or I do not work there', pt: 'Outro, ou não trabalho lá' },
        note: {
          en: 'L-1 requires a manager, executive or specialist role at the company abroad.',
          pt: 'O L-1 exige cargo de gerente, executivo ou especialista na empresa no exterior.',
        },
      },
    ],
  },
  {
    id: 'tenure',
    label: {
      en: 'Have you worked there for one continuous year within the last three?',
      pt: 'Você trabalhou lá por um ano contínuo nos últimos três?',
    },
    options: [
      { value: 'yes', level: 'pass', label: { en: 'Yes', pt: 'Sim' } },
      {
        value: 'almost',
        level: 'caution',
        label: { en: 'Not yet, but within six months', pt: 'Ainda não, mas em até seis meses' },
        note: {
          en: 'The petition can only be filed once the continuous year is complete.',
          pt: 'A petição só pode ser protocolada quando o ano contínuo estiver completo.',
        },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No', pt: 'Não' },
        note: {
          en: 'One continuous year of employment abroad in the last three is a core L-1 requirement.',
          pt: 'Um ano contínuo de trabalho no exterior nos últimos três é requisito central do L-1.',
        },
      },
    ],
  },
  {
    id: 'pay_trail',
    label: {
      en: 'Is that employment documented?',
      pt: 'Esse vínculo está documentado?',
    },
    help: {
      en: 'Payroll, pay stubs, pró-labore or similar records.',
      pt: 'Folha de pagamento, holerites, pró-labore ou registros similares.',
    },
    options: [
      { value: 'yes', level: 'pass', label: { en: 'Yes, every month', pt: 'Sim, todos os meses' } },
      {
        value: 'partial',
        level: 'caution',
        label: { en: 'Partly, with gaps', pt: 'Em parte, com lacunas' },
        note: {
          en: 'Gaps in the pay record are the most common weakness. Other corporate records may fill them.',
          pt: 'Lacunas no registro de pagamento são a fraqueza mais comum. Outros registros societários podem supri-las.',
        },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No', pt: 'Não' },
        note: {
          en: 'Without a pay record the year of employment cannot be proven. Formalize it now: the record takes 12 months to build.',
          pt: 'Sem registro de pagamento o ano de trabalho não pode ser comprovado. Formalize agora: o histórico leva 12 meses.',
        },
      },
    ],
  },
  {
    id: 'manages',
    label: { en: 'What do you mostly do day to day?', pt: 'O que você mais faz no dia a dia?' },
    options: [
      {
        value: 'people',
        level: 'pass',
        label: {
          en: 'Manage managers, supervisors or professionals',
          pt: 'Gerencio gerentes, supervisores ou profissionais',
        },
      },
      {
        value: 'function',
        level: 'pass',
        label: { en: 'Run an essential function or department', pt: 'Dirijo uma função ou departamento essencial' },
      },
      {
        value: 'hands_on',
        level: 'caution',
        label: { en: 'Mostly the hands-on work myself', pt: 'Principalmente o trabalho operacional' },
        note: {
          en: 'Managerial capacity means directing others or a key function, not doing the frontline work.',
          pt: 'Capacidade gerencial significa dirigir pessoas ou uma função-chave, não executar o trabalho operacional.',
        },
      },
    ],
  },
  {
    id: 'company_age',
    label: { en: 'How long has the company abroad been operating?', pt: 'Há quanto tempo a empresa no exterior opera?' },
    options: [
      {
        value: 'lt1',
        level: 'fail',
        label: { en: 'Less than 1 year', pt: 'Menos de 1 ano' },
        note: {
          en: 'The company must have employed you for a full year before a petition is possible.',
          pt: 'A empresa precisa ter empregado você por um ano completo antes da petição.',
        },
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
        note: {
          en: 'A company with no staff reads as a shell and cannot show a managerial role.',
          pt: 'Uma empresa sem equipe parece uma casca e não demonstra cargo gerencial.',
        },
      },
      {
        value: '1to2',
        level: 'caution',
        label: { en: '1 or 2', pt: '1 ou 2' },
        note: {
          en: 'A very small team makes the managerial role harder to prove.',
          pt: 'Uma equipe muito pequena dificulta comprovar o cargo gerencial.',
        },
      },
      { value: '3to9', level: 'pass', label: { en: '3 to 9', pt: '3 a 9' } },
      { value: '10plus', level: 'pass', label: { en: '10 or more', pt: '10 ou mais' } },
    ],
  },
  {
    id: 'continues',
    label: {
      en: 'Will the company abroad keep operating after you move?',
      pt: 'A empresa no exterior continuará operando depois da sua mudança?',
    },
    options: [
      {
        value: 'yes_successor',
        level: 'pass',
        label: { en: 'Yes, and someone is ready to run it', pt: 'Sim, e já há quem a administre' },
      },
      {
        value: 'yes_unsure',
        level: 'caution',
        label: { en: 'Yes, but no one is named yet', pt: 'Sim, mas ainda sem responsável definido' },
        note: {
          en: 'Name who will run the company abroad and formalize their authority.',
          pt: 'Defina quem administrará a empresa no exterior e formalize os poderes.',
        },
      },
      {
        value: 'no',
        level: 'fail',
        label: { en: 'No, it would close or pause', pt: 'Não, ela fecharia ou pararia' },
        note: {
          en: 'The company abroad must keep doing business for the whole L-1 period.',
          pt: 'A empresa no exterior precisa continuar operando durante todo o período do L-1.',
        },
      },
    ],
  },
  {
    id: 'us_plan',
    label: { en: 'What is the plan for the U.S. company?', pt: 'Qual é o plano para a empresa nos EUA?' },
    options: [
      {
        value: 'acquire',
        level: 'pass',
        label: { en: 'Buy an existing U.S. business', pt: 'Comprar um negócio existente nos EUA' },
      },
      {
        value: 'existing',
        level: 'pass',
        label: {
          en: 'We already own a U.S. company, operating 1+ year',
          pt: 'Já temos uma empresa nos EUA, operando há 1+ ano',
        },
      },
      {
        value: 'new_office',
        level: 'caution',
        label: { en: 'Open a new U.S. office', pt: 'Abrir um novo escritório nos EUA' },
        note: {
          en: 'New-office rules apply: one-year initial approval, premises secured, business plan, closer scrutiny.',
          pt: 'Aplicam-se regras de new office: aprovação inicial de um ano, ponto comercial, plano de negócios e análise mais rigorosa.',
        },
      },
      {
        value: 'undecided',
        level: 'caution',
        label: { en: 'Not decided yet', pt: 'Ainda não decidido' },
        note: {
          en: 'We will help you compare buying a business with opening a new office.',
          pt: 'Vamos ajudar a comparar a compra de um negócio com a abertura de um novo escritório.',
        },
      },
    ],
  },
  {
    id: 'ownership',
    label: { en: 'Who will own the U.S. company?', pt: 'Quem será o dono da empresa nos EUA?' },
    help: {
      en: 'The two companies need a qualifying relationship: parent, subsidiary, branch or affiliate.',
      pt: 'As duas empresas precisam de vínculo qualificado: matriz, subsidiária, filial ou afiliada.',
    },
    options: [
      {
        value: 'majority',
        level: 'pass',
        label: {
          en: 'The company abroad or its same owners, over 50%',
          pt: 'A empresa no exterior ou os mesmos sócios, acima de 50%',
        },
      },
      {
        value: 'fifty',
        level: 'caution',
        label: { en: '50/50 with a partner', pt: '50/50 com um sócio' },
        note: {
          en: 'A 50/50 structure can qualify with equal control and veto power. The attorney should structure it.',
          pt: 'Uma estrutura 50/50 pode qualificar com controle igual e poder de veto. O advogado deve estruturá-la.',
        },
      },
      {
        value: 'minority',
        level: 'fail',
        label: { en: 'Less than 50%', pt: 'Menos de 50%' },
        note: {
          en: 'Without ownership and control there is no qualifying relationship.',
          pt: 'Sem propriedade e controle não há vínculo qualificado.',
        },
      },
      {
        value: 'unsure',
        level: 'caution',
        label: { en: 'Not sure yet', pt: 'Ainda não sei' },
        note: {
          en: 'Ownership must be settled before filing; the attorney will advise on structure.',
          pt: 'A estrutura societária precisa estar definida antes do protocolo; o advogado orientará.',
        },
      },
    ],
  },
];

export type Stage1Answers = Record<string, string>;
export type Finding = { id: string; level: Level; label: L; note?: L };
export type Stage1Result = {
  rating: 'strong' | 'possible' | 'not_yet';
  passed: boolean;
  score: number;
  findings: Finding[];
};

export const STAGE1_RATING: Record<Stage1Result['rating'], L> = {
  strong: { en: 'Strong fit', pt: 'Forte aderência' },
  possible: { en: 'Possible fit', pt: 'Aderência possível' },
  not_yet: { en: 'Not a fit yet', pt: 'Ainda não se enquadra' },
};

export function stage1Complete(a: Stage1Answers): boolean {
  return STAGE1.every((q) => q.options.some((o) => o.value === a[q.id]));
}

export function scoreStage1(a: Stage1Answers): Stage1Result {
  const findings: Finding[] = [];
  let points = 0;
  for (const q of STAGE1) {
    const opt = q.options.find((o) => o.value === a[q.id]);
    if (!opt) throw new Error(`Missing answer: ${q.id}`);
    points += opt.level === 'pass' ? 2 : opt.level === 'caution' ? 1 : 0;
    findings.push({ id: q.id, level: opt.level, label: opt.label, note: opt.note });
  }
  const fails = findings.filter((f) => f.level === 'fail').length;
  const cautions = findings.filter((f) => f.level === 'caution').length;
  const rating = fails > 0 ? 'not_yet' : cautions > 0 ? 'possible' : 'strong';
  return {
    rating,
    passed: fails === 0,
    score: Math.round((points / (STAGE1.length * 2)) * 100),
    findings,
  };
}

/* ------------------------------------------------------------------ */
/* Stage 2 — Business snapshot                                         */
/* ------------------------------------------------------------------ */

export type UsPlan = 'acquire' | 'existing' | 'new_office' | 'undecided';

export type FieldDef = {
  id: string;
  kind: 'money' | 'number' | 'choice';
  label: L;
  help?: L;
  /** 'local' = the foreign company's currency; 'usd' = US dollars. */
  unit?: 'local' | 'usd' | 'years' | 'people';
  options?: { value: string; label: L }[];
  allowNegative?: boolean;
};

export const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'MXN', 'ARS', 'COP', 'CLP', 'Other'];

export const STAGE2_FOREIGN: FieldDef[] = [
  { id: 'rev_y1', kind: 'money', unit: 'local', label: { en: 'Revenue, two years ago', pt: 'Faturamento, há dois anos' } },
  { id: 'rev_y2', kind: 'money', unit: 'local', label: { en: 'Revenue, last year', pt: 'Faturamento, ano passado' } },
  {
    id: 'rev_y3',
    kind: 'money',
    unit: 'local',
    label: { en: 'Revenue, most recent 12 months', pt: 'Faturamento, últimos 12 meses' },
  },
  {
    id: 'profit',
    kind: 'money',
    unit: 'local',
    allowNegative: true,
    label: { en: 'Net profit, most recent 12 months', pt: 'Lucro líquido, últimos 12 meses' },
    help: { en: 'Use a negative number for a loss.', pt: 'Use número negativo para prejuízo.' },
  },
  {
    id: 'cash',
    kind: 'money',
    unit: 'local',
    label: { en: 'Cash and liquid investments today', pt: 'Caixa e aplicações líquidas hoje' },
  },
  { id: 'debt', kind: 'money', unit: 'local', label: { en: 'Total debt today', pt: 'Dívida total hoje' } },
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
  {
    id: 'invest_usd',
    kind: 'money',
    unit: 'usd',
    label: { en: 'Funds available to invest in the U.S.', pt: 'Recursos disponíveis para investir nos EUA' },
    help: {
      en: 'In US dollars. Company funds first; the cleanest trail is parent funds subsidiary.',
      pt: 'Em dólares. Recursos da empresa primeiro; a trilha mais limpa é a matriz capitalizar a subsidiária.',
    },
  },
];

export const STAGE2_US: FieldDef[] = [
  {
    id: 'us_price',
    kind: 'money',
    unit: 'usd',
    label: { en: 'Asking price', pt: 'Preço pedido' },
  },
  { id: 'us_rev_prior', kind: 'money', unit: 'usd', label: { en: 'Revenue, prior year', pt: 'Faturamento, ano anterior' } },
  { id: 'us_rev', kind: 'money', unit: 'usd', label: { en: 'Revenue, most recent year', pt: 'Faturamento, ano mais recente' } },
  {
    id: 'us_earnings',
    kind: 'money',
    unit: 'usd',
    allowNegative: true,
    label: { en: "Owner's earnings (SDE)", pt: 'Lucro do proprietário (SDE)' },
    help: {
      en: 'Profit before the owner’s pay, as stated by the broker or the books.',
      pt: 'Lucro antes da remuneração do dono, conforme o corretor ou a contabilidade.',
    },
  },
  { id: 'us_employees', kind: 'number', unit: 'people', label: { en: 'W-2 employees', pt: 'Funcionários W-2' } },
  {
    id: 'us_years',
    kind: 'number',
    unit: 'years',
    label: { en: 'Years operating under the current entity', pt: 'Anos de operação na entidade atual' },
  },
  {
    id: 'us_premises',
    kind: 'choice',
    label: { en: 'Premises', pt: 'Instalações' },
    options: [
      { value: 'commercial', label: { en: 'Commercial location', pt: 'Ponto comercial' } },
      { value: 'home_virtual', label: { en: 'Home-based or virtual', pt: 'Residencial ou virtual' } },
    ],
  },
  {
    id: 'us_lease_years',
    kind: 'number',
    unit: 'years',
    label: { en: 'Lease years remaining, with options', pt: 'Anos restantes de aluguel, com opções' },
  },
];

export function stage2Fields(plan: UsPlan): { foreign: FieldDef[]; us: FieldDef[] } {
  if (plan === 'acquire') return { foreign: STAGE2_FOREIGN, us: STAGE2_US };
  if (plan === 'existing') return { foreign: STAGE2_FOREIGN, us: STAGE2_US.filter((f) => f.id !== 'us_price') };
  return { foreign: STAGE2_FOREIGN, us: [] };
}

export type Stage2Answers = Record<string, number | string>;
export type Grade = 'good' | 'ok' | 'weak';
export type Metric = {
  id: string;
  side: 'foreign' | 'us';
  label: L;
  /** Pre-formatted, language-neutral value such as "+12.4%" or "3.1×". */
  value: string;
  grade: Grade;
  note: L;
};
export type Stage2Result = {
  rating: 'healthy' | 'watch' | 'weak';
  passed: boolean;
  score: number;
  metrics: Metric[];
};

export const STAGE2_RATING: Record<Stage2Result['rating'], L> = {
  healthy: { en: 'Healthy', pt: 'Saudável' },
  watch: { en: 'Watch', pt: 'Atenção' },
  weak: { en: 'Weak', pt: 'Fraco' },
};

const pct = (n: number, signed = false) => `${signed && n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
const num = (a: Stage2Answers, id: string): number => {
  const v = a[id];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Missing or invalid field: ${id}`);
  return v;
};
const usd = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`;

export function stage2Complete(a: Stage2Answers, plan: UsPlan): boolean {
  const { foreign, us } = stage2Fields(plan);
  return [...foreign, ...us].every((f) =>
    f.kind === 'choice'
      ? f.options!.some((o) => o.value === a[f.id])
      : typeof a[f.id] === 'number' && Number.isFinite(a[f.id] as number) && (f.allowNegative || (a[f.id] as number) >= 0),
  );
}

export function scoreStage2(a: Stage2Answers, plan: UsPlan): Stage2Result {
  if (!stage2Complete(a, plan)) throw new Error('Incomplete snapshot');
  const m: Metric[] = [];
  const add = (id: string, side: Metric['side'], label: L, value: string, grade: Grade, note: L) =>
    m.push({ id, side, label, value, grade, note });

  const y1 = num(a, 'rev_y1');
  const y2 = num(a, 'rev_y2');
  const y3 = num(a, 'rev_y3');
  const profit = num(a, 'profit');
  const cash = num(a, 'cash');
  const debt = num(a, 'debt');
  const invest = num(a, 'invest_usd');

  // Revenue trend: compound annual growth over two years; two straight declines are weak.
  {
    const growth = y1 > 0 && y3 > 0 ? Math.sqrt(y3 / y1) - 1 : y3 > y1 ? 1 : -1;
    const twoDeclines = y2 < y1 && y3 < y2;
    const grade: Grade = twoDeclines || growth < -0.05 ? 'weak' : growth >= 0.05 ? 'good' : 'ok';
    add('rev_trend', 'foreign', { en: 'Revenue trend', pt: 'Tendência de faturamento' }, `${pct(growth, true)}/yr`, grade, {
      good: { en: 'Growing year over year.', pt: 'Crescendo ano a ano.' },
      ok: { en: 'Roughly flat.', pt: 'Praticamente estável.' },
      weak: twoDeclines
        ? { en: 'Down two years in a row. Expect to explain why.', pt: 'Queda por dois anos seguidos. Será preciso explicar.' }
        : { en: 'Shrinking. Expect to explain why.', pt: 'Em queda. Será preciso explicar.' },
    }[grade]);
  }

  // Profitability: net margin.
  {
    const margin = y3 > 0 ? profit / y3 : -1;
    const grade: Grade = margin >= 0.1 ? 'good' : margin >= 0.03 ? 'ok' : 'weak';
    add('margin', 'foreign', { en: 'Net margin', pt: 'Margem líquida' }, y3 > 0 ? pct(margin) : '—', grade, {
      good: { en: 'Solidly profitable.', pt: 'Lucratividade sólida.' },
      ok: { en: 'Thin but positive.', pt: 'Baixa, mas positiva.' },
      weak: { en: 'Little or no profit to support a transfer abroad.', pt: 'Pouco ou nenhum lucro para sustentar a expansão.' },
    }[grade]);
  }

  // Liquidity: months of operating costs covered by cash.
  {
    const monthlyCosts = Math.max(y3 - profit, 0) / 12;
    const months = monthlyCosts > 0 ? cash / monthlyCosts : cash > 0 ? 99 : 0;
    const grade: Grade = months >= 3 ? 'good' : months >= 1 ? 'ok' : 'weak';
    add('runway', 'foreign', { en: 'Cash runway', pt: 'Fôlego de caixa' }, `${months >= 99 ? '12+' : months.toFixed(1)} mo`, grade, {
      good: { en: 'Covers three months of costs or more.', pt: 'Cobre três meses de custos ou mais.' },
      ok: { en: 'Covers one to three months of costs.', pt: 'Cobre de um a três meses de custos.' },
      weak: { en: 'Under one month of costs in cash.', pt: 'Menos de um mês de custos em caixa.' },
    }[grade]);
  }

  // Leverage: years of profit needed to repay debt.
  {
    const years = debt <= 0 ? 0 : profit > 0 ? debt / profit : Infinity;
    const grade: Grade = years <= 2 ? 'good' : years <= 4 ? 'ok' : 'weak';
    add('debt', 'foreign', { en: 'Debt load', pt: 'Endividamento' }, Number.isFinite(years) ? `${years.toFixed(1)}× profit` : 'n/a', grade, {
      good: { en: 'Light or no debt.', pt: 'Pouca ou nenhuma dívida.' },
      ok: { en: 'Manageable debt.', pt: 'Dívida administrável.' },
      weak: { en: 'Debt is heavy relative to profit.', pt: 'Dívida alta em relação ao lucro.' },
    }[grade]);
  }

  // Compliance.
  {
    const s = a.tax_status as string;
    const grade: Grade = s === 'good' ? 'good' : s === 'plan' ? 'ok' : 'weak';
    add('tax', 'foreign', { en: 'Tax standing', pt: 'Situação fiscal' }, { good: 'Current', plan: 'Payment plan', issues: 'Overdue' }[s] ?? s, grade, {
      good: { en: 'Clearance certificates should be easy to obtain.', pt: 'As certidões devem sair sem dificuldade.' },
      ok: { en: 'Acceptable while the plan is kept current.', pt: 'Aceitável enquanto o parcelamento estiver em dia.' },
      weak: { en: 'Regularize before filing.', pt: 'Regularizar antes do protocolo.' },
    }[grade]);
  }

  // Funding readiness.
  if (plan === 'acquire') {
    const price = num(a, 'us_price');
    const cover = price > 0 ? invest / price : 0;
    const grade: Grade =
      cover >= PARAMS.acquisitionFundsGoodPct ? 'good' : cover >= PARAMS.acquisitionFundsOkPct ? 'ok' : 'weak';
    add('funding', 'foreign', { en: 'Funding vs price', pt: 'Recursos vs preço' }, pct(cover), grade, {
      good: { en: 'Funds cover the asking price.', pt: 'Os recursos cobrem o preço pedido.' },
      ok: { en: 'Workable with seller financing. SBA loans are not available to L-1 buyers.', pt: 'Viável com financiamento do vendedor. Empréstimos SBA não estão disponíveis para compradores L-1.' },
      weak: { en: 'Funds are well short of the asking price.', pt: 'Os recursos ficam bem abaixo do preço pedido.' },
    }[grade]);
  } else {
    const grade: Grade =
      invest >= PARAMS.newOfficeFundsGoodUsd ? 'good' : invest >= PARAMS.newOfficeFundsOkUsd ? 'ok' : 'weak';
    add('funding', 'foreign', { en: 'Funds for the U.S.', pt: 'Recursos para os EUA' }, usd(invest), grade, {
      good: { en: 'Enough to open, staff and run a U.S. operation.', pt: 'Suficiente para abrir, contratar e operar nos EUA.' },
      ok: { en: 'Lean. The business plan must show how it supports staff.', pt: 'Enxuto. O plano de negócios precisa mostrar como sustenta a equipe.' },
      weak: { en: 'Likely too little to support a credible U.S. operation.', pt: 'Provavelmente insuficiente para uma operação crível nos EUA.' },
    }[grade]);
  }

  if (plan === 'acquire' || plan === 'existing') {
    const rev = num(a, 'us_rev');
    const prior = num(a, 'us_rev_prior');
    const earnings = num(a, 'us_earnings');
    const staff = num(a, 'us_employees');
    const years = num(a, 'us_years');
    const lease = num(a, 'us_lease_years');

    {
      const yoy = prior > 0 ? rev / prior - 1 : rev > 0 ? 1 : 0;
      const grade: Grade = yoy >= 0 ? 'good' : yoy >= -0.1 ? 'ok' : 'weak';
      add('us_trend', 'us', { en: 'Revenue trend', pt: 'Tendência de faturamento' }, pct(yoy, true), grade, {
        good: { en: 'Stable or growing.', pt: 'Estável ou crescendo.' },
        ok: { en: 'Slight decline.', pt: 'Leve queda.' },
        weak: { en: 'Declining more than 10%.', pt: 'Queda superior a 10%.' },
      }[grade]);
    }
    if (plan === 'acquire') {
      const price = num(a, 'us_price');
      const mult = earnings > 0 ? price / earnings : Infinity;
      const grade: Grade = mult <= PARAMS.priceMultipleGood ? 'good' : mult <= PARAMS.priceMultipleOk ? 'ok' : 'weak';
      add('us_multiple', 'us', { en: 'Price ÷ earnings', pt: 'Preço ÷ lucro' }, Number.isFinite(mult) ? `${mult.toFixed(1)}×` : 'n/a', grade, {
        good: { en: 'Within the usual range for small businesses.', pt: 'Dentro da faixa usual para pequenos negócios.' },
        ok: { en: 'On the high side. Needs a reason.', pt: 'No limite superior. Precisa de justificativa.' },
        weak: { en: 'Priced above what earnings support.', pt: 'Preço acima do que o lucro sustenta.' },
      }[grade]);
    }
    {
      const residual = earnings - PARAMS.managerSalaryUsd;
      const grade: Grade =
        earnings > 0 && residual >= PARAMS.residualMinPctOfEarnings * earnings ? 'good' : residual >= 0 ? 'ok' : 'weak';
      add('us_salary', 'us', { en: 'After manager salary', pt: 'Após salário do gerente' }, usd(residual), grade, {
        good: { en: 'Earnings pay a manager and leave a margin.', pt: 'O lucro paga um gerente e deixa margem.' },
        ok: { en: 'Earnings barely cover a manager salary.', pt: 'O lucro mal cobre o salário de um gerente.' },
        weak: { en: 'Earnings cannot pay a manager salary.', pt: 'O lucro não paga o salário de um gerente.' },
      }[grade]);
    }
    {
      const grade: Grade = staff >= 6 ? 'good' : staff >= 3 ? 'ok' : 'weak';
      add('us_staff', 'us', { en: 'Team structure', pt: 'Estrutura de equipe' }, `${staff} W-2`, grade, {
        good: { en: 'Enough staff for a managerial role.', pt: 'Equipe suficiente para um cargo gerencial.' },
        ok: { en: 'Small team. A supervisor hire may be needed.', pt: 'Equipe pequena. Pode ser preciso contratar um supervisor.' },
        weak: { en: 'Too few employees to manage: the owner is the business.', pt: 'Poucos funcionários para gerenciar: o dono é o negócio.' },
      }[grade]);
    }
    {
      const grade: Grade = years >= 3 ? 'good' : years >= 1 ? 'ok' : 'weak';
      add('us_history', 'us', { en: 'Operating history', pt: 'Histórico operacional' }, `${years} yr`, grade, {
        good: { en: 'Established operating history.', pt: 'Histórico operacional consolidado.' },
        ok: { en: 'Past the one-year new-office threshold.', pt: 'Acima do limite de um ano de new office.' },
        weak: { en: 'Under one year: new-office rules would apply.', pt: 'Menos de um ano: aplicam-se regras de new office.' },
      }[grade]);
    }
    {
      const commercial = a.us_premises === 'commercial';
      const grade: Grade = !commercial ? 'weak' : lease >= 3 ? 'good' : 'ok';
      add('us_premises', 'us', { en: 'Premises', pt: 'Instalações' }, commercial ? `${lease} yr lease` : 'Home/virtual', grade, {
        good: { en: 'Commercial premises covering the initial L-1 period.', pt: 'Ponto comercial cobrindo o período inicial do L-1.' },
        ok: { en: 'Negotiate a lease extension as a closing condition.', pt: 'Negociar extensão do aluguel como condição de fechamento.' },
        weak: { en: 'L-1 needs real commercial premises.', pt: 'O L-1 exige ponto comercial real.' },
      }[grade]);
    }
  }

  const points = m.reduce((s, x) => s + (x.grade === 'good' ? 2 : x.grade === 'ok' ? 1 : 0), 0);
  const ratio = points / (m.length * 2);
  const weak = m.filter((x) => x.grade === 'weak').length;
  const rating: Stage2Result['rating'] =
    weak === 0 && ratio >= PARAMS.healthyMinPct
      ? 'healthy'
      : weak <= PARAMS.watchMaxWeak && ratio >= PARAMS.watchMinPct
        ? 'watch'
        : 'weak';
  return { rating, passed: rating !== 'weak', score: Math.round(ratio * 100), metrics: m };
}
