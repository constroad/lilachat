import { useCallback, useRef, useState } from 'react';
import { compartirInvitacion } from './compartirInvitacion';
import { invitarContacto } from './contactsApi';
import { textoDeInvitacionFallida, type ContactoInvitable } from './invitar';

/**
 * Invitar de verdad, el MISMO flujo en «Invitar» y en «Nuevo chat» (FL13d):
 * primero se CREA la admisión y recién después se comparte. Sin el primer paso
 * la persona instala la app y el server nunca le manda el código.
 *
 * Mientras la admisión viaja, la fila lo muestra y no acepta otro toque; si
 * falla, el motivo queda debajo de ESA fila y no se comparte nada.
 */
export function useInvitar(jwt: string) {
  const [invitando, setInvitando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<{ id: string; texto: string } | null>(null);
  const ocupado = useRef(false);

  const invitar = useCallback(
    async (contacto: ContactoInvitable | null) => {
      if (ocupado.current) return;
      if (contacto) {
        ocupado.current = true;
        setInvitando(contacto.id);
        const alta = await invitarContacto(jwt, contacto.telefono);
        ocupado.current = false;
        setInvitando(null);
        if (!alta.ok) return setFallo({ id: contacto.id, texto: textoDeInvitacionFallida(contacto.nombre, alta.message) });
      }
      setFallo(null);
      await compartirInvitacion(contacto);
    },
    [jwt]
  );

  return { invitar, invitando, fallo };
}
