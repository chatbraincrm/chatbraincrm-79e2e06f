import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        /* Gradiente principal ChatBrain: azul meia noite → índigo → violeta */
        'chatbrain-gradient': 'linear-gradient(135deg, #0B0F1F, #111B5E, #7C3AED)',
        /* Gradiente de botão: azul tecnológico → violeta */
        'btn-gradient': 'linear-gradient(135deg, #3B82F6, #7C3AED)',
        /* Gradiente ciano */
        'cyan-gradient': 'linear-gradient(135deg, #3B82F6, #00D4FF)',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Tokens de identidade ChatBrain */
        ai: {
          DEFAULT: "hsl(var(--ai))",
          foreground: "hsl(var(--ai-foreground))",
        },
        cyan: {
          DEFAULT: "hsl(var(--cyan))",
          foreground: "hsl(var(--cyan-foreground))",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
          foreground: "hsl(var(--violet-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* Cores fixas da paleta (para uso pontual) */
        brand: {
          midnight: "#0B0F1F",
          indigo: "#111B5E",
          blue: "#3B82F6",
          cyan: "#00D4FF",
          violet: "#7C3AED",
          light: "#F5F7FA",
          muted: "#94A3B8",
          border: "#1E293B",
          card: "#10172A",
          secondary: "#111827",
        },
      },
      borderRadius: {
        lg: "var(--radius)",               /* 20px */
        md: "calc(var(--radius) - 4px)",   /* 16px */
        sm: "calc(var(--radius) - 8px)",   /* 12px */
        xl: "calc(var(--radius) + 4px)",   /* 24px */
        "2xl": "calc(var(--radius) + 8px)", /* 28px */
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
        "glow-violet": "var(--shadow-glow-violet, var(--shadow-glow))",
        "glow-cyan": "var(--shadow-glow-cyan, var(--shadow-glow))",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
