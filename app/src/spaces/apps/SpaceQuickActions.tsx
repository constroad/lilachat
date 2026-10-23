import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X, Zap } from 'lucide-react-native';
import { quickActionRows, type CommandGroup } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { getSocket } from '../../chat/socketClient';
import { AppActionRows } from '../../chat/commands/AppActionRows';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { spaceCommands } from '../../chat/commands/commandsApi';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';

const SHEET_PADDING = 16;
const SHEET_MAX_WIDTH = 560;
const MAX_SCREEN_SHARE = 0.85;

/**
 * The space's ⚡ (R160, design e-30; José, 23/10: «¿no debe estar disponible a
 * nivel de espacio?»): the actions and global commands of every installed app,
 * without entering a channel, like Slack's global shortcuts. The answer only I
 * see shows in the sheet; a late one reopens it.
 */
export function SpaceQuickActions(props: { jwt: string; spaceId: string; spaceName: string; myName?: string }) {
  const { jwt, spaceId } = props;
  const colors = useColores();
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
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
  // A manifest or the admin's switches changed: the list already read is stale.
  useEffect(() => {
    const socket = getSocket();
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId === spaceId) setGroups(null);
    };
    socket?.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket?.off('workspace.apps.changed', onAppsChanged);
    };
  }, [spaceId]);
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
      <Modal visible={open && !answers.openForm} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)} accessibilityLabel="Cerrar" />
        <View testID="hoja-acciones-espacio" className="self-center rounded-t-3xl bg-surface pt-3" style={{ width: Math.min(width, SHEET_MAX_WIDTH), maxHeight: height * MAX_SCREEN_SHARE, paddingBottom: margins.pie + 8 }}>
          <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <View className="flex-row items-center gap-2 px-4">
            <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{`Acciones rápidas · ${props.spaceName}`}</Text>
            <Pressable accessibilityLabel="Cerrar" onPress={() => setOpen(false)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-surface-variant"><X size={18} color={colors['on-surface-variant']} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: SHEET_PADDING, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text className="text-[13px] text-on-surface-variant">Sin entrar a un canal. Lo que registres llega al canal que eligió el admin.</Text>
            <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={jwt} embedded />
            {groups === null && !failed ? [0, 1, 2].map((index) => <View key={index} className="h-16 rounded-2xl bg-surface-variant" />) : null}
            {failed ? <Pressable onPress={() => void load()} className="rounded-xl bg-error/10 px-4 py-3"><Text className="text-[13px] text-error">No se pudieron leer las acciones. Toca para reintentar.</Text></Pressable> : null}
            {groups && rows.length === 0 ? <Text testID="acciones-vacias" className="rounded-2xl border border-outline/15 p-4 text-[14px] text-on-surface-variant">{`Las apps de ${props.spaceName} todavía no tienen acciones aquí. Un admin las habilita en el detalle de cada app.`}</Text> : null}
            {rows.length ? <AppActionRows rows={rows} testPrefix="accion-espacio" onPick={(row) => void answers.runAction(row)} /> : null}
            <Text className="text-center text-[12px] text-on-surface-variant">También con / en cualquier canal</Text>
          </ScrollView>
        </View>
      </Modal>
      {answers.openForm ? (
        <AppFormSheet key={answers.openForm.commandId} answer={answers.openForm} personName={props.myName} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(photo) => answers.uploadPhoto(answers.openForm!.commandId, photo)} onClose={() => answers.showForm(null)} />
      ) : null}
    </>
  );
}
