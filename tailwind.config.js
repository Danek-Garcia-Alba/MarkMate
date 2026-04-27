/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 16px 45px -30px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};
