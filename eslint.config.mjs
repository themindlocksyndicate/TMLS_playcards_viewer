import js from '@eslint/js';

export default [
  { files: ['**/*.{js,jsx,mjs,cjs}'],
    ignores: ['dist/**', 'node_modules/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: {},
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  }
];
