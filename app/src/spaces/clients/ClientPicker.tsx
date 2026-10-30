import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Archive, ChevronRight, Plus, Search } from 'lucide-react-native';
import { CREATE_CLIENT_ACTION, formKeyOf, pageLiveClients, type ClientEntry } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { ClientRow } from './ClientsSection';
import { useSpaceAction } from './useSpaceAction';

type Entry = ClientEntry<ChatSummary>;
const ALL = Number.MAX_SAFE_INTEGER;

/**
 * The clients' picker (José 30/10: a picker with an option to create a
 * client): every live client, searched by name or RUC, the
 * archived ones, and «Crear un cliente» for whoever may run Portal's action.
 * It is not in the ⚡: it lives here.
 */
export function ClientPicker(props: { jwt: string; spaceId: string; live: Entry[]; archived: number; onOpen: (chat: ChatSummary) => void; onArchived: () => void }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { row, answers } = useSpaceAction(props.jwt, props.spaceId, CREATE_CLIENT_ACTION, open);
  const found = pageLiveClients(props.live, { query, shown: ALL }).entries;
  const now = new Date();
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
      <Pressable testID="selector-clientes" onPress={() => setOpen(true)} className="mx-4 mb-1 h-10 flex-row items-center gap-2 rounded-xl bg-surface px-3">
        <Search size={16} color={colors['on-surface-variant']} />
        <Text numberOfLines={1} className="flex-1 text-[14px] text-on-surface-variant">Buscar o crear cliente…</Text>
      </Pressable>
      <PantallaEnModal visible={open && !answers.openForm} titulo="Clientes" onCerrar={close} testIDCerrar="cerrar-selector-clientes">
        <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt} embedded />
        <View className="mb-3 h-11 flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
          <Search size={16} color={colors['on-surface-variant']} />
          <TextInput testID="buscar-cliente" value={query} onChangeText={setQuery} placeholder="Nombre o RUC" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
        </View>
        {row ? (
          <Pressable testID="crear-cliente" onPress={() => void answers.runAction(row)} className="mb-3 min-h-[52px] flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3">
            <Plus size={20} color={colors.primary} />
            <Text className="flex-1 text-[15px] font-semibold text-primary">Crear un cliente</Text>
          </Pressable>
        ) : null}
        <View testID="lista-selector-clientes" className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          {found.map((entry) => <ClientRow key={entry.client.id} entry={entry} now={now} open={false} onOpen={(chat) => leaveTo(() => props.onOpen(chat))} />)}
          {found.length === 0 ? <Text className="p-4 text-[14px] text-on-surface-variant">{query ? 'Ningún cliente con ese nombre o RUC.' : 'Todavía no hay clientes con canal.'}</Text> : null}
        </View>
        {props.archived > 0 ? (
          <Pressable testID="selector-archivados" onPress={() => leaveTo(props.onArchived)} className="mt-3 min-h-[52px] flex-row items-center gap-3 px-1">
            <Archive size={20} color={colors['on-surface-variant']} />
            <Text className="flex-1 text-[15px] text-on-surface">{`Archivados · ${props.archived}`}</Text>
            <ChevronRight size={18} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
        <Text className="mt-3 text-[12px] text-on-surface-variant">Un cliente nuevo tiene canal desde su primer pedido o servicio.</Text>
      </PantallaEnModal>
      {answers.openForm ? (
        <AppFormSheet key={formKeyOf(answers.openForm)} answer={answers.openForm} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(photo, stamp) => answers.uploadPhoto(answers.openForm!.commandId, photo, stamp)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </>
  );
}
