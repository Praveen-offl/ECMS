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
    },
  },
  plugins: [],
};
