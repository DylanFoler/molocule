import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/(dashboard)/**/*.{js,ts,jsx,tsx,mdx}',
    './app/page.tsx',
    './app/layout.tsx',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Vaporwave palette */
        vapor: {
          purple: '#a855f7',
          'purple-light': '#c084fc',
          'purple-dark': '#7e22ce',
          pink: '#ec4899',
          'pink-light': '#f472b6',
          'pink-dark': '#be185d',
          cyan: '#22d3ee',
          'cyan-light': '#67e8f9',
          'cyan-dark': '#0891b2',
          indigo: '#6366f1',
          neon: '#e879f9',
        },
        /* Signal type colors (neon-tuned) */
        signal: {
          funding: '#4ade80',    /* neon green */
          hire: '#a855f7',       /* vapor purple */
          layoff: '#f87171',     /* neon red */
          launch: '#fbbf24',     /* neon amber */
          general: '#22d3ee',    /* vapor cyan */
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-vapor': 'linear-gradient(135deg, #a855f7, #ec4899, #22d3ee)',
        'gradient-vapor-h': 'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)',
        'gradient-vapor-text': 'linear-gradient(90deg, #c084fc, #f472b6, #22d3ee)',
        'gradient-dark-card': 'linear-gradient(135deg, rgba(168,85,247,0.05), rgba(236,72,153,0.03), rgba(34,211,238,0.04))',
        'grid-vapor': `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' width='48' height='48' fill='none' stroke='rgba(168,85,247,0.06)'%3e%3cpath d='M0 .5H47.5V48'/%3e%3c/svg%3e")`,
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      boxShadow: {
        'glow-purple': '0 0 12px rgba(168,85,247,0.4), 0 0 40px rgba(168,85,247,0.15)',
        'glow-pink': '0 0 12px rgba(236,72,153,0.4), 0 0 40px rgba(236,72,153,0.15)',
        'glow-cyan': '0 0 12px rgba(34,211,238,0.4), 0 0 40px rgba(34,211,238,0.15)',
        'glow-vapor': '0 0 20px rgba(168,85,247,0.2), 0 0 60px rgba(236,72,153,0.08), 0 0 120px rgba(34,211,238,0.05)',
        'card-vapor': '0 1px 0 0 rgba(168,85,247,0.1) inset, 0 0 0 1px rgba(255,255,255,0.03) inset, 0 4px 32px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}

export default config
