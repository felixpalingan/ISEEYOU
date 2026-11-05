import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vsc: {
          canvas: 'var(--vsc-canvas)',
          sidebar: 'var(--vsc-sidebar)',
          activityBar: 'var(--vsc-activity-bar)',
          panel: 'var(--vsc-panel-bg)',
          dropdown: 'var(--vsc-dropdown-bg)',
          card: 'var(--vsc-card-bg)',
          border: 'var(--vsc-border)',
          borderFocus: 'var(--vsc-border-focus)',
          borderSubtle: 'var(--vsc-border-subtle)',
          text: 'var(--vsc-text-primary)',
          muted: 'var(--vsc-text-secondary)',
          bright: 'var(--vsc-text-bright)',
          blue: 'var(--vsc-accent-blue)',
          blueHover: 'var(--vsc-accent-hover)',
          critical: 'var(--vsc-severity-critical)',
          warning: 'var(--vsc-severity-warning)',
          info: 'var(--vsc-severity-info)',
          success: 'var(--vsc-severity-success)',
          keyword: 'var(--vsc-syntax-keyword)',
          string: 'var(--vsc-syntax-string)',
          number: 'var(--vsc-syntax-number)',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
