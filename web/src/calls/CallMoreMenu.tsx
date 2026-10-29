import { useRef, useState, type ReactNode } from 'react';
import { AudioLines, Ellipsis, MonitorUp, MonitorX } from 'lucide-react';
import { useDismiss } from '../ui/useDismiss';
import type { WebCall } from './useWebCall';

/**
 * «Más opciones» of the call (Stitch c-03, pending 3): the noise filter and
 * sharing the screen. A panel over the controls, not more round buttons: six
 * do not fit the 440 px window.
 */
export function CallMoreMenu({ call, button }: { call: WebCall; button: (props: { pressed: boolean; onClick: () => void; children: ReactNode }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(open, panel, () => setOpen(false), { ignore: '[data-testid="btn-mas-opciones"]' });
  return (
    <>
      {button({ pressed: open, onClick: () => setOpen((was) => !was), children: <Ellipsis size={22} /> })}
      {open ? (
        <div ref={panel} role="menu" data-testid="menu-mas-opciones" className="absolute inset-x-4 bottom-full mb-2 rounded-2xl border border-outline/15 bg-surface p-2 shadow-xl">
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-surface-variant">
            <AudioLines size={20} className="text-on-surface-variant" />
            <span className="flex-1">
              <span className="block text-[15px]">Cancelación de ruido</span>
              <span className="block text-[12px] text-on-surface-variant">Quita el ruido de fondo de tu micrófono</span>
            </span>
            <input type="checkbox" role="switch" data-testid="interruptor-cancelacion-ruido" checked={call.noiseSuppression} onChange={() => void call.setNoiseSuppression(!call.noiseSuppression)} className="h-5 w-5 accent-primary" />
          </label>
          {call.canShareScreen ? (
            <button type="button" role="menuitem" data-testid="btn-compartir-pantalla" onClick={() => { setOpen(false); void call.toggleScreenShare(); }} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-surface-variant">
              {call.sharingScreen ? <MonitorX size={20} className="text-on-surface-variant" /> : <MonitorUp size={20} className="text-on-surface-variant" />}
              <span className="text-[15px]">{call.sharingScreen ? 'Dejar de compartir' : 'Compartir pantalla'}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
