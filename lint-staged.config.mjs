export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': ['prettier --write', 'eslint --fix'],
  '*.{ts,tsx}': () => 'tsc --noEmit',
  '*.{json,md,css,yml,yaml,html}': 'prettier --write'
}
