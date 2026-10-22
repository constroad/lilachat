import { useEffect, useState } from 'react';
import { AdminUsersScreen } from './admin/AdminUsersScreen';
import { AccessScreens } from './auth/AccessScreens';
import { CodigoParaLaApp } from './auth/CodigoParaLaApp';
import { InstallAppScreen } from './apps/InstallAppScreen';
import { CompleteProfileScreen } from './profile/CompleteProfileScreen';
import { useProfileGate } from './profile/useProfileGate';
import { registrarServiceWorker } from './pwa/serviceWorker';
import { Shell } from './Shell';
import { MiniVideoPlayer } from './media/MiniVideoPlayer';
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
  // Name, birthday and a verified email are required (backlog 17): a session without them completes them first.
  const profileGate = useProfileGate({ jwt: sesion.credential?.jwt || null, userId: sesion.credential?.userId ?? null, sessionSettled: sesion.refrescoResuelto });
  // Desde la primera visita, también sin sesión (W4): así la app ya queda guardada.
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  useEffect(() => {
    registrarServiceWorker(() => setHayVersionNueva(true));
  }, []);
  // El QR de vincular abierto con la cámara del teléfono (W5): no es una sesión, es una indicación.
  if (window.location.pathname.startsWith('/v/')) return <CodigoParaLaApp />;
  if (!sesion.credential) return <AccessScreens onReady={sesion.entrar} />;
  // Waiting for the profile answer: nothing, rather than the chats for an instant and then the form.
  if (profileGate.checking) return null;
  if (profileGate.incomplete) return <CompleteProfileScreen jwt={sesion.credential.jwt} profile={profileGate.incomplete} onDone={profileGate.done} />;
  // Installing an app (agentes' Lila) in a space: after signing in it comes back to this same address.
  if (window.location.pathname === '/instalar-app') {
    return sesion.credential.jwt ? <InstallAppScreen jwt={sesion.credential.jwt} search={window.location.search} onRedirect={(url) => window.location.assign(url)} /> : null;
  }
  // The superadmin's users panel; the server decides who sees it (`adminRoutes.ts`).
  if (window.location.pathname === '/admin') return sesion.credential.jwt ? <AdminUsersScreen jwt={sesion.credential.jwt} /> : null;
  return (
    <>
      <Shell
        credential={sesion.credential}
        refrescoResuelto={sesion.refrescoResuelto}
        logout={sesion.logout}
        manejar401={sesion.manejar401}
        hayVersionNueva={hayVersionNueva}
      />
      {/* Outside the Shell: a video in the mini player outlives the chat it came from (pending 14). */}
      <MiniVideoPlayer />
    </>
  );
}
