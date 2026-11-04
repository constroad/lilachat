import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppSchedules, ClientWorkspaceMember, SuggestedSchedule } from '@lilachat/shared';
import { appItems, appSchedules, spaceMembers, type AppItems } from '../spacesApi';
import { AppItemsSection } from './AppItemsSection';
import { AppSchedulesSection } from './AppSchedulesSection';
import { ScheduleSheet, type ScheduleDraft } from './ScheduleSheet';

type PanelProps = { jwt: string; spaceId: string; appId: string; appName: string };

/**
 * The «Comandos» tab of an installed app (designs d-01 and d-03; agentes
 * COMANDOS-Y-HORARIOS, 28/10): where each command and action works and who
 * uses it, then its «Horarios». «Programar» (d-02) opens from a command or a
 * suggestion of the app. It reads once and passes the channels down.
 */
export function AppCommandsPanel(props: PanelProps) {
  const [items, setItems] = useState<AppItems | null>(null);
  const [itemsFailed, setItemsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [schedules, setSchedules] = useState<AppSchedules | null>(null);
  const [members, setMembers] = useState<ClientWorkspaceMember[]>([]);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);

  const readSchedules = useCallback(() => {
    void appSchedules(props.jwt, props.spaceId, props.appId).then((result) => {
      if (result.ok) setSchedules(result.data);
    });
  }, [props.jwt, props.spaceId, props.appId]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setItemsFailed(false);
    void appItems(props.jwt, props.spaceId, props.appId).then((result) => {
      if (!alive) return;
      if (result.ok) setItems(result.data);
      else setItemsFailed(true);
    });
    void spaceMembers(props.jwt, props.spaceId).then((result) => {
      if (alive && result.ok) setMembers(result.data.members);
    });
    readSchedules();
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId, readSchedules, attempt]);

  const fromSuggestion = (suggestion: SuggestedSchedule) => {
    const row = items?.items.find((one) => one.kind === 'command' && one.key === suggestion.command);
    setDraft({ ...suggestion, shareable: row?.shareable !== false });
  };
  return (
    <>
      {itemsFailed ? (
        <View accessibilityRole="alert" className="flex-row items-center justify-between gap-3 rounded-xl border border-outline/15 px-3 py-2.5">
          <Text className="flex-1 text-[14px] text-on-surface">No se pudieron leer los comandos.</Text>
          <Pressable testID="comandos-reintentar" hitSlop={8} onPress={() => setAttempt((count) => count + 1)} className="min-h-[44px] justify-center">
            <Text className="text-[14px] font-semibold text-primary">Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
      {items && items.items.length ? <AppItemsSection {...props} state={items} members={members} onSaved={setItems} onProgram={(row) => setDraft({ command: row.key, shareable: row.shareable !== false })} /> : null}
      {schedules ? <AppSchedulesSection {...props} state={schedules} onChanged={readSchedules} onSuggestion={fromSuggestion} /> : null}
      {draft && items ? <ScheduleSheet {...props} draft={draft} channels={items.channels} onClose={() => setDraft(null)} onCreated={() => { setDraft(null); readSchedules(); }} /> : null}
    </>
  );
}
