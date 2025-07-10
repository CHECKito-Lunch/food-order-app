module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './components/**/**/*.{js,ts,jsx,tsx}', // <- alle Unterordner, egal wie tief!
    './styles/**/*.{css,scss}',              // (optional)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
