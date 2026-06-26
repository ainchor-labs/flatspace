/**
 * Tailwind config for the web host. Extends the shared preset so the design
 * language is identical across the suite, and scans every workspace package that
 * renders UI so their classes are included in the build.
 */

const preset = require("@flatspace/shared/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../shared/src/**/*.{ts,tsx}",
    "../flatfile/client/**/*.{ts,tsx}",
    "../flatdeck/client/**/*.{ts,tsx}",
    "../flatdrive/client/**/*.{ts,tsx}",
    "../flatthoughts/client/**/*.{ts,tsx}",
  ],
};
