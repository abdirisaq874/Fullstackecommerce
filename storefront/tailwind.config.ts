import type { Config } from 'tailwindcss';

/**
 * Bold & vibrant design system.
 * Saturated brand (violet) + hot accent (rose) + sale highlight (amber),
 * near-black ink, big radii, energetic shadows. Tokens are CSS variables
 * (see globals.css) so themes can be swapped without touching components.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', lg: '2rem' },
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          fg: 'hsl(var(--brand-fg))',
          50: 'hsl(var(--brand-50))',
          100: 'hsl(var(--brand-100))',
          600: 'hsl(var(--brand))',
          700: 'hsl(var(--brand-700))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          fg: 'hsl(var(--accent-fg))',
        },
        sale: {
          DEFAULT: 'hsl(var(--sale))',
          fg: 'hsl(var(--sale-fg))',
        },
        ink: 'hsl(var(--ink))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          fg: 'hsl(var(--muted-fg))',
        },
        surface: 'hsl(var(--surface))',
        line: 'hsl(var(--line))',
        success: 'hsl(var(--success))',
        danger: 'hsl(var(--danger))',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        pop: '0 10px 30px -8px hsl(var(--brand) / 0.35)',
        card: '0 2px 14px -6px rgba(15, 23, 42, 0.18)',
        lift: '0 18px 40px -12px rgba(15, 23, 42, 0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        marquee: 'marquee 22s linear infinite',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
