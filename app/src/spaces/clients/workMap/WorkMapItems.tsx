import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { markGroupsOf, observationRowsOf, type MapPick, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { StatusPill } from './MapCardView';
import { KICKER } from './WorkMapPanel';

const ROW = 'min-h-[48px] flex-row items-center gap-2 rounded-lg px-2 py-1.5';

function MarkList(props: { map: WorkMap; onPick: (pick: MapPick) => void }) {
  const colors = useColores();
  const groups = useMemo(() => markGroupsOf(props.map.marks ?? []), [props.map.marks]);
  if (!groups.length) return null;
  return (
    <View testID="mapa-dibujos" className="pt-4">
      <Text className={`${KICKER} pb-2`}>Dibujos</Text>
      <View className="gap-3">
        {groups.map((group) => (
          <View key={group.type} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-2">
            <View className="flex-row items-center justify-between px-2 py-1">
              <Text className="text-[14px] font-bold text-on-surface">{group.label}</Text>
              <Text className="font-mono text-[13px] text-on-surface-variant">{group.count}</Text>
            </View>
            {group.items.map((item) => (
              <Pressable key={item.id} testID={`mapa-dibujo-${item.id}`} onPress={() => props.onPick({ kind: 'mark', id: item.id })} className={ROW}>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[14px] font-semibold text-on-surface">{item.name}</Text>
                  {item.note ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{item.note}</Text> : null}
                </View>
                <ChevronRight size={16} color={colors['on-surface-variant']} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A map row to lift (José 27/11 «agrega el botón Levantar»): it opens «Levantamiento de observaciones» on it. */
export type LiftRow = { id: string; text: string };

function ObservationList(props: { map: WorkMap; onPick: (pick: MapPick) => void; onLift?: (row: LiftRow) => void }) {
  const rows = useMemo(() => observationRowsOf(props.map.observations ?? []), [props.map.observations]);
  const open = useMemo(() => new Set((props.map.observations ?? []).filter((one) => one.status === 'open').map((one) => one.id)), [props.map.observations]);
  if (!rows.length) return null;
  return (
    <View testID="mapa-observaciones" className="pt-4">
      <Text className={`${KICKER} pb-2`}>Observaciones</Text>
      <View className="gap-1 rounded-xl border-[1.5px] border-outline/15 bg-surface p-2">
        {rows.map((row) => (
          <View key={row.id} className="flex-row items-center gap-2">
            <Pressable testID={`mapa-observacion-${row.id}`} onPress={() => props.onPick({ kind: 'observation', id: row.id })} className={`${ROW} min-w-0 flex-1`}>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={2} className="text-[14px] font-semibold text-on-surface">{row.text}</Text>
                <Text className="text-[13px] text-on-surface-variant">{row.placed ? row.photos : `${row.photos} · sin ubicación`}</Text>
              </View>
              <StatusPill status={row.status} />
            </Pressable>
            {props.onLift && open.has(row.id) ? (
              <Pressable testID={`levantar-${row.id}`} accessibilityRole="button" accessibilityLabel={`Levantar ${row.text}`} onPress={() => props.onLift?.({ id: row.id, text: row.text })} className="min-h-[44px] justify-center rounded-full bg-primary px-3">
                <Text className="text-[13px] font-semibold text-on-primary">Levantar</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** «Dibujos» by type and «Observaciones», open first (José 19/11); a tap opens the full map there. */
export function WorkMapItems(props: { map: WorkMap; onPick: (pick: MapPick) => void; onLift?: (row: LiftRow) => void }) {
  return (
    <View>
      <MarkList map={props.map} onPick={props.onPick} />
      <ObservationList map={props.map} onPick={props.onPick} onLift={props.onLift} />
    </View>
  );
}
