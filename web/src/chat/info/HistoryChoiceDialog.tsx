import { History, MessageSquarePlus } from 'lucide-react';
import { Overlay } from '../../ui/Overlay';

/**
 * Adding someone to a group or channel that already talked (José 30/10):
 * may they read what was said before? «No» shows them only what comes next.
 */
export function HistoryChoiceDialog(props: { name: string; onChoose: (history: boolean) => void; onClose: () => void }) {
  return (
    <Overlay title={`¿${props.name} puede ver el historial?`} onClose={props.onClose}>
      <p className="mb-3 text-sm leading-6 text-on-surface-variant">Elige qué mensajes ve al entrar.</p>
      <div className="flex flex-col gap-2">
        <button type="button" data-testid="historial-todo" onClick={() => props.onChoose(true)} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-outline/20 px-4 text-left hover:bg-background">
          <History size={18} className="text-primary" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Sí, todo</span>
            <span className="block text-[13px] text-on-surface-variant">Lee los mensajes y archivos de antes.</span>
          </span>
        </button>
        <button type="button" data-testid="historial-desde-ahora" onClick={() => props.onChoose(false)} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-outline/20 px-4 text-left hover:bg-background">
          <MessageSquarePlus size={18} className="text-on-surface-variant" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">No, solo desde ahora</span>
            <span className="block text-[13px] text-on-surface-variant">Ve lo que se escriba después de entrar.</span>
          </span>
        </button>
      </div>
    </Overlay>
  );
}
