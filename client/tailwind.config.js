/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f8f7ff',
        night: { 700: '#24124f', 800: '#190b3b', 900: '#100525', 950: '#090218' },
        grape: {
          50: '#f7f3ff', 100: '#eee7ff', 200: '#ddd1ff', 300: '#c7b3ff',
          400: '#a98aff', 500: '#8b5cf6', 600: '#7443e8', 700: '#6032c8',
          800: '#4c269f', 900: '#351873', 950: '#1d0b43',
        },
        brand: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
        },
        accent: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b' },
        success: { 400: '#34d399', 500: '#10b981', 900: '#064e3b' },
        danger: { 400: '#fb7185', 500: '#f43f5e', 900: '#881337' },
        info: { 400: '#38bdf8', 500: '#0ea5e9', 900: '#0c4a6e' },
        canvas: '#ffffff',
      },
      boxShadow: {
        card: '0 18px 50px rgba(3, 0, 20, .3)',
        glass: '0 18px 44px rgba(3, 0, 20, .32)',
        canvas: '0 22px 60px rgba(2, 0, 18, .46)',
        button: '0 8px 22px rgba(76, 29, 149, .32)',
        glow: '0 0 28px rgba(251, 191, 36, .2)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Inter', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        pop: {
          '0%': { transform: 'scale(.94)', opacity: '0' },
          '70%': { transform: 'scale(1.025)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scorePop: {
          '0%': { transform: 'translateY(4px) scale(.8)', opacity: '0' },
          '45%': { transform: 'translateY(-3px) scale(1.08)', opacity: '1' },
          '100%': { transform: 'translateY(-8px) scale(1)', opacity: '0' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        confetti: {
          '0%': { transform: 'translate3d(0,-12px,0) rotate(0deg)', opacity: '0' },
          '15%': { opacity: '1' },
          '100%': { transform: 'translate3d(var(--confetti-x,0),110px,0) rotate(240deg)', opacity: '0' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        pop: 'pop .2s ease-out both',
        'slide-up': 'slideUp .2s ease-out both',
        'score-pop': 'scorePop 1.2s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        confetti: 'confetti 2.4s ease-in-out infinite',
      },
      transitionDuration: { 175: '175ms' },
    },
  },
  plugins: [],
};
