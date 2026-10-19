import { useEffect, useState } from 'react';

type EventoDeInstalacion = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/**
 * «Instalar Lilachat en esta computadora» (W4): el navegador ofrece instalarla
 * cuando cumple los requisitos (manifest, íconos, service worker). Se guarda
 * su evento y se usa cuando la persona lo pide desde Ajustes, nunca solo.
 */
export function useInstalarApp(): { puedeInstalar: boolean; instalar: () => Promise<void> } {
  const [evento, setEvento] = useState<EventoDeInstalacion | null>(null);
  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoDeInstalacion);
    };
    const instalada = () => setEvento(null);
    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', instalada);
    return () => {
      window.removeEventListener('beforeinstallprompt', guardar);
      window.removeEventListener('appinstalled', instalada);
    };
  }, []);
  return {
    puedeInstalar: Boolean(evento),
    instalar: async () => {
      if (!evento) return;
      await evento.prompt();
      await evento.userChoice;
      setEvento(null);
    },
  };
}
