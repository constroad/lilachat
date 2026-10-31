import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Overlay } from '../../ui/Overlay';
import { AppActionList } from './AppActionList';
import type { ChatCommands } from './useChatCommands';

/**
 * The ⚡ of a chat (R31/10, like Slack's shortcuts button): backlog 111 took the
 * apps' actions out of the clip, and the ones an admin turns on for a channel
 * or for the chat with the app were left with no place. It only shows when
 * this chat has one; the form and its answer open in the chat as always.
 */
export function ChatQuickActions(props: { commands: ChatCommands }) {
  const [open, setOpen] = useState(false);
  const { actions, appAnswers } = props.commands;
  if (!actions.length) return null;
  return (
    <>
      <button type="button" data-testid="btn-acciones-chat" aria-label="Acciones de las apps" title="Acciones de las apps" onClick={() => setOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-warning hover:bg-background">
        <Zap size={20} fill="currentColor" />
      </button>
      {open ? (
        <Overlay title="Acciones de las apps" onClose={() => setOpen(false)}>
          <div data-testid="hoja-acciones-chat" className="space-y-3">
            <p className="text-[13px] text-on-surface-variant">Las que el admin encendió en este chat.</p>
            <AppActionList
              rows={actions}
              testPrefix="accion-chat"
              onPick={(row) => {
                setOpen(false);
                void appAnswers.runAction(row);
              }}
            />
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
