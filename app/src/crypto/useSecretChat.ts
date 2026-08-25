import { useCallback, useEffect, useState } from 'react';
import type { Envelope } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { ensureIdentity, fetchPublicKey, fingerprintWith, openFrom, sealFor } from './deviceKeys';

/**
 * La sesión de cifrado de UNA conversación secreta (F9).
 *
 * **Stitch no diseñó ninguna pantalla de cifrado** —el spec las tiene como
 * pendientes de diseño—, así que todo lo de esta capa y su interfaz es decisión
 * propia, y se anota para no confundirlo con algo copiado de una captura.
 *
 * Tiene TRES estados y los tres se muestran distinto, porque significan cosas
 * distintas:
 *
 *  · `cargando` — todavía buscando la clave del otro.
 *  · `listo` — se puede cifrar y descifrar.
 *  · `sin-clave` — el otro **nunca abrió la app en un teléfono**, así que no
 *    publicó clave. No es un error nuestro y no se arregla reintentando: hay
 *    que decirlo tal cual, porque el usuario tiene que saber que no puede
 *    escribirle ahí todavía.
 */
export type SecretSession =
  | { estado: 'cargando' }
  | { estado: 'sin-clave' }
  | {
      estado: 'listo';
      seal: (text: string) => Envelope | null;
      open: (envelope: Envelope) => string | null;
      fingerprint: string;
    };

export function useSecretChat(params: {
  credential: Credential;
  /** El otro miembro del chat. Sin él no hay con quién derivar. */
  otherUserId: string | null;
  enabled: boolean;
}): SecretSession {
  const [session, setSession] = useState<SecretSession>({ estado: 'cargando' });

  const load = useCallback(async () => {
    if (!params.enabled || !params.otherUserId) return;

    const mia = await ensureIdentity();
    const suya = await fetchPublicKey(params.credential.jwt, params.otherUserId);
    if (!suya) return setSession({ estado: 'sin-clave' });

    setSession({
      estado: 'listo',
      // Si algo falla al cifrar se devuelve `null` y NO se cae a texto plano:
      // el candado en pantalla tiene que significar lo que dice.
      seal: (text) => {
        try {
          return sealFor(suya, mia.privateKey, text);
        } catch {
          return null;
        }
      },
      open: (envelope) => openFrom(suya, mia.privateKey, envelope),
      fingerprint: fingerprintWith(mia.publicKey, suya),
    });
  }, [params.credential.jwt, params.otherUserId, params.enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return session;
}
