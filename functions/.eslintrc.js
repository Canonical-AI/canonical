module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-essential', // Use 'plugin:vue/vue3-recommended' for stricter rules
  ],
  parserOptions: {
    parser: 'babel-eslint', // Use '@babel/eslint-parser' if using Babel
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'vue/multi-word-component-names': 'off',
  },
};
