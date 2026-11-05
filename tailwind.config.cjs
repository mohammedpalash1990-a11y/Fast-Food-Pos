module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff8d9',
          100: '#fef0a8',
          200: '#f7d870',
          300: '#f0c443',
          400: '#efb63f',
          500: '#f5b700',
          600: '#d99a00',
          700: '#b57700',
          800: '#8d5a00',
          900: '#5e3b00'
        },
        panel: '#101418',
        shell: '#0d1116',
        gold: '#f5c453',
        soft: '#f8f3ea'
      },
      boxShadow: {
        soft: '0 20px 40px rgba(0,0,0,0.18)',
        glow: '0 0 0 1px rgba(245,196,83,0.35), 0 10px 30px rgba(245,196,83,0.2)'
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at top left, rgba(245,196,83,0.16), transparent 25%), radial-gradient(circle at bottom right, rgba(245,196,83,0.12), transparent 25%)'
      }
    }
  },
  plugins: []
};
