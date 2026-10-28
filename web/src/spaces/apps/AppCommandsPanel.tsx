import { useCallback, useEffect, useState } from 'react';
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
    void appItems(props.jwt, props.spaceId, props.appId).then((result) => {
      if (alive && result.ok) setItems(result.data);
    });
    void spaceMembers(props.jwt, props.spaceId).then((result) => {
      if (alive && result.ok) setMembers(result.data.members);
    });
    readSchedules();
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId, readSchedules]);

  const commandOf = (command: string) => items?.items.find((row) => row.kind === 'command' && row.key === command);
  const fromSuggestion = (suggestion: SuggestedSchedule) => {
    const row = commandOf(suggestion.command);
    setDraft({ ...suggestion, shareable: row?.shareable !== false });
  };
  return (
    <>
      {items && items.items.length ? <AppItemsSection {...props} state={items} members={members} onSaved={setItems} onProgram={(row) => setDraft({ command: row.key, shareable: row.shareable !== false })} /> : null}
      {schedules ? <AppSchedulesSection {...props} state={schedules} onChanged={readSchedules} onSuggestion={fromSuggestion} /> : null}
      {draft && items ? <ScheduleSheet {...props} draft={draft} channels={items.channels} onClose={() => setDraft(null)} onCreated={() => { setDraft(null); readSchedules(); }} /> : null}
    </>
  );
}
