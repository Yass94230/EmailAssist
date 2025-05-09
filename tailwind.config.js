/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'whatsapp': {
          light: '#DCF8C6',
          DEFAULT: '#25D366',
          dark: '#128C7E',
        }
      }
    },
  },
  plugins: [],
};