import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Play, Send, Vibrate } from 'lucide-react-native';
import { WINKS, type Wink, type WinkGroup, type WinkId } from '@lilachat/shared';
import { WinkCharacter } from './WinkCharacter';
import { replayWink } from './nudge';
import { useColores } from '../ui/tema';

const COLUMNS = 3;
const SIDE_PADDING = 16;
const GAP = 8;
/** The local preview has no message yet: any fixed seed. */
const PREVIEW_SEED = 0;
const GROUPS: { group: WinkGroup; title: string }[] = [
  { group: 'characters', title: 'Personajes' },
  { group: 'site', title: 'Obra y pistas' },
  { group: 'emoji', title: 'Emojis' },
];
/** A character in its tile (dp). */
const TILE_CHARACTER = 46;

/**
 * The «Guiños» tab of the emoji panel (design `m-02-guinos-panel`): tapping a
 * wink previews it over the chat and shows «Enviar» under its name. Three
 * groups (José, 21/10): the full-body characters, the construction ones and
 * the first emoji winks. Each tile shows what the other person will see.
 */
export function WinkPanel(props: { recipient: string; onSend: (wink: WinkId) => void; onNudge?: () => void }) {
  const colors = useColores();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<WinkId | null>(null);
  const tile = (width - SIDE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const pick = (wink: WinkId) => {
    setSelected(wink);
    replayWink(PREVIEW_SEED, wink);
  };
  return (
    <ScrollView testID="panel-guinos" contentContainerStyle={{ padding: SIDE_PADDING, paddingBottom: 24 }}>
      <View className="mb-3 flex-row items-end gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Guiños</Text>
          <Text className="mt-0.5 text-[13px] text-on-surface-variant" numberOfLines={2}>
            Una animación a pantalla completa para {props.recipient}
          </Text>
        </View>
        {selected ? (
          <Pressable testID="guino-vista-previa" onPress={() => replayWink(PREVIEW_SEED, selected)} className="h-10 flex-row items-center gap-1.5 rounded-full border border-outline/20 px-3">
            <Play size={14} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-on-surface">Vista previa</Text>
          </Pressable>
        ) : null}
      </View>
      {props.onNudge ? (
        <Pressable testID="panel-zumbido" onPress={props.onNudge} className="mb-4 min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Vibrate size={20} color={colors.primary} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-semibold text-on-surface">Zumbido</Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>Sacude la pantalla de {props.recipient}</Text>
          </View>
        </Pressable>
      ) : null}
      {GROUPS.map(({ group, title }) => (
        <View key={group} className="mb-4">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{title}</Text>
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {WINKS.filter((wink) => wink.group === group).map((wink) => (
              <WinkTile key={wink.id} wink={wink} width={tile} active={wink.id === selected} onPick={() => pick(wink.id)} onSend={() => props.onSend(wink.id)} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function WinkTile(props: { wink: Wink; width: number; active: boolean; onPick: () => void; onSend: () => void }) {
  const colors = useColores();
  const { wink } = props;
  return (
    <Pressable testID={`guino-${wink.id}`} onPress={props.onPick} style={{ width: props.width }} className={`items-center rounded-2xl bg-surface px-2 py-3 ${props.active ? 'border-2 border-primary' : 'border border-outline/15'}`}>
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10">
        {wink.kind === 'character' ? <WinkCharacter wink={wink} size={TILE_CHARACTER} /> : <Text style={{ fontSize: 30 }}>{wink.hero}</Text>}
      </View>
      <Text className="mt-2 min-h-[34px] text-center text-[13px] font-semibold leading-[17px] text-on-surface" numberOfLines={2}>
        {wink.name}
      </Text>
      {props.active ? (
        <Pressable testID={`enviar-guino-${wink.id}`} onPress={props.onSend} className="mt-2 h-10 w-full flex-row items-center justify-center gap-1.5 rounded-full bg-primary">
          <Send size={14} color={colors['on-primary']} />
          <Text className="text-[13px] font-bold text-on-primary">Enviar</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
