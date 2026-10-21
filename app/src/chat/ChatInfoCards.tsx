import type { ComponentProps } from 'react';
import { ChecklistsCard } from './ChecklistsCard';
import { TarjetaDeFijados } from './fijados/TarjetaDeFijados';
import { TarjetaDeDestacados } from './destacados/TarjetaDeDestacados';

/**
 * The cards the conversation puts in its info, under the actions: checklists
 * (backlog 30), pinned messages and starred ones. Out of `ChatScreen`, which
 * was at its 600 lines. In a secret chat there are no checklists nor stars.
 */
export function ChatInfoCards(props: {
  chatId: string;
  jwt: string;
  yo: string;
  encrypted: boolean;
  pinned: Omit<ComponentProps<typeof TarjetaDeFijados>, 'nombreDe'>;
  nameOf: (userId: string) => string;
  starredCount: number;
  /** Closes the info and goes to that message of the chat. */
  onGoTo: (seq: number) => void;
}) {
  return (
    <>
      {props.encrypted ? null : <ChecklistsCard chatId={props.chatId} jwt={props.jwt} onOpen={props.onGoTo} />}
      <TarjetaDeFijados {...props.pinned} nombreDe={props.nameOf} />
      {props.encrypted ? null : <TarjetaDeDestacados chatId={props.chatId} jwt={props.jwt} yo={props.yo} cuantos={props.starredCount} onIr={props.onGoTo} />}
    </>
  );
}
