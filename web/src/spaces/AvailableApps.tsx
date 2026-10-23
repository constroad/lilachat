import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import type { AvailableApp } from '@lilachat/shared';
import { availableApps } from './spacesApi';

/**
 * The apps an admin can install in this space (agentes, 23/10): «Instalar»
 * opens the app's own page — it asks the company first — with this space
 * already chosen, and comes back to `/instalar-app` to confirm.
 */
export function AvailableApps(props: { jwt: string; spaceId: string }) {
  const [apps, setApps] = useState<AvailableApp[]>([]);
  useEffect(() => {
    void availableApps(props.jwt, props.spaceId).then((result) => setApps(result.ok ? result.data.apps.filter((app) => !app.installed) : []));
  }, [props.jwt, props.spaceId]);
  if (apps.length === 0) return null;
  return (
    <div data-testid="apps-para-instalar" className="mt-4 border-t border-outline/10 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Para instalar</p>
      {apps.map((app) => (
        <div key={app.id} className="mt-3 flex items-center gap-3">
          {app.avatarUrl ? <img src={app.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-on-primary"><Bot size={22} /></span>}
          <span className="min-w-0 flex-1 text-[15px] font-semibold">{app.name}</span>
          <a data-testid={`instalar-${app.id}`} href={app.installUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">Instalar</a>
        </div>
      ))}
    </div>
  );
}
