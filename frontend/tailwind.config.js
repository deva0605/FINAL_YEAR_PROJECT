/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---- existing palette, unchanged (still used by older components) ----
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        gain: {
          DEFAULT: '#059669',
          light: '#ecfdf5',
          dark: '#065f46',
        },
        loss: {
          DEFAULT: '#dc2626',
          light: '#fef2f2',
          dark: '#991b1b',
        },
        surface: {
          bg: '#f8fafc',
          card: '#ffffff',
          subtle: '#f1f5f9',
          border: '#e2e8f0',
        },

        // ---- semantic tokens: the same colours, named by role ----
        // navy  = slate-900 (primary text, primary actions)
        // teal  = the existing "gain" green (selected / positive / primary accent)
        // amber = the existing "brand" orange (caution, risk, HOLD)
        ink: {
          DEFAULT: '#0f172a', // primary text, navigation, primary buttons
          soft: '#334155', // body text
          muted: '#64748b', // secondary labels, metadata (4.7:1 on white)
          faint: '#94a3b8', // decorative only: never for text that must be read
        },
        canvas: '#f8fafc', // page background (same as surface-bg)
        line: {
          DEFAULT: '#e2e8f0', // hairline borders and dividers
          strong: '#cbd5e1', // hover / emphasised borders
        },
        accent: {
          DEFAULT: '#059669',
          soft: '#ecfdf5',
          line: '#a7f3d0',
          ink: '#065f46',
        },
        caution: {
          DEFAULT: '#d97706',
          soft: '#fffbeb',
          line: '#fde68a',
          ink: '#92400e',
        },
        danger: {
          DEFAULT: '#dc2626',
          soft: '#fef2f2',
          line: '#fecaca',
          ink: '#991b1b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04)',
        pop: '0 8px 24px rgba(15, 23, 42, 0.08)',
      },
      keyframes: {
        'subtle-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'subtle-pulse': 'subtle-pulse 1.8s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}
