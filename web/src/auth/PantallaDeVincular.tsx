import { useState } from 'react';
import { Lock, RotateCw } from 'lucide-react';
import { urlDeVinculacion } from '@lilachat/shared';
import type { Credential } from '../api';
import { Logo } from '../ui/Logo';
import { caminoDelQr } from './caminoDelQr';
import { useVinculacionPorQr, type EstadoDelQr } from './useVinculacionPorQr';

/**
 * Vincular con el teléfono (W5, diseño `w5-web-vincular.png`): pasos a la
 * izquierda, el QR que se renueva solo a la derecha.
 */
const PASOS = [
  <>Abre Lilachat en tu teléfono</>,
  <>
    Toca <b>Ajustes</b> y luego <b>Dispositivos vinculados</b>
  </>,
  <>
    Toca <b>Vincular un dispositivo</b> y apunta la cámara a este código
  </>,
];

export function PantallaDeVincular({ onReady, onUsarTelefono }: { onReady: (credential: Credential) => void; onUsarTelefono: () => void }) {
  const [mantener, setMantener] = useState(true);
  const { estado, generar } = useVinculacionPorQr({ onReady, mantener });
  return (
    <main className="grid min-h-full place-items-center px-4 py-8">
      <div className="w-full max-w-[960px] overflow-hidden rounded-2xl border border-outline/15 bg-surface md:grid md:grid-cols-[3fr_2fr]">
        <section className="flex flex-col p-8 md:p-12">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <span className="text-lg font-bold">Lilachat</span>
          </div>
          <h1 className="mt-8 text-2xl font-bold tracking-tight md:text-[28px]">Usa Lilachat en tu computadora</h1>
          <ol className="mt-8 space-y-5">
            {PASOS.map((paso, indice) => (
              <li key={indice} className="flex gap-4 text-[15px] leading-6">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{indice + 1}</span>
                <span>{paso}</span>
              </li>
            ))}
          </ol>
          <button type="button" data-testid="btn-usar-telefono" onClick={onUsarTelefono} className="mt-8 self-start py-2 text-[15px] font-semibold text-primary hover:underline">
            Entrar con número de teléfono
          </button>
          <p className="mt-auto flex items-start gap-3 border-t border-outline/10 pt-6 text-[13px] leading-5 text-on-surface-variant">
            <Lock size={16} className="mt-0.5 shrink-0" />
            Cierra la sesión de esta computadora desde tu teléfono cuando quieras.
          </p>
        </section>
        <section className="flex flex-col items-center justify-center border-t border-outline/10 bg-primary/[0.03] p-8 md:border-l md:border-t-0 md:p-12">
          <CuadroDelQr estado={estado} onGenerar={() => void generar()} />
          <label className="mt-6 flex w-full max-w-[264px] cursor-pointer items-center gap-3 border-t border-outline/10 pt-5 text-sm">
            <input type="checkbox" data-testid="chk-mantener" checked={mantener} onChange={(evento) => setMantener(evento.target.checked)} className="h-4 w-4 accent-primary" />
            Mantener la sesión iniciada
          </label>
        </section>
      </div>
    </main>
  );
}

function CuadroDelQr({ estado, onGenerar }: { estado: EstadoDelQr; onGenerar: () => void }) {
  return (
    <div className="w-full max-w-[264px]">
      <div data-testid="cuadro-qr" data-fase={estado.fase} className="relative aspect-square w-full rounded-xl border border-outline/15 bg-white p-4">
        {estado.fase === 'mostrando' ? <CodigoQr token={estado.token} /> : null}
        {estado.fase === 'cargando' ? <div className="h-full w-full animate-pulse rounded-lg bg-primary/10" /> : null}
        {estado.fase === 'entrando' ? <p className="grid h-full place-items-center text-sm font-semibold text-primary">Entrando…</p> : null}
        {estado.fase === 'vencido' || estado.fase === 'error' ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="px-2 text-sm text-on-surface-variant">{estado.fase === 'vencido' ? 'El código venció.' : estado.motivo}</p>
              <button type="button" data-testid="btn-generar-qr" onClick={onGenerar} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">
                <RotateCw size={16} />
                {estado.fase === 'vencido' ? 'Generar otro código' : 'Reintentar'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {estado.fase === 'mostrando' ? (
        // La barra se vacía hasta el próximo cambio; `key` la reinicia con cada token.
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-primary/10">
          <div key={estado.token} className="h-full origin-left animate-[vaciar_linear_forwards] rounded-full bg-primary" style={{ animationDuration: `${estado.rotarCadaMs}ms` }} />
        </div>
      ) : (
        <div className="mt-4 h-1" />
      )}
      <p className="mt-3 text-center text-[13px] text-on-surface-variant">El código se renueva solo</p>
    </div>
  );
}

function CodigoQr({ token }: { token: string }) {
  const { modulos, d } = caminoDelQr(urlDeVinculacion(window.location.origin, token));
  return (
    <div className="relative h-full w-full">
      <svg data-testid="codigo-qr" data-token={token} viewBox={`0 0 ${modulos} ${modulos}`} role="img" aria-label="Código QR para vincular" className="h-full w-full" shapeRendering="crispEdges">
        {/* Fixed ink: in dark mode `on-surface` is almost white and a camera cannot read the QR on the white box (26/10). */}
        <path d={d} fill="black" />
      </svg>
      <img src="/icons/icon-192.png" alt="" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-white" />
    </div>
  );
}
