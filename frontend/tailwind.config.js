/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "맑은 고딕",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
