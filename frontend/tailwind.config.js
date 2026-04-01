/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#00F6FF", // Astra Nova Neon Cyan
                "primary-dark": "#00B8D4",
                "background-light": "#F2F6F9",
                "background-dark": "#0B1120", // The Cosmic Gallery deep space
                "surface-dark": "#1E293B", // Glassmorphism cards
                "surface-dark-high": "#171F33", // Elevated floating panels
                "surface-light": "#E9EFF4",
                "accent-teal": "#14B8A6",
            },
            fontFamily: {
                display: ["Space Grotesk", "Outfit", "sans-serif"],
                body: ["Inter", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "1rem",
                'xl': "1.5rem",
                '2xl': "2rem",
            },
            boxShadow: {
                'neon': '0 0 10px rgba(0, 246, 255, 0.3), 0 0 20px rgba(0, 246, 255, 0.1)',
                'inner-glow': 'inset 0 0 20px rgba(0, 246, 255, 0.05)',
                'glass-glow': '0 20px 40px rgba(0, 246, 255, 0.05)',
            }
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
    ],
}
