import type { L } from './process';

/**
 * Agreement templates signed inside the platform. Versioned: the signed record
 * stores the version and a SHA-256 of the exact text shown to the signer.
 * These are templates and should be reviewed by counsel before production use.
 */

export const NDA_VERSION = 'nda-2026-11-v1';
export const CONSENT_VERSION = 'bgc-2026-11-v1';

export function ndaText(entity: string): L {
  return {
    en: `MUTUAL CONFIDENTIALITY AGREEMENT

Between ${entity} ("${entity}") and the person signing below ("Applicant"), together the "Parties".

1. Purpose. The Parties will exchange information so that ${entity} can assess the feasibility of an L-1 visa strategy for the Applicant and the businesses involved (the "Purpose").

2. Confidential Information. Everything one Party discloses to the other for the Purpose that is not public, including personal data, corporate records, financial statements, tax returns, bank statements and information about any business for sale.

3. Obligations. Each Party will (a) use Confidential Information only for the Purpose; (b) keep it secret and protect it with reasonable care; (c) share it only with its employees, immigration counsel, accountants and service providers who need it for the Purpose and are bound by confidentiality duties at least as strict as these.

4. Exclusions. Information that is or becomes public through no breach, was already lawfully known, is independently developed, or must be disclosed by law (with notice to the other Party where permitted).

5. Businesses for sale. The Applicant will not contact owners, employees, customers or suppliers of any business introduced by ${entity} without ${entity}'s written consent, and will not disclose that a business is for sale.

6. Personal data. ${entity} processes personal data only for the Purpose, applying appropriate safeguards, and on request will delete or return it, subject to legal retention duties.

7. Automated analysis. The Applicant agrees that ${entity} may use automated tools, including AI, to read and summarize documents. A person reviews every assessment before it is relied on.

8. No legal advice. Assessments from ${entity} are screening opinions, not legal advice. Only licensed immigration counsel can advise on visa eligibility.

9. Term. Duties under this agreement last three years from signature; for trade secrets and personal data, for as long as the law protects them.

10. Return. On request, each Party will return or destroy the other's Confidential Information.

11. General. This is the whole agreement on its subject. Electronic signatures are valid and binding.`,
    pt: `ACORDO MÚTUO DE CONFIDENCIALIDADE

Entre ${entity} ("${entity}") e a pessoa que assina abaixo ("Candidato"), em conjunto as "Partes".

1. Finalidade. As Partes trocarão informações para que a ${entity} avalie a viabilidade de uma estratégia de visto L-1 para o Candidato e os negócios envolvidos (a "Finalidade").

2. Informações Confidenciais. Tudo o que uma Parte revelar à outra para a Finalidade e que não seja público, incluindo dados pessoais, documentos societários, demonstrações financeiras, declarações de imposto, extratos bancários e informações sobre qualquer negócio à venda.

3. Obrigações. Cada Parte (a) usará as Informações Confidenciais apenas para a Finalidade; (b) as manterá em sigilo e as protegerá com cuidado razoável; (c) só as compartilhará com seus funcionários, advogados de imigração, contadores e prestadores de serviço que precisem delas para a Finalidade e estejam sujeitos a deveres de sigilo no mínimo equivalentes.

4. Exclusões. Informações que sejam ou se tornem públicas sem violação, que já fossem legitimamente conhecidas, que sejam desenvolvidas de forma independente ou cuja divulgação seja exigida por lei (com aviso à outra Parte, quando permitido).

5. Negócios à venda. O Candidato não contatará proprietários, funcionários, clientes ou fornecedores de qualquer negócio apresentado pela ${entity} sem o consentimento por escrito da ${entity}, nem revelará que um negócio está à venda.

6. Dados pessoais. A ${entity} trata dados pessoais apenas para a Finalidade, com as salvaguardas adequadas, e mediante solicitação os eliminará ou devolverá, respeitados os prazos legais de guarda.

7. Análise automatizada. O Candidato concorda que a ${entity} use ferramentas automatizadas, inclusive IA, para ler e resumir documentos. Uma pessoa revisa toda avaliação antes que ela seja utilizada.

8. Sem aconselhamento jurídico. As avaliações da ${entity} são opiniões de triagem, não aconselhamento jurídico. Somente um advogado de imigração habilitado pode orientar sobre elegibilidade a vistos.

9. Prazo. As obrigações deste acordo duram três anos a contar da assinatura; para segredos comerciais e dados pessoais, enquanto a lei os proteger.

10. Devolução. Mediante solicitação, cada Parte devolverá ou destruirá as Informações Confidenciais da outra.

11. Geral. Este é o acordo integral sobre o tema. Assinaturas eletrônicas são válidas e vinculantes.`,
  };
}

export function consentText(entity: string): L {
  return {
    en: `BACKGROUND CHECK AUTHORIZATION

I authorize ${entity} and its verification providers to verify my identity and to obtain background information about me and the companies I own or manage, including public records, court and lien records, sanctions and watchlists, corporate registries and tax-standing certificates, for the sole purpose of assessing L-1 visa feasibility.

I confirm the information I provided is true and complete. I may withdraw this authorization in writing at any time; checks already completed remain part of my file.`,
    pt: `AUTORIZAÇÃO PARA VERIFICAÇÃO DE ANTECEDENTES

Autorizo a ${entity} e seus prestadores de verificação a confirmar minha identidade e a obter informações de antecedentes sobre mim e sobre as empresas que possuo ou administro, incluindo registros públicos, processos judiciais e ônus, listas de sanções e restrições, juntas comerciais e certidões fiscais, exclusivamente para avaliar a viabilidade do visto L-1.

Confirmo que as informações que forneci são verdadeiras e completas. Posso revogar esta autorização por escrito a qualquer momento; verificações já concluídas permanecem no meu dossiê.`,
  };
}
