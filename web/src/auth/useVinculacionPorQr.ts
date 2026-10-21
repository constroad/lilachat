import { useCallback, useEffect, useRef, useState } from 'react';
import type { Credential } from '../api';
import { usePestanaVisible } from '../pwa/usePestanaVisible';
import { esperarVinculacion, iniciarVinculacion, rotarCodigo, type Vinculacion } from './vinculacionPorQr';

export type ServicioDeVinculacion = {
  iniciar: typeof iniciarVinculacion;
  rotar: typeof rotarCodigo;
  esperar: typeof esperarVinculacion;
};

export type EstadoDelQr =
  | { fase: 'cargando' }
  | { fase: 'mostrando'; token: string; rotarCadaMs: number }
  | { fase: 'vencido' }
  | { fase: 'entrando' }
  | { fase: 'error'; motivo: string };

const SERVICIO_REAL: ServicioDeVinculacion = { iniciar: iniciarVinculacion, rotar: rotarCodigo, esperar: esperarVinculacion };
/** Sin red, la espera se reintenta sola a este ritmo (con la pestaña al frente). */
const REINTENTO_SIN_RED_MS = 3_000;

/**
 * La pantalla del QR (W5): pide la vinculación, rota el token y espera la
 * aprobación del teléfono con long-poll. TODO se pausa con la pestaña oculta:
 * ni rotaciones ni esperas que nadie mira (el polling es deuda facturable).
 * Si el teléfono aprueba con la pestaña oculta, la aprobación espera en el
 * server y se canjea al volver.
 */
export function useVinculacionPorQr(params: { onReady: (credential: Credential) => void; mantener: boolean; servicio?: ServicioDeVinculacion }) {
  const servicio = params.servicio ?? SERVICIO_REAL;
  const visible = usePestanaVisible();
  const [estado, setEstado] = useState<EstadoDelQr>({ fase: 'cargando' });
  const [vinculacion, setVinculacion] = useState<Vinculacion | null>(null);
  const emitidoEn = useRef(0);
  const mantener = useRef(params.mantener);
  mantener.current = params.mantener;
  const onReady = useRef(params.onReady);
  onReady.current = params.onReady;

  const generar = useCallback(async () => {
    setEstado({ fase: 'cargando' });
    setVinculacion(null);
    const inicio = await servicio.iniciar();
    if (!inicio.ok) return setEstado({ fase: 'error', motivo: inicio.motivo });
    emitidoEn.current = Date.now();
    setVinculacion(inicio.vinculacion);
    setEstado({ fase: 'mostrando', token: inicio.vinculacion.token, rotarCadaMs: inicio.vinculacion.rotarCadaMs });
  }, [servicio]);

  useEffect(() => {
    void generar();
  }, [generar]);

  /** Vencido, rechazado o entrando: sin vinculación no rota ni espera nada más. */
  const terminar = useCallback((final: EstadoDelQr) => {
    setVinculacion(null);
    setEstado(final);
  }, []);

  useRotacion({ vinculacion, visible, servicio, emitidoEn, setEstado, terminar });
  useEsperaDeAprobacion({ vinculacion, visible, servicio, mantener, onReady, terminar });

  return { estado, generar };
}

type Comun = { vinculacion: Vinculacion | null; visible: boolean; servicio: ServicioDeVinculacion; terminar: (final: EstadoDelQr) => void };

/** Un token nuevo cada `rotarCadaMs`; al volver a la pestaña, uno nuevo si el que hay ya es viejo. */
function useRotacion({
  vinculacion,
  visible,
  servicio,
  emitidoEn,
  setEstado,
  terminar,
}: Comun & { emitidoEn: React.MutableRefObject<number>; setEstado: (estado: EstadoDelQr) => void }) {
  useEffect(() => {
    if (!vinculacion || !visible) return;
    let vigente = true;
    const rotar = async () => {
      const rotado = await servicio.rotar(vinculacion);
      if (!vigente) return;
      if ('token' in rotado) {
        emitidoEn.current = Date.now();
        setEstado({ fase: 'mostrando', token: rotado.token, rotarCadaMs: vinculacion.rotarCadaMs });
      } else if (rotado.vencida) terminar({ fase: 'vencido' });
    };
    if (Date.now() - emitidoEn.current >= vinculacion.rotarCadaMs) void rotar();
    const reloj = setInterval(() => void rotar(), vinculacion.rotarCadaMs);
    return () => {
      vigente = false;
      clearInterval(reloj);
    };
  }, [vinculacion, visible, servicio, emitidoEn, setEstado, terminar]);
}

/** El long-poll: se repite mientras diga «pendiente»; se corta al ocultar la pestaña. */
function useEsperaDeAprobacion({
  vinculacion,
  visible,
  servicio,
  mantener,
  onReady,
  terminar,
}: Comun & { mantener: React.MutableRefObject<boolean>; onReady: React.MutableRefObject<(credential: Credential) => void> }) {
  useEffect(() => {
    if (!vinculacion || !visible) return;
    const corte = new AbortController();
    void (async () => {
      while (!corte.signal.aborted) {
        const resultado = await servicio.esperar(vinculacion, mantener.current, corte.signal);
        if (corte.signal.aborted || resultado.estado === 'pendiente') continue;
        if (resultado.estado === 'vinculada') {
          terminar({ fase: 'entrando' });
          return onReady.current(resultado.credential);
        }
        if (resultado.estado === 'vencida') return terminar({ fase: 'vencido' });
        if (!resultado.sinRed) return terminar({ fase: 'error', motivo: resultado.motivo });
        await new Promise((listo) => setTimeout(listo, REINTENTO_SIN_RED_MS));
      }
    })();
    return () => corte.abort();
  }, [vinculacion, visible, servicio, mantener, onReady, terminar]);
}
