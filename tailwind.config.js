/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0891b2',
        'primary-dark': '#0e7490',
        accent: '#3df5e7',
        background: {
          light: '#dfe8f0',
          dark: '#0b0e15',
        },
        surface: {
          light: '#ffffff',
          dark: '#10131b',
        },
        card: {
          light: '#ffffff',
          dark: '#161a22',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
