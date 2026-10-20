import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { resumenDeReacciones } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useConversacion } from '../contextoDeLaConversacion';
import type { MensajeEnPantalla } from '../types';

const TODAS = 'todas';
/** Cuántos emojis distintos entran en la pastilla antes de resumir con «+N». */
const EMOJIS_VISIBLES = 3;

/**
 * Las reacciones bajo la burbuja (20/10): «👍 2 · ❤️ 1». Al hacer clic, quién
 * reaccionó, con pestañas por emoji; mi fila dice «Clic para quitar».
 */
export function PastillaDeReacciones({ mensaje, mio }: { mensaje: MensajeEnPantalla; mio: boolean }) {
  const { yo, nombres, detalle, onReaccionar } = useConversacion();
  const [pestana, setPestana] = useState(TODAS);
  const reacciones = mensaje.reacciones ?? [];
  const grupos = resumenDeReacciones(reacciones, yo);
  if (grupos.length === 0 || mensaje.deletedAt) return null;
  const visibles = grupos.slice(0, EMOJIS_VISIBLES);
  const resto = reacciones.length - visibles.reduce((suma, grupo) => suma + grupo.cuantos, 0);
  const filas = [...(pestana === TODAS ? reacciones : reacciones.filter((una) => una.emoji === pestana))].sort((a, b) => Number(b.userId === yo) - Number(a.userId === yo));
  const nombreDe = (id: string) => (id === yo ? 'Tú' : (nombres.get(id) ?? 'Alguien'));
  return (
    <DropdownMenu.Root modal={false} onOpenChange={(abierto) => abierto && setPestana(TODAS)}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-testid={`pastilla-reacciones-${mensaje.seq}`}
          aria-label={`Reacciones: ${grupos.map((grupo) => `${grupo.emoji} ${grupo.cuantos}`).join(', ')}`}
          className={`-mt-2 flex min-h-[26px] items-center gap-1 rounded-full border bg-surface px-2 text-[13px] shadow-sm ${mio ? 'mr-2' : 'ml-2'} ${grupos.some((grupo) => grupo.mia) ? 'border-primary/30' : 'border-outline/15'}`}
        >
          {visibles.map((grupo, indice) => (
            <span key={grupo.emoji} className="flex items-center gap-0.5">
              {indice > 0 ? <span className="text-on-surface-variant">·</span> : null}
              <span>{grupo.emoji}</span>
              {grupo.cuantos > 1 || grupos.length > 1 ? <span className="text-[12px] text-on-surface">{grupo.cuantos}</span> : null}
            </span>
          ))}
          {resto > 0 ? <span className="text-[12px] text-on-surface-variant">+{resto}</span> : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={mio ? 'end' : 'start'} sideOffset={6} onCloseAutoFocus={(evento) => evento.preventDefault()} className="z-40 w-[300px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
          <p className="px-3 pb-1 pt-2 text-sm font-semibold">Reacciones</p>
          <div className="flex gap-4 border-b border-outline/15 px-3">
            {[{ clave: TODAS, texto: 'Todas', cuantos: reacciones.length }, ...grupos.map((grupo) => ({ clave: grupo.emoji, texto: grupo.emoji, cuantos: grupo.cuantos }))].map((tab) => (
              <button key={tab.clave} type="button" data-testid={`pestana-reacciones-${tab.clave}`} onClick={() => setPestana(tab.clave)} className={`flex min-h-[36px] items-center gap-1 border-b-2 text-sm ${pestana === tab.clave ? 'border-primary font-semibold text-primary' : 'border-transparent'}`}>
                {tab.texto} <span className="text-[12px] text-on-surface-variant">{tab.cuantos}</span>
              </button>
            ))}
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filas.map((una) => {
              const mia = una.userId === yo;
              return (
                <DropdownMenu.Item
                  key={una.userId}
                  data-testid={`fila-reaccion-${mia ? 'mia' : una.userId}`}
                  disabled={!mia || !onReaccionar}
                  onSelect={() => onReaccionar?.(mensaje.seq, null)}
                  className="flex min-h-[48px] cursor-pointer select-none items-center gap-3 rounded-lg px-3 outline-none data-[disabled]:cursor-default data-[highlighted]:bg-background"
                >
                  <Avatar name={nombreDe(una.userId)} foto={detalle?.miembros.get(una.userId)?.foto} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{nombreDe(una.userId)}</span>
                    {mia ? <span className="block text-[12px] text-on-surface-variant">Clic para quitar</span> : null}
                  </span>
                  <span className="text-[22px]">{una.emoji}</span>
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
