import { useState } from 'react';
import { Archive, ChevronRight, Plus, Search } from 'lucide-react';
import { CREATE_CLIENT_ACTION, formKeyOf, pageLiveClients, type ClientEntry } from '@lilachat/shared';
import { loadPerfil } from '../../api';
import type { ChatSummary } from '../../chat/types';
import { Overlay } from '../../ui/Overlay';
import { AppFormDialog } from '../../chat/commands/AppFormDialog';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { ClientRow } from './ClientsSection';
import { useSpaceAction } from './useSpaceAction';

type Entry = ClientEntry<ChatSummary>;
const ALL = Number.MAX_SAFE_INTEGER;

/**
 * The clients' picker (José 30/10: «que sea tipo un selector y una opción de
 * poder crear un cliente»): every live client, searched by name or RUC, the
 * archived ones, and «Crear un cliente» for whoever may run Portal's action.
 */
export function ClientPickerWeb(props: { jwt?: string; spaceId: string; live: Entry[]; archived: number; onOpen: (chat: ChatSummary) => void; onArchived: () => void; now?: Date }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { row, answers } = useSpaceAction(props.jwt, props.spaceId, CREATE_CLIENT_ACTION, open);
  const found = pageLiveClients(props.live, { query, shown: ALL }).entries;
  const now = props.now ?? new Date();
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const leaveTo = (next: () => void) => {
    close();
    next();
  };
  return (
    <>
      <button type="button" data-testid="selector-clientes" onClick={() => setOpen(true)} className="mx-4 mb-1 flex h-8 w-[calc(100%-2rem)] items-center gap-2 rounded-lg bg-background px-2.5 text-left text-[13px] text-on-surface-variant hover:bg-surface-variant">
        <Search size={14} />
        <span className="min-w-0 flex-1 truncate">Buscar o crear cliente…</span>
      </button>
      {open && !answers.openForm ? (
        <Overlay title="Clientes" onClose={close} footer={<p className="text-[12px] text-on-surface-variant">Un cliente nuevo tiene canal desde su primer pedido o servicio.</p>}>
          <div className="space-y-3">
            <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt ?? ''} />
            <label className="flex h-10 items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
              <Search size={16} className="text-on-surface-variant" />
              <input data-testid="buscar-cliente" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o RUC" aria-label="Buscar cliente por nombre o RUC" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            {row ? (
              <button type="button" data-testid="crear-cliente" onClick={() => void answers.runAction(row)} className="flex h-12 w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 text-left text-sm font-semibold text-primary hover:bg-primary/15">
                <Plus size={18} />
                Crear un cliente
              </button>
            ) : null}
            <div data-testid="lista-selector-clientes" className="max-h-[50vh] divide-y divide-outline/10 overflow-y-auto rounded-2xl border border-outline/15">
              {found.map((entry) => <ClientRow key={entry.client.id} entry={entry} now={now} open={false} onOpen={(chat) => leaveTo(() => props.onOpen(chat))} />)}
              {found.length === 0 ? <p className="p-4 text-sm text-on-surface-variant">{query ? 'Ningún cliente con ese nombre o RUC.' : 'Todavía no hay clientes con canal.'}</p> : null}
            </div>
            {props.archived > 0 ? (
              <button type="button" data-testid="selector-archivados" onClick={() => leaveTo(props.onArchived)} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-1 text-left text-sm hover:bg-background">
                <Archive size={16} className="text-on-surface-variant" />
                <span className="flex-1">{`Archivados · ${props.archived}`}</span>
                <ChevronRight size={16} className="text-on-surface-variant" />
              </button>
            ) : null}
          </div>
        </Overlay>
      ) : null}
      {answers.openForm ? (
        <AppFormDialog key={formKeyOf(answers.openForm)} answer={answers.openForm} personName={loadPerfil()?.name} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(file, stamp) => answers.uploadPhoto(answers.openForm!.commandId, file, stamp)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </>
  );
}
