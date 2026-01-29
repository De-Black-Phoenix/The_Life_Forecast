/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#593c1e"
      },
      fontFamily: {
        heading: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        body: ["Montserrat", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
