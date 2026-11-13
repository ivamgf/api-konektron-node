// Modelos de projeto da Análise de Sistemas: conteúdo pronto (análise, requisitos, casos de uso como
// histórias e diagramas) que o usuário aplica a um projeto novo para não recomeçar do zero.
import ersAuthProfile from './ersCadastroAutenticacaoPerfil.js';
import ersDesktopLocalOffline from './ersDesktopLocalOffline.js';
import { ersDesktopOfflineOnline, ersMobileOfflineOnline } from './ersOfflineOnline.js';

// A ordem aqui é a ordem de exibição na escolha do modelo (web, mobile, desktop online, desktop offline)
const ALL = [ersAuthProfile, ersMobileOfflineOnline, ersDesktopOfflineOnline, ersDesktopLocalOffline];

export const TEMPLATES = Object.freeze(Object.fromEntries(ALL.map((t) => [t.key, t])));
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
