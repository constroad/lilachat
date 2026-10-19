import { useEffect, useState } from 'react';
import { AccessScreens } from './auth/AccessScreens';
import { CodigoParaLaApp } from './auth/CodigoParaLaApp';
import { registrarServiceWorker } from './pwa/serviceWorker';
import { Shell } from './Shell';
import { useSesion } from './sesion/useSesion';

/**
 * La puerta: sin sesión, el acceso; con sesión, el shell de dos paneles.
 *
 * El shell es OTRO componente a propósito: todos sus hooks viven del lado de
 * adentro de la puerta. Un hook después de un `return` condicional tiraba
 * «Rendered more hooks than during the previous render» y la pantalla quedaba
 * en blanco justo al terminar de entrar (§16).
 */
export function App() {
  const sesion = useSesion();
  // Desde la primera visita, también sin sesión (W4): así la app ya queda guardada.
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  useEffect(() => registrarServiceWorker(() => setHayVersionNueva(true)), []);
  // El QR de vincular abierto con la cámara del teléfono (W5): no es una sesión, es una indicación.
  if (window.location.pathname.startsWith('/v/')) return <CodigoParaLaApp />;
  if (!sesion.credential) return <AccessScreens onReady={sesion.entrar} />;
  return (
    <Shell
      credential={sesion.credential}
      refrescoResuelto={sesion.refrescoResuelto}
      logout={sesion.logout}
      manejar401={sesion.manejar401}
      hayVersionNueva={hayVersionNueva}
    />
  );
}
