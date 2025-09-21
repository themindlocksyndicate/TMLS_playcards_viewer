import js from '@eslint/js';
import globals from 'globals';

export default [
  // Browser code (your app)
  {
    files: ['src/**/*.{js,jsx,mjs,cjs}', 'app.js'],
    ignores: ['dist/**', 'node_modules/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // With browser globals declared, no-undef is redundant here:
      'no-undef': 'off'
    }
  },
  // Node scripts / config
  {
    files: ['tools/**/*.{js,mjs}', '*.config.{js,mjs}', 'vite.config.*', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
