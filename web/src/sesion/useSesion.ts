import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  borrarCredencialVieja,
  clearPerfil,
  leerSecretoViejo,
  loadPerfil,
  refreshSession,
  salirDelServer,
  savePerfil,
  type Credential,
  type Perfil,
} from '../api';
import { olvidarCache } from '../chat/cacheLocal';
import { borrarBaseDe } from '../local/baseLocal';

/**
 * La sesión de la web (W1 → W0 endurecida, 19/10):
 * - el perfil (sin secretos) en `localStorage`; el secreto en una cookie
 *   `HttpOnly`; el JWT solo en memoria;
 * - al abrir se renueva con la cookie; una sesión vieja se muda a la cookie;
 * - sin red se sigue SIN JWT: la pantalla sale de la base local y la cola
 *   espera; al volver la red, se renueva sola;
 * - un 401 renueva UNA vez por token (sin el freno era un bucle contra la API);
 * - cerrar sesión borra la cookie, la base local y el perfil.
 */
/** Sin sesión viva, cada cuánto se vuelve a probar (solo con la pestaña al frente). */
const REINTENTO_DE_SESION_MS = 15_000;

export function useSesion() {
  const [perfil, setPerfil] = useState<Perfil | null>(loadPerfil);
  const [jwt, setJwt] = useState<string | null>(null);
  /** El socket espera a esto: abrirlo sin un token vivo rebota. */
  const [refrescoResuelto, setRefrescoResuelto] = useState(false);
  const refrescoIntentado = useRef<string | null>(null);

  const logout = useCallback(() => {
    const userId = perfil?.userId;
    void salirDelServer();
    clearPerfil();
    olvidarCache({ alSalir: true });
    if (userId) void borrarBaseDe(userId);
    setPerfil(null);
    setJwt(null);
  }, [perfil?.userId]);

  /** Renueva con la cookie. `true` si hay JWT nuevo; un 401 real cierra la sesión. */
  const renovar = useCallback(async (): Promise<boolean> => {
    const secretoViejo = leerSecretoViejo();
    const renovado = await refreshSession(secretoViejo);
    if (!renovado.ok) {
      if (renovado.revocado) logout();
      return false;
    }
    if (secretoViejo) borrarCredencialVieja();
    setJwt(renovado.jwt);
    setPerfil((actual) => {
      if (!actual) return actual;
      const siguiente = { ...actual, name: renovado.user?.name ?? actual.name };
      savePerfil(siguiente);
      return siguiente;
    });
    return true;
  }, [logout]);

  // La caché vieja de localStorage (historial en claro) ya no se usa: se va.
  useEffect(() => olvidarCache(), []);

  useEffect(() => {
    // Recién entrado con el código ya hay JWT y cookie: renovar sería un pedido de más.
    if (!perfil || jwt) return;
    void renovar().finally(() => setRefrescoResuelto(true));
    // Solo al abrir y al cambiar de dispositivo: renovar en cada render sería un pedido por tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.deviceId]);

  // Sin sesión viva (sin red, o el server no contestaba): se reintenta al
  // volver la red o la pestaña, y cada tanto mientras falte (W4). Sin esto, si
  // volvía el SERVER y no la red, nada avisaba y quedaba «Sin conexión».
  useEffect(() => {
    if (!perfil || jwt) return;
    const reintentar = () => {
      if (document.visibilityState === 'visible') void renovar();
    };
    const reloj = setInterval(reintentar, REINTENTO_DE_SESION_MS);
    window.addEventListener('online', reintentar);
    document.addEventListener('visibilitychange', reintentar);
    return () => {
      clearInterval(reloj);
      window.removeEventListener('online', reintentar);
      document.removeEventListener('visibilitychange', reintentar);
    };
  }, [perfil, jwt, renovar]);

  /** Un 401 de la API: renovar una vez por token o salir. */
  const manejar401 = useCallback(async (): Promise<boolean> => {
    if (refrescoIntentado.current === jwt) return (logout(), false);
    refrescoIntentado.current = jwt;
    return renovar();
  }, [jwt, logout, renovar]);

  /** El canje del código acaba de crear el token y la cookie: no hay nada que renovar. */
  const entrar = useCallback((siguiente: Credential) => {
    const { jwt: token, ...datos } = siguiente;
    savePerfil(datos);
    setPerfil(datos);
    setJwt(token);
    setRefrescoResuelto(true);
  }, []);

  const credential = useMemo<Credential | null>(() => (perfil ? { ...perfil, jwt: jwt ?? '' } : null), [perfil, jwt]);
  return { credential, refrescoResuelto, entrar, logout, manejar401 };
}
