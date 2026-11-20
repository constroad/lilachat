import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { markGroupsOf, observationRowsOf, type MapPick, type WorkMap } from '@lilachat/shared';
import { StatusPill } from './MapCardView';
import { KICKER } from './WorkMapPanel';

const ROW = 'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-variant disabled:cursor-default disabled:hover:bg-transparent';

function MarkList(props: { map: WorkMap; onPick: (pick: MapPick) => void }) {
  const groups = useMemo(() => markGroupsOf(props.map.marks ?? []), [props.map.marks]);
  if (!groups.length) return null;
  return (
    <section data-testid="mapa-dibujos" className="pt-4">
      <p className={`${KICKER} px-1 pb-2`}>Dibujos</p>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.type} className="rounded-[10px] border-[1.5px] border-outline/15 bg-surface p-2">
            <p className="flex items-center justify-between px-2 pb-1 pt-1 text-[13px] font-bold text-on-surface">{group.label}<span className="font-mono text-[12px] text-on-surface-variant">{group.count}</span></p>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button type="button" data-testid={`mapa-dibujo-${item.id}`} onClick={() => props.onPick({ kind: 'mark', id: item.id })} className={ROW}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-on-surface">{item.name}</span>
                      {item.note ? <span className="block truncate text-[12px] text-on-surface-variant">{item.note}</span> : null}
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-on-surface-variant" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ObservationList(props: { map: WorkMap; onPick: (pick: MapPick) => void }) {
  const rows = useMemo(() => observationRowsOf(props.map.observations ?? []), [props.map.observations]);
  if (!rows.length) return null;
  return (
    <section data-testid="mapa-observaciones" className="pt-4">
      <p className={`${KICKER} px-1 pb-2`}>Observaciones</p>
      <ul className="space-y-1 rounded-[10px] border-[1.5px] border-outline/15 bg-surface p-2">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" data-testid={`mapa-observacion-${row.id}`} onClick={() => props.onPick({ kind: 'observation', id: row.id })} className={ROW}>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] font-semibold text-on-surface">{row.text}</span>
                <span className="block text-[12px] text-on-surface-variant">{row.placed ? row.photos : `${row.photos} · sin ubicación`}</span>
              </span>
              <StatusPill status={row.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Dibujos» by type and «Observaciones», open first (José 19/11); a tap flies the map there. */
export function WorkMapItems(props: { map: WorkMap; onPick: (pick: MapPick) => void }) {
  return (
    <>
      <MarkList map={props.map} onPick={props.onPick} />
      <ObservationList map={props.map} onPick={props.onPick} />
    </>
  );
}
