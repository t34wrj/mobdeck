module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'eslint-config-prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    'react-native/react-native': true,
    es6: true,
    node: true,
    jest: true,
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
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
    'camelcase': ['error', { 
      properties: 'always',
      ignoreDestructuring: false,
      ignoreImports: false,
      ignoreGlobals: false,
      // Allow database schema and API fields that require snake_case
      allow: [
        // Database schema fields (SQLite conventions)
        'image_url', 'read_time', 'source_url',
        'is_archived', 'is_favorite', 'is_read', 'is_modified',
        'created_at', 'updated_at', 'synced_at', 'deleted_at',
        'entity_type', 'entity_id', 'local_timestamp', 'server_timestamp',
        'sync_status', 'conflict_resolution', 'retry_count', 'error_message',
        'article_id', 'label_id',
        // Readeck API fields (external API requirements)
        'read_progress', 'read_status', 'is_marked',
        'per_page', 'sort_by', 'sort_order', 'include_empty',
        'updated_since', 'last_updated', 'total_count', 'has_more',
        'transfer_to', 'label_ids', 'article_ids', 'include_deleted'
      ]
    }],
    
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
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-shadow': 'off',
        'no-undef': 'off',
      },
    },
    {
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
};