import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Basiskonfiguration von Next.js + TypeScript
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Hier überschreiben wir einzelne Regeln
  {
    rules: {
      // erlaube überall `any`
      "@typescript-eslint/no-explicit-any": "off",
      // erlaube HTML-Links auch für Next.js-Pages
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
