import { useEffect, useState } from 'react';

/** ¿La pestaña está al frente? Lo que sondea o rota algo se pausa si no (W4/W5). */
export function usePestanaVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const alCambiar = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);
  return visible;
}
