/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        chicago: {
          blue: "#0051A5",
          red: "#CE1126",
          lightBlue: "#6CACE4",
        },
      },
    },
  },
  plugins: [],
};
