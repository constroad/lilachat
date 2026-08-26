import { useCallback, useEffect, useMemo, useState } from 'react';
// **`expo-contacts/legacy` y NO la raíz.** En la 57 la raíz expone la API nueva
// (`Contact`, `getPermissionsAsync`) pero NO `getContactsAsync` ni `Fields`:
// llamarlos ahí devuelve `undefined` y revienta al leer `Fields.PhoneNumbers`.
// Ese fue el bug de los esqueletos eternos del 26/08/2026.
import * as Contacts from 'expo-contacts/legacy';
import { separarAgenda, type ContactoDeAgenda, type ContactoRegistrado } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';
import { resolverEstadoAgenda } from './estadoAgenda';

/**
 * La gente de tu agenda que TODAVÍA no está en Lilachat.
 *
 * **El cruce se hace acá, en el teléfono.** La agenda no viaja: se compara
 * contra la lista de contactos registrados que el server ya nos dio —gente con
 * la que podemos hablar de todos modos—. Es lo mismo que ve WhatsApp, sin subir
 * la libreta de nadie.
 */
export type ResultadoAgenda =
  | { estado: 'cargando' }
  | { estado: 'denegado' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'listo'; paraInvitar: ContactoDeAgenda[] };

export function useAgendaParaInvitar(registrados: ContactoRegistrado[] | null): ResultadoAgenda {
  const [permiso, setPermiso] = useState<'concedido' | 'denegado' | null>(null);
  const [agenda, setAgenda] = useState<ContactoDeAgenda[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermiso('denegado');
        return;
      }
      setPermiso('concedido');

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // Un contacto con varios números entra una vez por número; `separarAgenda`
      // deduplica después por número normalizado.
      setAgenda(
        data.flatMap((contacto) =>
          (contacto.phoneNumbers ?? [])
            .filter((numero) => Boolean(numero.number))
            .map((numero, indice) => ({
              id: `${contacto.id ?? contacto.name ?? 'x'}-${indice}`,
              nombre: contacto.name?.trim() || (numero.number as string),
              telefono: numero.number as string,
            }))
        )
      );
    } catch (error) {
      // **Se guarda el mensaje, no se traga.** Antes esto dejaba el estado en
      // `null` y la pantalla mostraba esqueletos para siempre: un fallo con la
      // misma cara que una carga lenta es un fallo que nadie encuentra.
      reportarError('useAgendaParaInvitar', error);
      setFallo(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const estado = resolverEstadoAgenda({ permiso, agenda, fallo });

  /**
   * El cruce va MEMOIZADO. Son 600+ contactos por normalizar y comparar, y sin
   * esto corría entero en cada render — incluida cada tecla del buscador, que
   * es exactamente cuando la app tiene que responder rápido.
   */
  return useMemo<ResultadoAgenda>(() => {
    if (estado.estado !== 'listo') return estado;
    // Sin los registrados todavía no se puede decidir a quién falta invitar.
    if (registrados === null) return { estado: 'cargando' };
    return {
      estado: 'listo',
      paraInvitar: separarAgenda({ registrados, agenda: estado.agenda }).paraInvitar,
    };
    // `estado` es un objeto nuevo en cada render; lo que de verdad cambia son
    // sus partes, y esas son las que se observan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.estado, agenda, registrados, fallo, permiso]);
}
