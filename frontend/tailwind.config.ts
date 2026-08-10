import type { Config } from 'tailwindcss';

/**
 * Design system — "Modern Government Dashboard".
 * Primary navy palette, cyan accent, soft glassmorphism cards.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B1F3A',
          light: '#153B6B',
          dark: '#071428',
        },
        accent: {
          DEFAULT: '#00B4D8',
          light: '#48CAE4',
        },
        background: '#F5F7FA',
        success: '#28A745',
        warning: '#FFA500',
        danger: '#DC3545',
        dashboard: {
          blue: '#1964B0',
          green: '#10B981',
          orange: '#F97316',
          purple: '#8B5CF6',
          red: '#EF4444',
          slate: '#475569',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        card: '0 8px 24px rgba(11, 31, 58, 0.08)',
        'card-hover': '0 12px 32px rgba(11, 31, 58, 0.16)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
