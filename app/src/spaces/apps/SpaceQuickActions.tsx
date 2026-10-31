import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Zap } from 'lucide-react-native';
import { formKeyOf, quickActionRows, type CommandGroup } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { getSocket } from '../../chat/socketClient';
import { QuickActionsSheet } from '../../chat/commands/QuickActionsSheet';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { spaceCommands } from '../../chat/commands/commandsApi';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';

/**
 * The space's ⚡ (R160, design e-30; José, 23/10: it belongs to the space,
 * not only to a channel): the actions and global commands of every installed app,
 * without entering a channel, like Slack's global shortcuts. The answer only I
 * see shows in the sheet; a late one reopens it.
 */
export function SpaceQuickActions(props: { jwt: string; spaceId: string; spaceName: string; myName?: string }) {
  const { jwt, spaceId } = props;
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<CommandGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const scope = useMemo(() => ({ workspaceId: spaceId }), [spaceId]);
  const answers = useAppAnswers({ jwt, scope });
  const rows = useMemo(() => quickActionRows(groups ?? []), [groups]);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await spaceCommands(jwt, spaceId, 'space');
    if (result.ok) setGroups(result.data.groups);
    else setFailed(true);
  }, [jwt, spaceId]);
  useEffect(() => {
    setGroups(null);
  }, [spaceId]);
  const openRef = useRef(open);
  openRef.current = open;
  // A manifest or the admin's switches changed: the list already read is stale.
  // With the sheet open it is read again at once (José, 23/10: skeletons that never loaded).
  useEffect(() => {
    const socket = getSocket();
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId !== spaceId) return;
      setGroups(null);
      if (openRef.current) void load();
    };
    socket?.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket?.off('workspace.apps.changed', onAppsChanged);
    };
  }, [spaceId, load]);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = answers.answers.filter((answer) => answer.state === 'answered' && !seen.current.has(answer.commandId));
    fresh.forEach((answer) => seen.current.add(answer.commandId));
    if (fresh.length) setOpen(true);
  }, [answers.answers]);

  const show = () => {
    setOpen(true);
    if (!groups) void load();
  };
  return (
    <>
      <Pressable testID="btn-acciones-espacio" accessibilityLabel="Acciones rápidas" onPress={show} className="h-11 w-11 items-center justify-center rounded-full bg-warning/10">
        <Zap size={20} color={colors.warning} fill={colors.warning} />
      </Pressable>
      <QuickActionsSheet
        visible={open && !answers.openForm}
        title={`Acciones rápidas · ${props.spaceName}`}
        hint="Sin entrar a un canal. Lo que registres llega al canal que eligió el admin."
        rows={rows}
        loading={groups === null && !failed}
        failed={failed}
        emptyText={`Las apps de ${props.spaceName} todavía no tienen acciones aquí. Un admin las habilita en el detalle de cada app.`}
        testID="hoja-acciones-espacio"
        testPrefix="accion-espacio"
        footer="También con / en cualquier canal"
        onRetry={() => void load()}
        onPick={(row) => void answers.runAction(row)}
        onClose={() => setOpen(false)}
      >
        <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={jwt} embedded />
      </QuickActionsSheet>
      {answers.openForm ? (
        <AppFormSheet key={formKeyOf(answers.openForm)} answer={answers.openForm} personName={props.myName} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(photo, stamp) => answers.uploadPhoto(answers.openForm!.commandId, photo, stamp)} onRefresh={(draft) => answers.refreshForm(answers.openForm!, draft)} onPreview={(draft) => answers.previewForm(answers.openForm!, draft)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </>
  );
}
