/**
 * Vivid Pulse para la web. Los hex NO viven acá: salen de `shared/tokens.json`,
 * generado desde `shared/src/tokens.ts` (la única fuente, igual que en la app).
 * Tras tocar los tokens: `npm run emit-tokens` en la raíz.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { colors, radius } = require('../shared/tokens.json');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colors.light.primary,
          container: colors.light.primaryContainer,
          brand: colors.light.brandPrimary,
        },
        secondary: { DEFAULT: colors.light.secondary, brand: colors.light.brandSecondary },
        background: colors.light.background,
        surface: colors.light.surfaceContainerLowest,
        'surface-variant': colors.light.surfaceVariant,
        'on-surface': colors.light.onSurface,
        'on-surface-variant': colors.light.onSurfaceVariant,
        outline: colors.light.outline,
        error: colors.light.error,
        'on-primary': colors.light.onPrimary,
      },
      borderRadius: { lg: `${radius.lg}px`, xl: `${radius.xl}px` },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
