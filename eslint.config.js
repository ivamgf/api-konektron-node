import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
  {
    // script da página de documentação: roda no navegador, não no Node
    files: ['src/docs/public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, SwaggerUIBundle: 'readonly' },
    },
  },
  { ignores: ['node_modules/', 'coverage/'] },
];
