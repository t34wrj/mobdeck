const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        
        // React Native globals
        __DEV__: 'readonly',
        FormData: 'readonly',
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Code Quality Rules - Allow console in development
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Use TypeScript version
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',

      // TypeScript Rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for external API integration
      '@typescript-eslint/no-shadow': ['error'],
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // React Rules
      'react/jsx-uses-react': 'off', // React 17+ doesn't need React in scope
      'react/react-in-jsx-scope': 'off', // React 17+ doesn't need React in scope
      'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/display-name': 'off',

      // React Hooks Rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native Specific
      'react-native/no-unused-styles': 'error',
      'react-native/split-platform-components': 'error',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'off', // Allow color literals in styling
      'react-native/no-raw-text': 'error',

      // Naming Conventions (based on CLAUDE.md)
      camelcase: [
        'error',
        {
          properties: 'always',
          ignoreDestructuring: false,
          ignoreImports: false,
          ignoreGlobals: false,
          // Allow database schema and API fields that require snake_case
          allow: [
            // Database schema fields (SQLite conventions)
            'image_url',
            'read_time',
            'source_url',
            'is_archived',
            'is_favorite',
            'is_read',
            'is_modified',
            'created_at',
            'updated_at',
            'synced_at',
            'deleted_at',
            'entity_type',
            'entity_id',
            'local_timestamp',
            'server_timestamp',
            'sync_status',
            'conflict_resolution',
            'retry_count',
            'error_message',
            'article_id',
            'label_id',
            // Readeck API fields (external API requirements)
            'read_progress',
            'read_status',
            'is_marked',
            'per_page',
            'sort_by',
            'sort_order',
            'include_empty',
            'updated_since',
            'last_updated',
            'total_count',
            'has_more',
            'transfer_to',
            'label_ids',
            'article_ids',
            'include_deleted',
          ],
        },
      ],

      // Code Style
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-duplicate-imports': 'error',
      'consistent-return': 'error',
      'array-callback-return': 'error',

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-shadow': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'build/**',
      'dist/**',
      '.expo/**',
      '.git/**',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
    ],
  },
  // Apply prettier config last to override any conflicting rules
  prettier,
];