/**
 * Vivid Pulse para la web, claro y oscuro (José, 21/10: la web no tenía modo
 * oscuro). Los hex NO viven acá: salen de `shared/tokens.json`, generado desde
 * `shared/src/tokens.ts` (la única fuente, igual que en la app). Cada color es
 * una variable CSS en `rgb(… / alpha)`: `.dark` en `<html>` cambia la paleta y
 * las opacidades (`bg-primary/10`) siguen andando.
 * Tras tocar los tokens: `npm run emit-tokens` en la raíz.
 */
import { createRequire } from 'node:module';
import plugin from 'tailwindcss/plugin';
const require = createRequire(import.meta.url);
const { colors, radius } = require('../shared/tokens.json');

/** Tailwind name → token name. */
const PALETTE = {
  primary: 'primary',
  'primary-container': 'primaryContainer',
  'primary-brand': 'brandPrimary',
  secondary: 'secondary',
  'secondary-brand': 'brandSecondary',
  background: 'background',
  surface: 'surfaceContainerLowest',
  'surface-variant': 'surfaceVariant',
  'on-surface': 'onSurface',
  'on-surface-variant': 'onSurfaceVariant',
  outline: 'outline',
  error: 'error',
  'on-primary': 'onPrimary',
  'chat-bg': 'chatBackground',
  'autor-1': 'author1',
  'autor-2': 'author2',
  'autor-3': 'author3',
  'autor-4': 'author4',
  'autor-5': 'author5',
  'autor-6': 'author6',
};

const channels = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value.slice(0, 6);
  return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16)).join(' ');
};
const variablesOf = (palette) => Object.fromEntries(Object.entries(PALETTE).map(([name, token]) => [`--c-${name}`, channels(palette[token])]));
const color = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  // `.dark` goes on <html> from code (`ui/tema.ts`): without this, Tailwind drops the dark palette as unused.
  safelist: ['dark'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: color('primary'), container: color('primary-container'), brand: color('primary-brand') },
        secondary: { DEFAULT: color('secondary'), brand: color('secondary-brand') },
        ...Object.fromEntries(Object.keys(PALETTE).filter((name) => !name.startsWith('primary') && !name.startsWith('secondary')).map((name) => [name, color(name)])),
      },
      borderRadius: { lg: `${radius.lg}px`, xl: `${radius.xl}px` },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      // La barra del QR (W5): se vacía hasta el próximo token.
      keyframes: { vaciar: { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } } },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': { ...variablesOf(colors.light), colorScheme: 'light' } });
      addBase({ 'html.dark': { ...variablesOf(colors.dark), colorScheme: 'dark' } });
    }),
  ],
};
