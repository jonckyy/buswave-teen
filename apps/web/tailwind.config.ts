import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Electric Pop palette
        bg: '#FAFAF9',
        surface: '#FFFFFF',
        ink: '#0F172A',
        ink2: '#475569',
        ink3: '#94A3B8',
        primary: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        secondary: {
          DEFAULT: '#06B6D4',
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
        },
        lime: {
          DEFAULT: '#84CC16',
          50: '#F7FEE7',
          100: '#ECFCCB',
          200: '#D9F99D',
          300: '#BEF264',
          400: '#A3E635',
          500: '#84CC16',
          600: '#65A30D',
        },
        coral: {
          DEFAULT: '#FB7185',
          50: '#FFF1F2',
          100: '#FFE4E6',
          400: '#FB7185',
          500: '#F43F5E',
        },
        rose: {
          DEFAULT: '#E11D48',
          500: '#F43F5E',
          600: '#E11D48',
        },
        sun: {
          DEFAULT: '#FACC15',
          400: '#FACC15',
          500: '#EAB308',
        },
        line: '#E2E8F0',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        pill: '9999px',
      },
      boxShadow: {
        pop: '0 6px 0 0 rgba(124, 58, 237, 0.18)',
        'pop-cyan': '0 6px 0 0 rgba(6, 182, 212, 0.20)',
        'pop-lime': '0 6px 0 0 rgba(132, 204, 22, 0.22)',
        card: '0 4px 24px -4px rgba(15, 23, 42, 0.08)',
        'card-lg': '0 12px 32px -8px rgba(15, 23, 42, 0.12)',
      },
      keyframes: {
        'bounce-in': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        'flash-lime': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(132, 204, 22, 0.15)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'bounce-in': 'bounce-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 300ms ease-out',
        wiggle: 'wiggle 400ms ease-in-out',
        'flash-lime': 'flash-lime 600ms ease-out',
        shimmer: 'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
