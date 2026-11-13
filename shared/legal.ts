import type { L } from './process';

/**
 * Agreement templates signed inside the platform. Versioned: the signed record
 * stores the version and a SHA-256 of the exact text shown to the signer.
 * These are templates and should be reviewed by counsel before production use.
 */

export const NDA_VERSION = 'nda-2026-11-v2';

export function ndaText(entity: string): L {
  return {
    en: `MUTUAL CONFIDENTIALITY AGREEMENT

Between ${entity} ("${entity}") and the person signing below ("Participant"), together the "Parties".

1. Purpose. The Parties will exchange information so that ${entity} can evaluate a business for L-1 visa compliance and investment soundness, whether it is a U.S. business offered for sale or a company supporting an L-1 candidate (the "Purpose").

2. Confidential Information. Everything one Party discloses to the other for the Purpose that is not public, including personal data, corporate records, financial statements, tax returns, bank statements and information about any business for sale.

3. Obligations. Each Party will (a) use Confidential Information only for the Purpose; (b) keep it secret and protect it with reasonable care; (c) share it only with its employees, immigration counsel, accountants and service providers who need it for the Purpose and are bound by confidentiality duties at least as strict as these.

4. Exclusions. Information that is or becomes public through no breach, was already lawfully known, is independently developed, or must be disclosed by law (with notice to the other Party where permitted).

5. Businesses for sale. ${entity} will not disclose that a business is for sale, or share its documents, with anyone other than candidates it has screened and who are bound by confidentiality. The Participant will not contact owners, employees, customers or suppliers of any business introduced by ${entity} without ${entity}'s written consent, and will not disclose that a business is for sale.

6. Personal data. ${entity} processes personal data only for the Purpose, applying appropriate safeguards, and on request will delete or return it, subject to legal retention duties.

7. Automated analysis. The Participant agrees that ${entity} may use automated tools, including AI, to read and summarize documents. A person reviews every assessment before it is relied on.

8. No legal advice. Assessments from ${entity} are screening opinions, not legal advice. Only licensed immigration counsel can advise on visa eligibility.

9. Term. Duties under this agreement last three years from signature; for trade secrets and personal data, for as long as the law protects them.

10. Return. On request, each Party will return or destroy the other's Confidential Information.

11. General. This is the whole agreement on its subject. Electronic signatures are valid and binding.`,
    pt: `ACORDO MÚTUO DE CONFIDENCIALIDADE

Entre ${entity} ("${entity}") e a pessoa que assina abaixo ("Participante"), em conjunto as "Partes".

1. Finalidade. As Partes trocarão informações para que a ${entity} avalie um negócio quanto à conformidade com o visto L-1 e à solidez do investimento, seja um negócio à venda nos EUA ou uma empresa que sustenta um candidato ao L-1 (a "Finalidade").

2. Informações Confidenciais. Tudo o que uma Parte revelar à outra para a Finalidade e que não seja público, incluindo dados pessoais, documentos societários, demonstrações financeiras, declarações de imposto, extratos bancários e informações sobre qualquer negócio à venda.

3. Obrigações. Cada Parte (a) usará as Informações Confidenciais apenas para a Finalidade; (b) as manterá em sigilo e as protegerá com cuidado razoável; (c) só as compartilhará com seus funcionários, advogados de imigração, contadores e prestadores de serviço que precisem delas para a Finalidade e estejam sujeitos a deveres de sigilo no mínimo equivalentes.

4. Exclusões. Informações que sejam ou se tornem públicas sem violação, que já fossem legitimamente conhecidas, que sejam desenvolvidas de forma independente ou cuja divulgação seja exigida por lei (com aviso à outra Parte, quando permitido).

5. Negócios à venda. A ${entity} não revelará que um negócio está à venda, nem compartilhará seus documentos, a não ser com candidatos que tenha avaliado e que estejam sujeitos a sigilo. O Participante não contatará proprietários, funcionários, clientes ou fornecedores de qualquer negócio apresentado pela ${entity} sem o consentimento por escrito da ${entity}, nem revelará que um negócio está à venda.

6. Dados pessoais. A ${entity} trata dados pessoais apenas para a Finalidade, com as salvaguardas adequadas, e mediante solicitação os eliminará ou devolverá, respeitados os prazos legais de guarda.

7. Análise automatizada. O Participante concorda que a ${entity} use ferramentas automatizadas, inclusive IA, para ler e resumir documentos. Uma pessoa revisa toda avaliação antes que ela seja utilizada.

8. Sem aconselhamento jurídico. As avaliações da ${entity} são opiniões de triagem, não aconselhamento jurídico. Somente um advogado de imigração habilitado pode orientar sobre elegibilidade a vistos.

9. Prazo. As obrigações deste acordo duram três anos a contar da assinatura; para segredos comerciais e dados pessoais, enquanto a lei os proteger.

10. Devolução. Mediante solicitação, cada Parte devolverá ou destruirá as Informações Confidenciais da outra.

11. Geral. Este é o acordo integral sobre o tema. Assinaturas eletrônicas são válidas e vinculantes.`,
  };
}
