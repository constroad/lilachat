import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { decidirAtras } from '../ui/botonAtras';

type EstadoDelChat = {
  haySeleccion: boolean;
  buscando: boolean;
  editando: boolean;
  respondiendo: boolean;
};

/**
 * El botón ATRÁS de Android en la conversación (salió de `ChatScreen`).
 *
 * Sin un manejador, Android cierra la actividad —y como esta app tiene una
 * sola, eso es salir (José, 27/08/2026, en el chat con Wilson)—. Primero se
 * deshace lo que se está haciendo (FL9): la selección, la búsqueda, la
 * edición, la respuesta; recién después vuelve a la lista.
 *
 * Lee el estado y las acciones por ref: el listener no se vuelve a registrar
 * en cada render.
 */
export function useAtrasDelChat(
  estado: EstadoDelChat,
  acciones: {
    soltarSeleccion: () => void;
    cerrarBusqueda: () => void;
    cancelarEdicion: () => void;
    cancelarRespuesta: () => void;
    volver: () => void;
  }
) {
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const accionesRef = useRef(acciones);
  accionesRef.current = acciones;

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      const hacer = accionesRef.current;
      const accion = decidirAtras({ pantalla: 'chat', ...estadoRef.current });
      if (accion === 'soltar-seleccion') hacer.soltarSeleccion();
      else if (accion === 'limpiar-busqueda') hacer.cerrarBusqueda();
      else if (accion === 'cancelar-edicion') hacer.cancelarEdicion();
      else if (accion === 'cancelar-respuesta') hacer.cancelarRespuesta();
      else if (accion === 'ir-a-lista') hacer.volver();
      else return false;
      return true;
    });
    return () => suscripcion.remove();
  }, []);
}
