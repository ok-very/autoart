/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Include @autoart/ui package to ensure its Tailwind classes aren't purged
    "../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Custom colors for record types
        'record-project': {
          bg: '#eff6ff',
          text: '#1e40af',
          border: '#dbeafe',
        },
        'record-subprocess': {
          bg: '#fff7ed',
          text: '#c2410c',
          border: '#ffedd5',
        },
      },
    },
  },
  plugins: [],
}
