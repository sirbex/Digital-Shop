module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'off',
    // Allow @ts-ignore comments (sometimes needed for third-party libs)
    '@typescript-eslint/ban-ts-comment': 'off',
    // Allow explicit any when needed
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow unused vars prefixed with underscore
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    // Disable exhaustive-deps warnings (common pattern in React)
    'react-hooks/exhaustive-deps': 'warn',
  },
};
