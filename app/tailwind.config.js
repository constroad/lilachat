/**
 * Vivid Pulse para la app.
 *
 * Los colores NO son hex: son variables CSS que `app/global.css` define para los
 * dos modos (ese archivo también se genera — `npm run emit-tokens`). Por eso las
 * clases de las pantallas (`bg-surface`, `text-on-surface`) sirven igual en claro
 * y en oscuro y **ninguna pantalla necesita escribir `dark:`**: lo que cambia es
 * el valor de la variable, no la clase.
 *
 * `<alpha-value>` es lo que mantiene vivo el `/10` de `bg-primary/10`. Sin ese
 * placeholder, Tailwind no puede inyectar la opacidad y todos los fondos tenues
 * de la app se vuelven sólidos.
 *
 * `tailwindColors` viene GENERADO en el JSON, no escrito acá: repetir los
 * nombres a mano es la forma de que un día el Tailwind nombre una variable que
 * el CSS no define, y eso no rompe nada — solo pinta transparente.
 */
const { radius, tailwindColors } = require('../shared/tokens.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Por clase, no por media query: el modo lo decide la persona en Ajustes
  // («sistema» incluido), y NativeWind pone la clase `dark` según `colorScheme`.
  darkMode: 'class',
  theme: {
    extend: {
      colors: tailwindColors,
      borderRadius: {
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        tail: `${radius.bubbleTail}px`,
      },
    },
  },
  plugins: [],
};
