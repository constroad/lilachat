import { RefreshCw } from 'lucide-react';
import { useNewWebVersion } from './newVersion';

/** «Hay una versión nueva», like the app's band (backlog 32): reloading brings it. */
export function NewVersionBand() {
  const available = useNewWebVersion();
  if (!available) return null;
  return (
    <div data-testid="banda-version-nueva" role="status" className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5">
      <RefreshCw size={16} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 text-sm">Hay una versión nueva de Lilachat.</span>
      <button type="button" data-testid="btn-recargar-version" onClick={() => window.location.reload()} className="h-9 shrink-0 rounded-full bg-primary px-4 text-[13px] font-bold text-on-primary">
        Recargar
      </button>
    </div>
  );
}
