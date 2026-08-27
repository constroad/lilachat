import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import { paletaDe, type NombreDeColor } from '@lilachat/shared';
import {
  guardarTema,
  leerTema,
  TEMA_POR_DEFECTO,
  type ModoDeTema,
} from '../settings/preferencias';

/**
 * El tema de la app: claro, oscuro o el del teléfono (27/08/2026).
 *
 * **El grueso del trabajo NO pasa por acá.** Los colores de las pantallas son
 * clases de Tailwind (`bg-surface`, `text-on-surface`) apoyadas en variables CSS
 * que cambian solas con el modo — ver `shared/src/tema.ts`. Este proveedor hace
 * dos cosas que las clases no pueden:
 *
 * 1. Le dice a NativeWind qué modo va (`setColorScheme`), y recuerda la
 *    elección entre arranques.
 * 2. Da los HEX a lo que no acepta clases: el `color` de los iconos de
 *    `lucide-react-native`, el `placeholderTextColor` de los inputs y el
 *    `StatusBar`. Eran 106 hex escritos a mano en 20 archivos, y cada uno era un
 *    punto que se quedaba en modo claro.
 */
type Contexto = {
  modo: ModoDeTema;
  setModo: (modo: ModoDeTema) => void;
  oscuro: boolean;
  colores: Colores;
};

/**
 * Los hex, por nombre de clase, más los que no son de la paleta base.
 *
 * `advertencia` y `avisos` viven acá y no como hex sueltos por el mismo motivo
 * que el resto: un ámbar pensado para fondo blanco sobre navy se ve sucio y
 * apagado.
 */
export type Colores = Record<NombreDeColor, string> & {
  /** Ámbar de «ojo con esto» (chat secreto, respaldo). */
  advertencia: string;
  /** Los colores de categoría de los avisos de la agenda. */
  avisos: readonly string[];
};

function armarColores(oscuro: boolean): Colores {
  const base = paletaDe(oscuro ? 'dark' : 'light');
  return {
    ...base,
    advertencia: oscuro ? '#fbbf24' : '#d97706',
    // Los mismos cinco tonos, subidos de luminosidad para el fondo navy.
    avisos: oscuro
      ? ['#c4b5fd', '#93c5fd', '#f0abfc', '#fdba74', '#5eead4']
      : ['#6b38d4', '#0058be', '#a12e70', '#c2410c', '#0f766e'],
  };
}

/**
 * El default es el claro y no el del sistema: el contexto sin proveedor solo
 * ocurre en un test, y ahí es mejor un valor fijo que uno que dependa de cómo
 * esté configurada la máquina que corre los tests.
 */
const TemaContext = createContext<Contexto>({
  modo: TEMA_POR_DEFECTO,
  setModo: () => {},
  oscuro: false,
  colores: armarColores(false),
});

export const useTema = (): Contexto => useContext(TemaContext);
export const useColores = (): Colores => useContext(TemaContext).colores;

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [modo, setModoEstado] = useState<ModoDeTema>(TEMA_POR_DEFECTO);
  /**
   * NativeWind ya resuelve «system» y escucha los cambios del sistema operativo.
   * Se delega en él en vez de escuchar `Appearance` por nuestra cuenta: dos
   * fuentes para el mismo dato se desincronizan, y el síntoma sería la mitad de
   * la pantalla en un modo y la mitad en el otro.
   */
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    let vivo = true;
    void leerTema().then((guardado) => {
      if (vivo) setModoEstado(guardado);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    setColorScheme(modo === 'sistema' ? 'system' : modo === 'oscuro' ? 'dark' : 'light');
  }, [modo, setColorScheme]);

  const oscuro = colorScheme === 'dark';

  const valor = useMemo<Contexto>(
    () => ({
      modo,
      oscuro,
      colores: armarColores(oscuro),
      setModo: (nuevo: ModoDeTema) => {
        setModoEstado(nuevo);
        // Se guarda sin esperar: que el disco tarde no puede retrasar el
        // repintado, y si falla lo peor que pasa es volver al automático.
        void guardarTema(nuevo);
      },
    }),
    [modo, oscuro]
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}
