import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'public/**', 'node_modules/**', 'data/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // O proprio TypeScript ja resolve identificadores; a regra do ESLint
      // so produziria falso positivo com globais de browser e de Node.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Os provedores decodificam JSON de APIs de terceiros que mudam sem aviso.
    // Ali "any" é a descrição honesta do que chega pelo fio; a tipagem real
    // acontece na fronteira, quando o payload vira Offer.
    files: ['src/providers/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  {
    files: ['web/src/**/*.tsx', 'web/src/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
