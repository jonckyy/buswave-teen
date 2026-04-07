import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aurora Purple background
        bg: {
          deep: '#0B0B2E',
          mid: '#1A0B3D',
          accent: '#4C1D95',
        },
        // Glass surfaces
        surface: 'rgba(255, 255, 255, 0.06)',
        surfaceStrong: 'rgba(255, 255, 255, 0.10)',
        line: 'rgba(255, 255, 255, 0.12)',
        lineStrong: 'rgba(255, 255, 255, 0.20)',
        // Text
        ink: '#F1F5F9',
        ink2: '#CBD5E1',
        ink3: '#94A3B8',
        // Accents
        primary: {
          DEFAULT: '#A78BFA',
          light: '#C4B5FD',
          dark: '#7C3AED',
          deep: '#6D28D9',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          light: '#67E8F9',
          dark: '#06B6D4',
        },
        magenta: {
          DEFAULT: '#EC4899',
          light: '#F472B6',
          dark: '#DB2777',
        },
        orange: {
          DEFAULT: '#FB923C',
          dark: '#F97316',
        },
        lime: {
          DEFAULT: '#84CC16',
          light: '#A3E635',
        },
        rose: {
          DEFAULT: '#F43F5E',
          light: '#FB7185',
        },
        sun: {
          DEFAULT: '#FACC15',
          light: '#FDE047',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
        pill: '9999px',
      },
      backgroundImage: {
        aurora: 'radial-gradient(ellipse at top, #4C1D95 0%, #1A0B3D 50%, #0B0B2E 100%)',
        'aurora-glow':
          'radial-gradient(circle at 30% 20%, rgba(168,139,250,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(34,211,238,0.25), transparent 55%), radial-gradient(circle at 50% 100%, rgba(236,72,153,0.18), transparent 60%)',
        'btn-primary': 'linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #FB923C 100%)',
        'btn-cyan': 'linear-gradient(135deg, #06B6D4 0%, #A78BFA 100%)',
        'btn-lime': 'linear-gradient(135deg, #84CC16 0%, #22D3EE 100%)',
        'btn-rose': 'linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)',
        'glow-border':
          'linear-gradient(135deg, rgba(168,139,250,0.5), rgba(34,211,238,0.3), rgba(236,72,153,0.4))',
        'gradient-text': 'linear-gradient(135deg, #A78BFA, #22D3EE, #EC4899)',
      },
      boxShadow: {
        glow: '0 0 28px rgba(168, 139, 250, 0.4)',
        'glow-sm': '0 0 14px rgba(168, 139, 250, 0.35)',
        'glow-cyan': '0 0 28px rgba(34, 211, 238, 0.4)',
        'glow-magenta': '0 0 28px rgba(236, 72, 153, 0.4)',
        'glow-lime': '0 0 24px rgba(132, 204, 22, 0.4)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(168, 139, 250, 0.4)' },
          '50%': { boxShadow: '0 0 32px rgba(168, 139, 250, 0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'aurora-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'flow-dash': {
          '0%': { strokeDashoffset: '40' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 400ms cubic-bezier(0.2, 0.9, 0.3, 1.1)',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'aurora-shift': 'aurora-shift 16s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
