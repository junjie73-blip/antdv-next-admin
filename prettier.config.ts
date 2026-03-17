import type { Config } from 'prettier'

const config: Config = {
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  jsxSingleQuote: true,
  bracketSpacing: true,
  plugins: ['prettier-plugin-tailwindcss'],
}
export default config
