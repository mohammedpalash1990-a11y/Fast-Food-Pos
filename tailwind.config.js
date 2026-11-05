export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: '#0d1116',
        panel: '#101418',
        brand: {
          50: '#fff7db',
          100: '#fdf0b0',
          200: '#f7d86f',
          300: '#f1c64c',
          400: '#efb62d',
          500: '#f5b700',
          600: '#d89d00',
          700: '#b77d00',
          800: '#8a5a00',
          900: '#573700'
        }
      },
      boxShadow: {
        soft: '0 20px 40px rgba(0,0,0,0.22)'
      }
    }
  },
  plugins: []
};
