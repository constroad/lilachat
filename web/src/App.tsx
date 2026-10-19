import { AccessScreens } from './auth/AccessScreens';
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
  if (!sesion.credential) return <AccessScreens onReady={sesion.entrar} />;
  return (
    <Shell
      credential={sesion.credential}
      refrescoResuelto={sesion.refrescoResuelto}
      logout={sesion.logout}
      manejar401={sesion.manejar401}
    />
  );
}
