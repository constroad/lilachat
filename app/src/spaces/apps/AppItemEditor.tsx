import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Building2, Clock, MessageSquare, Plus, X, Zap, type LucideIcon } from 'lucide-react-native';
import { hasOwnSpacePlace, spacePlaceOf, type AppItemRow, type ClientWorkspaceMember, type ItemChannels, type ItemWho } from '@lilachat/shared';
import { Interruptor } from '../../ui/Interruptor';
import { Segmentado } from '../../ui/Segmentado';
import { useColores } from '../../ui/tema';
import type { AppItems } from '../spacesApi';
import { SaveButton, StatusLine, type Status } from './AppSettingsSections';

type EditorProps = {
  row: AppItemRow;
  channels: AppItems['channels'];
  members: ClientWorkspaceMember[];
  canEdit: boolean;
  changed: boolean;
  status: Status | null;
  onChange: (change: Partial<AppItemRow>) => void;
  onSave: () => void;
  onProgram: () => void;
};

type ChannelsMode = 'all' | 'some' | 'none';
const modeOf = (channels: ItemChannels): ChannelsMode => (Array.isArray(channels) ? 'some' : channels);
const peopleOf = (who: ItemWho) => (who.kind === 'people' ? who.userIds : []);

/** The open row of «Comandos y acciones» (design d-01): where it works, who uses it, «Programar» and its own «Guardar». */
export function AppItemEditor(props: EditorProps) {
  const colors = useColores();
  const { row } = props;
  const picked = Array.isArray(row.channels) ? row.channels : [];
  const mode = modeOf(row.channels);
  return (
    <View className="mt-3 gap-3 rounded-2xl border border-outline/15 bg-background p-3">
      <SwitchRow testID={`global-${row.key}`} Icon={hasOwnSpacePlace(row.kind, row.key) ? Building2 : Zap} label={spacePlaceOf(row.kind, row.key).label} value={row.global} disabled={!props.canEdit} onChange={(global) => props.onChange({ global })} />
      <SwitchRow testID={`directo-${row.key}`} Icon={MessageSquare} label="En el chat con la app" value={row.direct} disabled={!props.canEdit} onChange={(direct) => props.onChange({ direct })} />
      <View className="border-t border-outline/10 pt-3">
        <Text className="mb-2 text-[14px] font-semibold text-on-surface">Canales donde funciona</Text>
        {props.canEdit ? (
          <Segmentado opciones={[{ key: 'all', etiqueta: 'Todos', testID: `canales-${row.key}-all` }, { key: 'some', etiqueta: 'Algunos', testID: `canales-${row.key}-some` }, { key: 'none', etiqueta: 'Ninguno', testID: `canales-${row.key}-none` }]} valor={mode} onCambiar={(next) => props.onChange({ channels: next === 'some' ? [] : next })} />
        ) : <Text className="text-[13px] text-on-surface-variant">{mode === 'all' ? 'En todos los canales' : mode === 'none' ? 'En ningún canal' : `En ${picked.length === 1 ? '1 canal' : `${picked.length} canales`}`}</Text>}
        {mode === 'some' && props.canEdit ? (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {props.channels.map((channel) => {
              const on = picked.includes(channel.id);
              return (
                <Pressable key={channel.id} testID={`canal-${row.key}-${channel.name}`} accessibilityState={{ selected: on }} onPress={() => props.onChange({ channels: on ? picked.filter((id) => id !== channel.id) : [...picked, channel.id] })} className={`min-h-[36px] justify-center rounded-lg border px-3 ${on ? 'border-primary/40 bg-primary/10' : 'border-outline/25'}`}>
                  <Text className={`text-[14px] ${on ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}># {channel.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <WhoPicker {...props} />
      {props.canEdit && row.schedulable ? (
        <Pressable testID={`programar-${row.key}`} onPress={props.onProgram} className="min-h-[44px] flex-row items-center gap-2">
          <Clock size={17} color={colors.primary} />
          <Text className="flex-1 text-[15px] font-semibold text-primary">Programar {row.name} automáticamente</Text>
        </Pressable>
      ) : null}
      {props.canEdit ? <View className="flex-row"><SaveButton testID={`guardar-${row.key}`} disabled={!props.changed} busy={props.status?.busy ?? false} onPress={props.onSave} label={`Guardar cambios de ${row.name}`} /></View> : null}
      {props.status ? <StatusLine status={props.status} /> : null}
    </View>
  );
}

/** «Quién puede usarlo»: admins always; everyone; or some members of the space, picked from its list. */
function WhoPicker(props: EditorProps) {
  const colors = useColores();
  const { row } = props;
  const [adding, setAdding] = useState(false);
  const people = peopleOf(row.who);
  const memberOf = (userId: string) => props.members.find((member) => member.userId === userId);
  const setPeople = (userIds: string[]) => props.onChange({ who: { kind: 'people', userIds } });
  const candidates = props.members.filter((member) => member.userId && !people.includes(member.userId));
  return (
    <View className="border-t border-outline/10 pt-3">
      <Text className="mb-2 text-[14px] font-semibold text-on-surface">Quién puede usarlo</Text>
      {props.canEdit ? (
        <Segmentado opciones={[{ key: 'admins', etiqueta: 'Solo admins', testID: `quien-${row.key}-admins` }, { key: 'everyone', etiqueta: 'Todos', testID: `quien-${row.key}-everyone` }, { key: 'people', etiqueta: 'Algunas', testID: `quien-${row.key}-people` }]} valor={row.who.kind} onCambiar={(kind) => props.onChange({ who: kind === 'people' ? { kind, userIds: people } : { kind } })} />
      ) : <Text className="text-[13px] text-on-surface-variant">{row.who.kind === 'admins' ? 'Solo los admins' : row.who.kind === 'everyone' ? 'Todos los miembros' : 'Algunas personas'}</Text>}
      {row.who.kind === 'people' ? (
        <View className="mt-2 gap-1.5">
          {people.map((userId) => (
            <View key={userId} testID={`persona-${row.key}-${userId}`} className="min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
              <Text className="flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>{memberOf(userId)?.name ?? 'Miembro del espacio'}<Text className="font-normal text-on-surface-variant">{memberOf(userId)?.phone ? ` · ${memberOf(userId)?.phone}` : ''}</Text></Text>
              {props.canEdit ? <Pressable testID={`quitar-persona-${row.key}-${userId}`} accessibilityLabel="Quitar" onPress={() => setPeople(people.filter((one) => one !== userId))} className="h-10 w-10 items-center justify-center"><X size={18} color={colors['on-surface-variant']} /></Pressable> : null}
            </View>
          ))}
          {props.canEdit ? (
            <Pressable testID={`agregar-persona-${row.key}`} onPress={() => setAdding(!adding)} className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40">
              <Plus size={17} color={colors.primary} />
              <Text className="text-[15px] font-semibold text-primary">Agregar persona</Text>
            </Pressable>
          ) : null}
          {adding ? (
            <View className="rounded-xl border border-outline/15 bg-surface">
              {candidates.length ? candidates.map((member) => (
                <Pressable key={member.id} testID={`elegir-persona-${member.userId}`} onPress={() => { setPeople([...people, member.userId!]); setAdding(false); }} className="min-h-[44px] justify-center border-b border-outline/10 px-3">
                  <Text className="text-[15px] text-on-surface" numberOfLines={1}>{member.name ?? member.phone}</Text>
                </Pressable>
              )) : <Text className="px-3 py-2 text-[13px] text-on-surface-variant">Ya están todos los miembros.</Text>}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SwitchRow(props: { testID: string; Icon: LucideIcon; label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const colors = useColores();
  return (
    <View className="min-h-[44px] flex-row items-center gap-3">
      <props.Icon size={18} color={colors.primary} />
      <Text className="flex-1 text-[15px] text-on-surface">{props.label}</Text>
      <Interruptor testID={props.testID} value={props.value} disabled={props.disabled} onValueChange={props.onChange} />
    </View>
  );
}
