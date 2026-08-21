/**
 * Vivid Pulse para la app. Los hex NO viven acá: vienen de
 * `shared/tokens.json`, generado desde `shared/src/tokens.ts` (la única
 * fuente). Tras tocar los tokens: `npm run emit-tokens` en la raíz.
 */
const { colors, radius } = require('../shared/tokens.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colors.light.primary,
          container: colors.light.primaryContainer,
          brand: colors.light.brandPrimary,
        },
        secondary: { DEFAULT: colors.light.secondary, brand: colors.light.brandSecondary },
        tertiary: { DEFAULT: colors.light.tertiary, brand: colors.light.brandTertiary },
        background: colors.light.background,
        surface: colors.light.surfaceContainerLowest,
        'surface-variant': colors.light.surfaceVariant,
        'on-surface': colors.light.onSurface,
        'on-surface-variant': colors.light.onSurfaceVariant,
        outline: colors.light.outline,
        error: colors.light.error,
        'on-primary': colors.light.onPrimary,
        'background-dark': colors.dark.background,
      },
      borderRadius: {
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        tail: `${radius.bubbleTail}px`,
      },
    },
  },
  plugins: [],
};
