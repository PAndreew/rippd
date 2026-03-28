import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/shared/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#08111f',
        panel: '#102039',
        accent: '#6ee7b7',
        warning: '#fbbf24'
      }
    }
  },
  plugins: []
};

export default config;
