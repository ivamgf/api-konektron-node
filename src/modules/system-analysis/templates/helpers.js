// Utilitários para escrever os modelos de projeto (ERS) de forma compacta.

export const lines = (...l) => l.join('\n');

const pad = (n) => String(n).padStart(2, '0');
const PRIORITY = { E: 'must', I: 'should', D: 'could' };

/** Requisito funcional. `extra` entra na descrição técnica (ex.: "Modo: On/Off"). */
export const rf = (n, title, description, p, ucs, extra) => ({
  code: `RF${pad(n)}`,
  title,
  description,
  type: 'functional',
  priority: PRIORITY[p],
  technicalDescription: [`Casos de uso: ${ucs}`, extra].filter(Boolean).join(' · '),
});

export const rnf = (n, subType, title, description) => ({
  code: `RNF${pad(n)}`,
  title,
  description,
  type: 'non_functional',
  subType,
  priority: 'must',
});

export const rd = (n, title, description, related) => ({
  code: `RD${pad(n)}`,
  title,
  description,
  type: 'domain',
  subType: title,
  priority: 'must',
  technicalDescription: `Requisitos relacionados: ${related}`,
});

/** Caso de uso como história de usuário, ligado ao requisito principal pelo código. */
export const uc = ({ code, title, asA, iWant, soThat, requirement, priority = 'must', spec }) => ({
  code, title, asA, iWant, soThat, requirementCode: requirement, priority, acceptanceCriteria: lines(...spec),
});

/** Seção "Aprovação" comum às ERS. */
export const APPROVAL = [
  'Aprovação',
  'As partes abaixo declaram ter revisado e aprovado o conteúdo desta especificação:',
  '• [Nome] – Patrocinador / Cliente – [dd/mm/aaaa]',
  '• [Nome] – Product Owner – [dd/mm/aaaa]',
  '• [Nome] – Engenheiro(a) de Requisitos – [dd/mm/aaaa]',
  '• [Nome] – Arquiteto(a) de Software – [dd/mm/aaaa]',
  '• [Nome] – Responsável por Qualidade – [dd/mm/aaaa]',
];

export const PRIORITY_NOTE = [
  'Prioridades dos requisitos',
  'Essencial (indispensável para a primeira versão) = Must; Importante (deve existir, mas admite solução provisória) = Should; Desejável (pode ficar para versão posterior) = Could.',
];
