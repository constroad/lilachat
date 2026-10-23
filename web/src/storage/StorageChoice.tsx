import { HardDrive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes } from '@lilachat/shared';
import { borrarBaseDe } from '../local/baseLocal';

/**
 * «Almacenamiento» in the web's settings (pending 13): how much this browser
 * keeps (the copy of the chats for the first paint and without signal) and
 * a way to delete it. The chats come back from the server after reloading.
 */
export function StorageChoice({ userId, reload = () => window.location.reload() }: { userId: string; reload?: () => void }) {
  const [usage, setUsage] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => setUsage(estimate.usage ?? 0)).catch(() => setUsage(null));
  }, []);
  const deleteCopy = async () => {
    if (!window.confirm('Se borra la copia de tus chats en este navegador. Al recargar se vuelven a traer del servidor.')) return;
    await borrarBaseDe(userId);
    reload();
  };
  return (
    <div>
      <button type="button" data-testid="btn-almacenamiento" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
        <HardDrive size={16} />
        <span className="min-w-0 flex-1">
          Almacenamiento
          {usage !== null ? <span className="block text-[12px] text-on-surface-variant">{formatBytes(usage)} en este navegador</span> : null}
        </span>
      </button>
      {open ? (
        <button type="button" data-testid="btn-borrar-copia-local" onClick={() => void deleteCopy()} className="mb-1 ml-9 rounded-lg border border-error/30 px-3 py-1.5 text-[12px] font-semibold text-error hover:bg-error/5">
          Borrar la copia de este navegador
        </button>
      ) : null}
    </div>
  );
}
