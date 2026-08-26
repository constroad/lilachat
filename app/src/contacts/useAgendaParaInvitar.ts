import { useCallback, useEffect, useState } from 'react';
import * as Contacts from 'expo-contacts';
import { separarAgenda, type ContactoDeAgenda, type ContactoRegistrado } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';

/**
 * La gente de tu agenda que TODAVÍA no está en Lilachat.
 *
 * **El cruce se hace acá, en el teléfono.** La agenda no viaja: se compara
 * contra la lista de contactos registrados que el server ya nos dio —gente con
 * la que podemos hablar de todos modos—. Es lo mismo que ve WhatsApp, sin subir
 * la libreta de nadie.
 *
 * Tres estados y no dos: `pidiendo` mientras se resuelve el permiso, `denegado`
 * si dijo que no (y ahí la pantalla ofrece compartir el enlace igual), y la
 * lista cuando hay. Sin permiso NO se muestra una lista vacía como si la agenda
 * estuviera vacía: son cosas distintas.
 */
export type EstadoAgenda =
  | { estado: 'pidiendo' }
  | { estado: 'denegado' }
  | { estado: 'listo'; paraInvitar: ContactoDeAgenda[] };

export function useAgendaParaInvitar(registrados: ContactoRegistrado[] | null): EstadoAgenda {
  const [agenda, setAgenda] = useState<ContactoDeAgenda[] | null>(null);
  const [denegado, setDenegado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setDenegado(true);
        return;
      }

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
    } catch (fallo) {
      // Leer la agenda puede fallar por mil motivos del fabricante. Se reporta
      // —antes esto era invisible— y se trata como «no hay», no como un crash.
      reportarError('useAgendaParaInvitar', fallo);
      setAgenda([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (denegado) return { estado: 'denegado' };
  if (agenda === null || registrados === null) return { estado: 'pidiendo' };

  return { estado: 'listo', paraInvitar: separarAgenda({ registrados, agenda }).paraInvitar };
}
