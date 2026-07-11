import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sharedGlobals = {
  ...globals.node,
  ...globals.jest,
};

export default [
  {
    ignores: ['dist/**', 'logs/**'],
  },
  {
    ...js.configs.recommended,
    languageOptions: {
      ...(js.configs.recommended.languageOptions ?? {}),
      globals: {
        ...sharedGlobals,
        ...(js.configs.recommended.languageOptions?.globals ?? {}),
      },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    languageOptions: {
      ...(config.languageOptions ?? {}),
      globals: {
        ...sharedGlobals,
        ...(config.languageOptions?.globals ?? {}),
      },
    },
  })),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      globals: sharedGlobals,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
