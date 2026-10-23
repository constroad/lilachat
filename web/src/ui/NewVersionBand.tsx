import { RefreshCw } from 'lucide-react';
import { useWebUpdate } from './webUpdate';

/** «Hay una versión nueva», like the app's band (backlog 32), the only one on screen (pending 61). */
export function NewVersionBand() {
  const { available, updating, update } = useWebUpdate();
  if (!available) return null;
  return (
    <div data-testid="banda-version-nueva" role="status" className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5">
      <RefreshCw size={16} className={`shrink-0 text-primary ${updating ? 'animate-spin' : ''}`} />
      <span className="min-w-0 flex-1 text-sm">{updating ? 'Instalando la versión nueva…' : 'Hay una versión nueva de Lilachat.'}</span>
      <button type="button" data-testid="btn-recargar-version" disabled={updating} onClick={update} className="h-9 shrink-0 rounded-full bg-primary px-4 text-[13px] font-bold text-on-primary disabled:opacity-70">
        {updating ? 'Actualizando…' : 'Recargar'}
      </button>
    </div>
  );
}
