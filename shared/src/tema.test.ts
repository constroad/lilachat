import { describe, expect, it } from 'vitest';
import { vividPulse } from './tokens.js';
import { hexARgb, NOMBRES_DE_COLOR, paletaDe, variablesDeTema } from './tema.js';

describe('hexARgb', () => {
  it('descompone un hex de 6 en sus canales', () => {
    expect(hexARgb('#6b38d4')).toBe('107 56 212');
  });

  it('acepta la forma corta', () => {
    expect(hexARgb('#fff')).toBe('255 255 255');
  });

  it('acepta el hex sin numeral', () => {
    expect(hexARgb('0f172a')).toBe('15 23 42');
  });

  /**
   * Un color mal escrito NO puede pasar en silencio: una variable con basura
   * adentro se resuelve a transparente, y un fondo transparente manda a buscar
   * el problema al layout en vez de al token.
   */
  it('un hex inválido revienta, no devuelve algo', () => {
    expect(() => hexARgb('#xyz123')).toThrow();
    expect(() => hexARgb('#12345')).toThrow();
  });
});

describe('paletaDe', () => {
  /**
   * **EL test que justifica todo esto.**
   *
   * El modo oscuro se rompe de una sola forma: falta un color, la clase queda
   * con el valor claro y aparece un bloque blanco en medio de una pantalla
   * oscura. Acá se recorre el mapa entero en los dos modos, así que agregar un
   * color nuevo sin su par oscuro pone el test en rojo antes de compilar nada.
   */
  it('todos los nombres resuelven en los DOS modos', () => {
    for (const esquema of ['light', 'dark'] as const) {
      const paleta = paletaDe(esquema);
      for (const clase of Object.keys(NOMBRES_DE_COLOR)) {
        expect(paleta[clase as keyof typeof NOMBRES_DE_COLOR], `${clase} en ${esquema}`).toMatch(
          /^#[0-9a-f]{3,6}$/i
        );
      }
    }
  });

  /**
   * Y que sean DISTINTOS donde importa. Sin esto la prueba de arriba pasaría con
   * un `dark` vacío que hereda todo lo claro — que es exactamente el estado en
   * que estaba el proyecto: la paleta oscura tenía dos colores.
   */
  it('los colores de superficie y texto cambian entre modos', () => {
    const claro = paletaDe('light');
    const oscuro = paletaDe('dark');

    for (const clase of ['background', 'surface', 'on-surface', 'on-surface-variant'] as const) {
      expect(oscuro[clase], `${clase} debería diferir`).not.toBe(claro[clase]);
    }
  });

  /**
   * El fondo oscuro es navy, nunca negro puro (spec §2.1): el diseño apoya el
   * glass sobre profundidad y el negro plano lo aplasta.
   */
  it('el fondo oscuro no es negro puro', () => {
    expect(paletaDe('dark').background).toBe(vividPulse.colors.dark.background);
    expect(paletaDe('dark').background).not.toMatch(/^#000/);
  });

  /**
   * En oscuro, `primary` se usa como TEXTO sobre el fondo navy (título, pestaña
   * activa). Si siguiera siendo el violeta oscuro del modo claro, no se leería.
   */
  it('el primary oscuro es más claro que el fondo', () => {
    const luminancia = (hex: string) => {
      const [r, g, b] = hexARgb(hex).split(' ').map(Number);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const oscuro = paletaDe('dark');

    expect(luminancia(oscuro.primary)).toBeGreaterThan(luminancia(oscuro.background) + 60);
  });
});

describe('variablesDeTema', () => {
  it('nombra las variables como las espera el tailwind.config', () => {
    expect(variablesDeTema('light')['--color-primary']).toBe('107 56 212');
    expect(variablesDeTema('light')['--color-on-primary']).toBe('255 255 255');
  });

  /**
   * Canales sueltos, sin `rgb()`. Tailwind lo envuelve él —
   * `rgb(var(--color-x) / <alpha-value>)`— y así `bg-primary/10` sigue siendo
   * translúcido. Con un `rgb(...)` completo adentro, cada fondo tenue de la app
   * se vuelve sólido.
   */
  it('los valores son canales sueltos, para que la opacidad funcione', () => {
    for (const valor of Object.values(variablesDeTema('dark'))) {
      expect(valor).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it('define una variable por cada nombre del mapa', () => {
    expect(Object.keys(variablesDeTema('dark'))).toHaveLength(
      Object.keys(NOMBRES_DE_COLOR).length
    );
  });
});

/**
 * FL3 (spec §45): los colores de la conversación. Propia lavanda CLARA con
 * texto oscuro en claro; en oscuro, violeta PROFUNDO con texto claro — un
 * bloque claro en un chat oscuro deslumbra (auditoría del 16/10).
 */
describe('colores del chat', () => {
  const luminancia = (hex: string) => {
    const [r, g, b] = hexARgb(hex).split(' ').map(Number);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  it('la burbuja propia contrasta con su texto en los dos modos', () => {
    for (const esquema of ['light', 'dark'] as const) {
      const paleta = paletaDe(esquema);
      const diferencia = Math.abs(luminancia(paleta['burbuja-propia']) - luminancia(paleta['on-burbuja-propia']));
      expect(diferencia, esquema).toBeGreaterThan(120);
    }
  });

  it('en oscuro la burbuja propia es oscura (no lavanda)', () => {
    expect(luminancia(paletaDe('dark')['burbuja-propia'])).toBeLessThan(90);
  });

  /**
   * FL13 (José, 18/10: «no se siente premium»; diseño FL6 de Stitch): la
   * propia es violeta SÓLIDO con texto blanco, y la hora y el check de leído
   * tienen su propio color sobre ella (el gris y el azul de siempre no se leen).
   */
  it('en claro la burbuja propia es el violeta de marca, con texto blanco', () => {
    const paleta = paletaDe('light');
    expect(paleta['burbuja-propia']).toBe(paleta.primary);
    expect(paleta['on-burbuja-propia']).toBe('#ffffff');
  });

  it('la hora y el check de leído se leen sobre la burbuja propia', () => {
    for (const esquema of ['light', 'dark'] as const) {
      const paleta = paletaDe(esquema);
      for (const nombre of ['on-burbuja-propia-suave', 'check-leido-propio'] as const) {
        const diferencia = Math.abs(luminancia(paleta['burbuja-propia']) - luminancia(paleta[nombre]));
        expect(diferencia, `${esquema} ${nombre}`).toBeGreaterThan(90);
      }
    }
  });

  it('el gris de las superficies es neutro: sin el celeste que venía de Stitch', () => {
    const [r, g, b] = hexARgb(paletaDe('light')['surface-variant']).split(' ').map(Number);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(16);
  });

  it('los tonos de avatar son distintos entre sí y el texto primary se lee encima', () => {
    for (const esquema of ['light', 'dark'] as const) {
      const paleta = paletaDe(esquema);
      const tonos = (['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5'] as const).map((nombre) => paleta[nombre]);
      expect(new Set(tonos).size, esquema).toBe(5);
      for (const tono of tonos) expect(Math.abs(luminancia(tono) - luminancia(paleta.primary)), esquema).toBeGreaterThan(70);
    }
  });

  it('el fondo del chat se distingue de las burbujas ajenas', () => {
    for (const esquema of ['light', 'dark'] as const) {
      const paleta = paletaDe(esquema);
      expect(paleta['fondo-chat']).not.toBe(paleta['burbuja-ajena']);
    }
  });
});

