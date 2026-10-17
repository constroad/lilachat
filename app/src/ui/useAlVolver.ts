import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Llama a `alVolver` cuando la pestaña vuelve a estar a la vista: al entrar a
 * ella otra vez, o al volver la app a primer plano con ella abierta. NO al
 * montarse (esa primera carga ya la hace la pantalla).
 *
 * Existe por la auditoría del 17/10/2026: con las pestañas montadas, la Agenda
 * y las Encuestas no se recargaban nunca — un evento creado desde un chat, o
 * por otra persona, no aparecía hasta reiniciar la app. Es una lectura al
 * volver, no un polling.
 */
export function useAlVolver(activa: boolean, alVolver: () => void): void {
  const alVolverRef = useRef(alVolver);
  alVolverRef.current = alVolver;
  const antes = useRef(activa);

  useEffect(() => {
    if (activa && !antes.current) alVolverRef.current();
    antes.current = activa;
  }, [activa]);

  useEffect(() => {
    if (!activa) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') alVolverRef.current();
    });
    return () => sub.remove();
  }, [activa]);
}
