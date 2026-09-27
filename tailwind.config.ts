import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        term: { bg: '#0a0d12', panel: '#11151b', raised: '#161b23', line: '#232a35', line2: '#2e3642' },
        txt: { DEFAULT: '#e6e9ee', soft: '#a7b0bd', mute: '#6f7a89' },
        amber: { DEFAULT: '#f5a524', soft: '#f5a52422', ink: '#1a1203' },
        up: '#2fbf71', down: '#f0555a', warn: '#e8b339',
        s1: '#3987e5', s2: '#d95926', s3: '#199e70',
      },
      fontFamily: { sans: ['"Inter Tight Variable"', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
export default config;
