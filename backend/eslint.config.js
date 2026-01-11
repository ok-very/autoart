import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        node: true,
        es2022: true,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'import/no-cycle': ['error', { maxDepth: 2, ignoreExternal: true }],
      'import/order': [
        'error',
        {
          groups: [
            ['builtin', 'external'],
            ['internal'],
            ['parent', 'sibling', 'index'],
          ],
          pathGroups: [
            {
              pattern: '@autoart/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/modules/*',
              from: './src/modules/*',
              except: ['./index.ts', './types.ts'],
              message: 'Modules should not import directly from other modules. Import from @/modules/[module-name] barrel export instead.',
            },
            {
              target: './src/modules',
              from: './src/db/migrations',
              message: 'Modules should not import migrations. Migrations are DB-only.',
            },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../../*', '../../../../*'],
              message: 'Avoid deep relative imports. Use path aliases: @/, @modules/, @utils/, @config/',
            },
            {
              group: ['../../shared/*', '../../../shared/*'],
              message: "Import from '@autoart/shared' instead of relative path.",
            },
          ],
        },
      ],
    },
  },
];
