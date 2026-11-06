import { useState } from 'react';
import { Zap } from 'lucide-react';
import { commandToWrite } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';
import { AppActionList } from './AppActionList';
import type { ChatCommands } from './useChatCommands';

/**
 * The ⚡ of a chat (R31/10, like Slack's shortcuts button): the apps' actions and
 * commands in one list (José 06/11: the ⚡ and a «/» beside it showed different
 * things and took the field's room). It only shows when this chat has one. A
 * command that needs its text goes to the field; the rest run from here.
 */
export function ChatQuickActions(props: { commands: ChatCommands; onWriteCommand: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const { actions, appAnswers } = props.commands;
  if (!actions.length) return null;
  return (
    <>
      <button type="button" data-testid="btn-acciones-chat" aria-label="Acciones y comandos" title="Acciones y comandos" onClick={() => setOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-warning hover:bg-background">
        <Zap size={20} fill="currentColor" />
      </button>
      {open ? (
        <Overlay title="Acciones y comandos" onClose={() => setOpen(false)}>
          <div data-testid="hoja-acciones-chat" className="space-y-3">
            <p className="text-[13px] text-on-surface-variant">Los disponibles para ti en este chat.</p>
            <AppActionList
              rows={actions}
              testPrefix="accion-chat"
              onPick={(row) => {
                setOpen(false);
                const line = commandToWrite(row);
                if (line) props.onWriteCommand(line);
                else void appAnswers.runAction(row);
              }}
            />
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
