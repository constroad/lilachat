import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react-native';
import { itemIsOn, itemKey, itemPlacesLine, sameItemSetting, type AppItemRow, type AppItemSetting, type ClientWorkspaceMember } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { saveAppItems, type AppItems } from '../spacesApi';
import { AppItemEditor } from './AppItemEditor';
import { Card, type Status } from './AppSettingsSections';

type SectionProps = {
  jwt: string;
  spaceId: string;
  appId: string;
  state: AppItems;
  members: ClientWorkspaceMember[];
  onSaved: (state: AppItems) => void;
  onProgram: (row: AppItemRow) => void;
};

const settingOf = (row: AppItemRow): AppItemSetting => ({ global: row.global, channels: row.channels, direct: row.direct, who: row.who });

/**
 * «Comandos y acciones» (design d-01; José, 23/10 and 28/10): everything starts
 * off; each command or action opens to turn it on in the ⚡, the channels or
 * the 1:1 with the app, and to pick who uses it. The admin saves one at a time;
 * the server applies it to everyone at once. The rest see what is on.
 */
export function AppItemsSection(props: SectionProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, AppItemRow>>({});
  const channelNames = new Map(props.state.channels.map((channel) => [channel.id, channel.name]));
  const [status, setStatus] = useState<(Status & { key: string }) | null>(null);

  const save = async (row: AppItemRow) => {
    const key = itemKey(row.kind, row.key);
    setStatus({ key, busy: true });
    const result = await saveAppItems(props.jwt, props.spaceId, props.appId, { [key]: settingOf(row) });
    if (!result.ok) return setStatus({ key, busy: false, line: result.message ?? 'No se pudo guardar.', error: true });
    props.onSaved(result.data);
    setEdits(({ [key]: _saved, ...rest }) => rest);
    setStatus({ key, busy: false, line: 'Guardado. Ya se ve así en el espacio.' });
  };
  return (
    <Card testID="comandos-y-acciones" Icon={SlidersHorizontal} kicker="Comandos y acciones" lead={props.state.canEdit ? 'Todo empieza apagado. Enciende lo que quieras y elige quién lo usa.' : 'Lo que está encendido y quién lo usa. Solo los admins lo cambian.'}>
      {props.state.items.map((saved) => {
        const key = itemKey(saved.kind, saved.key);
        const row = edits[key] ?? saved;
        return (
          <View key={key} className="mt-3 border-t border-outline/10 pt-3">
            <ItemHeader row={row} places={itemPlacesLine(settingOf(row), channelNames)} open={open === key} onToggle={() => setOpen(open === key ? null : key)} />
            {open === key ? (
              <AppItemEditor
                row={row}
                channels={props.state.channels}
                members={props.members}
                canEdit={props.state.canEdit}
                changed={!sameItemSetting(settingOf(saved), settingOf(row))}
                status={status?.key === key ? status : null}
                onChange={(change) => setEdits((before) => ({ ...before, [key]: { ...row, ...change } }))}
                onSave={() => void save(row)}
                onProgram={() => props.onProgram(row)}
              />
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

function ItemHeader(props: { row: AppItemRow; places: string; open: boolean; onToggle: () => void }) {
  const colors = useColores();
  const { row } = props;
  const on = itemIsOn(row);
  const Chevron = props.open ? ChevronUp : ChevronDown;
  return (
    <Pressable testID={`item-${row.key}`} accessibilityState={{ expanded: props.open }} onPress={props.onToggle} className="min-h-[48px] flex-row items-center gap-2">
      <View className="min-w-0 flex-1">
        <Text className="text-[17px] font-bold text-on-surface" numberOfLines={1}>{row.name}</Text>
        <Text className="text-[13px] text-on-surface-variant" numberOfLines={2}>{row.kind === 'command' ? 'Comando' : 'Acción'}{row.description ? ` · ${row.description}` : ''}</Text>
        <Text testID={`lugares-${row.key}`} className="text-[12px] text-on-surface-variant" numberOfLines={2}>{props.places}</Text>
      </View>
      <View testID={`estado-${row.key}`} className={`rounded-full border px-2.5 py-0.5 ${on ? 'border-en-linea/30 bg-en-linea/10' : 'border-outline/25 bg-background'}`}>
        <Text className={`text-[11px] font-bold uppercase ${on ? 'text-en-linea' : 'text-on-surface-variant'}`}>{on ? 'Encendido' : 'Apagado'}</Text>
      </View>
      <Chevron size={18} color={colors['on-surface-variant']} />
    </Pressable>
  );
}
