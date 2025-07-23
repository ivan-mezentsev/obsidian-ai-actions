import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        node: true,
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        CustomEvent: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        RequestInfo: 'readonly',
        URL: 'readonly',
        RequestInit: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        TextDecoder: 'readonly',
        setInterval: 'readonly',
        HTMLSpanElement: 'readonly',
        NodeJS: 'readonly',
        clearTimeout: 'readonly',
        ResponseInit: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs['eslint-recommended'].rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-empty-function': 'off'
    }
  },
  // Prettier integration - must be last to override conflicting rules
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules/',
      'main.js',
      'references/',
      'version-bump.mjs',
      '**/*.test.ts',
      '**/jest.*',
      '__mocks__/'
    ]
  }
];