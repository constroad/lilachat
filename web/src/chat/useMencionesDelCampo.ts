import { useRef, useState, type KeyboardEvent } from 'react';
import { completarMencion, consultaDeMencion, rangosDeMenciones, type ConsultaDeMencion, type MencionElegida, type MencionEnMensaje } from '@lilachat/shared';
import { mentionOptions } from '@lilachat/shared';
import { filtrarMencionables, type Mencionable, type MentionSuggestion } from './SugerenciasDeMencion';

/**
 * Las @menciones del campo de escribir (W2), con el motor de la app
 * (`textoDelComposer`, compartido): detectar el «@», completar el nombre y, al
 * enviar, los rangos de cada mención que siga en el texto.
 */
export function useMencionesDelCampo(miembros: readonly Mencionable[] | undefined) {
  const [consulta, setConsulta] = useState<ConsultaDeMencion | null>(null);
  const [activa, setActiva] = useState(0);
  const elegidas = useRef<MencionElegida[]>([]);
  // E3b: in a group (members given) the group mentions come first.
  const withGroup: readonly MentionSuggestion[] | undefined = mentionOptions(miembros);
  // The filter keeps the same objects, so the hint of a group mention survives.
  const opciones = (consulta && withGroup ? filtrarMencionables(withGroup, consulta.consulta) : []) as MentionSuggestion[];

  const alCambiar = (texto: string, cursor: number) => {
    setConsulta(miembros?.length ? consultaDeMencion(texto, cursor) : null);
    setActiva(0);
  };

  /** Cambia el «@an» por «@Ana » y devuelve el texto y dónde queda el cursor. */
  const elegir = (texto: string, uno: Mencionable): { texto: string; cursor: number } | null => {
    if (!consulta) return null;
    elegidas.current = [...elegidas.current, { userId: uno.id, nombre: uno.nombre }];
    setConsulta(null);
    return completarMencion(texto, consulta, uno.nombre);
  };

  /** Flechas, Enter/Tab y Escape mientras hay sugerencias. `true` si la tecla era suya. */
  const alTeclear = (evento: KeyboardEvent, alElegir: (uno: Mencionable) => void): boolean => {
    if (opciones.length === 0) return false;
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      setActiva((actual) => (actual + paso + opciones.length) % opciones.length);
    } else if (evento.key === 'Enter' || evento.key === 'Tab') alElegir(opciones[activa] ?? opciones[0]!);
    else if (evento.key === 'Escape') setConsulta(null);
    else return false;
    evento.preventDefault();
    return true;
  };

  const mencionesDe = (texto: string): MencionEnMensaje[] => rangosDeMenciones(texto, elegidas.current);
  const limpiar = () => {
    elegidas.current = [];
    setConsulta(null);
  };

  return { opciones, activa, alCambiar, elegir, alTeclear, mencionesDe, limpiar };
}
