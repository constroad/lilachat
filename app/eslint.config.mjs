import reactHooks from 'eslint-plugin-react-hooks';
import parserTs from '@typescript-eslint/parser';

/**
 * Lint mínimo, con UN objetivo: las reglas de los hooks.
 *
 * El 27/08/2026 la app reventó al tocar el lápiz con «Rendered more hooks than
 * during the previous render» — tres hooks puestos DESPUÉS de un `return`
 * condicional. Es un error que ni `tsc` ni los tests unitarios ven, y que este
 * repo ya había cometido antes en la web.
 *
 * `rules-of-hooks` lo detecta leyendo el código. Es la única forma barata de que
 * no vuelva a pasar.
 */
export default [
  { ignores: ['android/**', 'ios/**', 'node_modules/**', 'dist/**', '.expo/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    // Solo el parser: no hace falta el chequeo de tipos de ESLint —de eso ya se
    // ocupa `tsc`— y añadirlo haría el lint lento sin encontrar nada nuevo.
    languageOptions: { parser: parserTs, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
