/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans Devanagari"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Core Dual-Mode Theme Tokens
        theme: {
          darkBg: '#0B1220',
          darkSurface: '#111C2E',
          darkElevated: '#162238',
          darkInput: '#0D1524',
          darkBorder: '#1E293B',
          darkBorderSubtle: '#24344D',
          darkText: '#F1F5F9',
          darkTextMuted: '#94A3B8',

          lightBg: '#F5F7FB',
          lightSurface: '#FFFFFF',
          lightElevated: '#F8FAFC',
          lightInput: '#FFFFFF',
          lightBorder: '#E2E8F0',
          lightText: '#172033',
          lightTextMuted: '#64748B',

          accentBlue: '#3B82F6',
          accentBlueHover: '#2563EB',
          accentCyan: '#06B6D4',
          govBlue: '#174EA6',
          govBlueHover: '#123B80',
        },
        civic: {
          bg: '#F5F7FB',
          card: '#FFFFFF',
          primary: '#174EA6',
          primaryHover: '#123B80',
          primaryLight: '#EFF6FF',
          accent: '#3B82F6',
          cyan: '#06B6D4',
          textMain: '#172033',
          textSecondary: '#64748B',
          border: '#E2E8F0',
          success: '#16856B',
          pending: '#D97706',
          error: '#DC2626',
        },
        police: {
          50: '#f0f4f9',
          100: '#d9e2ee',
          200: '#b4c7dc',
          300: '#85a4c5',
          400: '#5b82ad',
          500: '#3f6694',
          600: '#174EA6',
          700: '#123B80',
          800: '#1d2f48',
          900: '#172033',
          950: '#070b13',
        },
        safety: {
          orange: '#D97706',
          yellow: '#F59E0B',
          red: '#EF4444',
          green: '#10B981',
        },
      },
      boxShadow: {
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-light': '0 8px 30px 0 rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}
