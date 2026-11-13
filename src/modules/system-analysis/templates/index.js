// Modelos de projeto da Análise de Sistemas: conteúdo pronto (análise, requisitos, casos de uso como
// histórias e diagramas) que o usuário aplica a um projeto novo para não recomeçar do zero.
import ersAuthProfile from './ersCadastroAutenticacaoPerfil.js';

export const TEMPLATES = Object.freeze({ [ersAuthProfile.key]: ersAuthProfile });
export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

// Resumo para a escolha do modelo (sem o conteúdo)
export const templateSummary = (t) => ({
  key: t.key,
  name: t.name,
  description: t.description,
  counts: {
    requirements: t.requirements.length,
    userStories: t.userStories.length,
    diagrams: t.diagrams.length,
  },
});
