import { useState } from 'react';
import { Pressable } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useColores } from '../../ui/tema';
import { QuickActionsSheet } from './QuickActionsSheet';
import type { ChatCommands } from './useChatCommands';

/**
 * The ⚡ of a chat (R31/10, like Slack's shortcuts button): backlog 111 took the
 * apps' actions out of the clip, and the ones an admin turns on for a channel
 * or for the chat with the app were left with no place. It only shows when
 * this chat has one; the form and its answer open in the chat as always.
 */
export function ChatQuickActions(props: { commands: ChatCommands }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const { actions, appAnswers } = props.commands;
  if (!actions.length) return null;
  return (
    <>
      <Pressable testID="btn-acciones-chat" accessibilityLabel="Acciones de las apps" onPress={() => setOpen(true)} android_ripple={{ color: colors.outline, borderless: true, radius: 20 }} className="h-11 w-11 items-center justify-center">
        <Zap size={20} color={colors.warning} fill={colors.warning} />
      </Pressable>
      <QuickActionsSheet
        visible={open}
        title="Acciones de las apps"
        hint="Las que el admin encendió en este chat."
        rows={actions}
        loading={false}
        failed={false}
        emptyText=""
        testID="hoja-acciones-chat"
        testPrefix="accion-chat"
        onRetry={() => undefined}
        onPick={(row) => {
          setOpen(false);
          void appAnswers.runAction(row);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
