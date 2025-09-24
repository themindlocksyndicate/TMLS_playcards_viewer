/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./room.html", "./src/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 40px rgba(217,180,99,0.25)",
      },
    },
  },
  plugins: [],
};
