/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#EEF0F3",
        surface: "#FFFFFF",
        "surface-raised": "#F7F8FA",
        "border-subtle": "#EEF0F3",
        trace: {
          hr: "#8B5CF6",     // violet — Heart Rate
          spo2: "#0EA5E9",   // sky — SpO2
          bp: "#F43F5E",     // rose — Blood Pressure
          temp: "#FB923C",   // orange — Temperature
          resp: "#8B5CF6",   // violet — Respiration
        },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'Plus Jakarta Sans'", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      extend: {
  // ...keep everything already there (colors, fontFamily, etc.)...
  keyframes: {
    'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
    'pulse-glow': { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.6', transform: 'scale(1.15)' } },
    'float': { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
    'count-pulse': { '0%': { transform: 'scale(1)' }, '30%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
  },
  animation: {
    'fade-in-up': 'fade-in-up 0.6s ease-out both',
    'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
    'float': 'float 6s ease-in-out infinite',
    'count-pulse': 'count-pulse 0.4s ease-out',
  },
},
    },
  },
  plugins: [],
};
