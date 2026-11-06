import { useState } from 'react';
import { Pressable } from 'react-native';
import { Zap } from 'lucide-react-native';
import { commandToWrite } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { QuickActionsSheet } from './QuickActionsSheet';
import type { ChatCommands } from './useChatCommands';

/**
 * The ⚡ of a chat (R31/10, like Slack's shortcuts button): the apps' actions and
 * commands in one list (José 06/11: the ⚡ and a «/» beside it showed different
 * things and took the field's room). It only shows when this chat has one. A
 * command that needs its text goes to the field; the rest run from here.
 */
export function ChatQuickActions(props: { commands: ChatCommands; onWriteCommand: (text: string) => void }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const { actions, appAnswers } = props.commands;
  if (!actions.length) return null;
  return (
    <>
      <Pressable testID="btn-acciones-chat" accessibilityLabel="Acciones y comandos" onPress={() => setOpen(true)} android_ripple={{ color: colors.outline, borderless: true, radius: 20 }} className="h-11 w-11 items-center justify-center">
        <Zap size={20} color={colors.warning} fill={colors.warning} />
      </Pressable>
      <QuickActionsSheet
        visible={open}
        title="Acciones y comandos"
        hint="Los disponibles para ti en este chat."
        rows={actions}
        loading={false}
        failed={false}
        emptyText=""
        testID="hoja-acciones-chat"
        testPrefix="accion-chat"
        onRetry={() => undefined}
        onPick={(row) => {
          setOpen(false);
          const line = commandToWrite(row);
          if (line) props.onWriteCommand(line);
          else void appAnswers.runAction(row);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
