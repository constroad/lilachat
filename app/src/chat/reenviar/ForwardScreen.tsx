import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { Modal } from '../../ui/Modal';
import * as Crypto from 'expo-crypto';
import { ArrowLeft, Check, NotebookPen, Search, Send, Users } from 'lucide-react-native';
import { alternarDestino, buildOutboxItem, destinosDeReenvio, MAXIMO_DE_DESTINOS, nombreDeContacto } from '@lilachat/shared';
import type { ChatParaReenviar, Frecuencias, PasoDeReenvio } from '@lilachat/shared';
import { reenviarMensajeA } from '../../api/client';
import { createChat } from '../../contacts/contactsApi';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { Avatar } from '../../ui/Avatar';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { reportarError } from '../../ui/reportarError';
import { queueMessage } from '../outboxStore';
import { encolarArchivo } from '../colaDeArchivos';
import { leerFrecuencias } from './frecuenciasDeEnvio';
import { knownChats } from './knownChats';
import type { ChatSummary } from '../../api/client';
import type { SharedFile } from './incomingShare';

/** The «Tú» chat that does not exist yet: it is created when sending (`kind: 'yo'`). */
const NEW_SELF = 'tu-nuevo';
const AVATAR_SIZE = 48;

type Row = { kind: 'label'; text: string } | { kind: 'chat'; chat: ChatParaReenviar };

export type ForwardScreenProps = {
  visible: boolean;
  steps: PasoDeReenvio[];
  /** Files another app shared (José, 02/11): they go by the file queue, like a photo from the gallery. */
  files?: readonly SharedFile[];
  /** «Compartir en» when another app shared it; «Reenviar a» by default. */
  title?: string;
  /** What is being shared, under the title until a chat is chosen. */
  summary?: string;
  token: string;
  onClose: () => void;
  onSent: (names: string[], ids: string[]) => void;
  onError: (text: string) => void;
};

type SendParams = Pick<ForwardScreenProps, 'steps' | 'files' | 'token' | 'onError'> & { chosen: readonly string[]; note: string };

/**
 * «Reenviar a…» (José, 20/10; design `f1-app-reenviar`), like WhatsApp: a
 * search box, «Chats frecuentes», «Chats recientes», up to 5 chats with their
 * checkbox, and at the bottom the chosen ones with «Añadir un mensaje…» and
 * send. The same screen is «Compartir en» for what another app shares (02/11).
 */
export function ForwardScreen(props: ForwardScreenProps) {
  const colors = useColores();
  const insets = useMargenes();
  const picker = useTargetPicker(props.visible);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (sending || picker.chosen.length === 0) return;
    setSending(true);
    const sentTo = await sendToAll({ steps: props.steps, files: props.files, token: props.token, onError: props.onError, chosen: picker.chosen, note: picker.note });
    setSending(false);
    if (sentTo) props.onSent(picker.names, sentTo);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background" testID="pantalla-reenviar">
        <PickerHeader title={props.title ?? 'Reenviar a'} summary={props.summary} chosenCount={picker.chosen.length} topInset={insets.cabecera} onClose={props.onClose} />
        <View className="mx-4 my-3 flex-row items-center gap-2 rounded-full bg-surface-variant/60 px-4">
          <Search size={18} color={colors['on-surface-variant']} />
          <TextInput testID="input-buscar-reenviar" value={picker.query} onChangeText={picker.setQuery} placeholder="Buscar chats o contactos" placeholderTextColor={colors['on-surface-variant']} className="min-h-[44px] flex-1 text-[15px] text-on-surface" />
        </View>
        <FlatList
          data={picker.rows}
          keyExtractor={(row, index) => (row.kind === 'chat' ? row.chat.id : `rotulo-${index}`)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.kind === 'label' ? (
              <Text className="px-5 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">{item.text}</Text>
            ) : (
              <TargetRow chat={item.chat} chosen={picker.chosen.includes(item.chat.id)} onToggle={() => picker.toggle(item.chat.id)} />
            )
          }
          ListEmptyComponent={<Text className="px-5 py-8 text-center text-[14px] text-on-surface-variant">No hay chats con ese nombre.</Text>}
        />
        {picker.chosen.length ? <SendBar names={picker.names} note={picker.note} onNote={picker.setNote} sending={sending} bottomInset={insets.pie} onSend={() => void send()} /> : null}
      </View>
    </Modal>
  );
}

/** The search, the chosen chats and the extra note; all of it starts over each time the screen opens. */
function useTargetPicker(visible: boolean) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [frequencies, setFrequencies] = useState<Frecuencias>({});
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setChosen([]);
    setNote('');
    void leerFrecuencias().then(setFrequencies);
  }, [visible]);
  const possible = useMemo(() => (visible ? possibleTargets() : []), [visible]);
  const rows = useMemo(() => targetRows(possible, frequencies, query), [possible, frequencies, query]);
  const names = chosen.map((id) => possible.find((chat) => chat.id === id)?.nombre ?? '');
  const toggle = (id: string) => {
    const next = alternarDestino(chosen, id);
    if (next.lleno) ToastAndroid.show(`Puedes reenviar a ${MAXIMO_DE_DESTINOS} chats como máximo.`, ToastAndroid.SHORT);
    setChosen(next.elegidos);
  };
  return { query, setQuery, chosen, names, note, setNote, rows, toggle };
}

function possibleTargets(): ChatParaReenviar[] {
  const phoneBook = agendaPorTelefono();
  const chats = knownChats().map((chat) => targetOf(chat, phoneBook));
  return chats.some((chat) => chat.propio) ? chats : [...chats, { id: NEW_SELF, nombre: 'Tú', subtitulo: 'Envíate un mensaje', propio: true }];
}

function targetOf(chat: ChatSummary, phoneBook: ReturnType<typeof agendaPorTelefono>): ChatParaReenviar {
  const contactName = nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda: phoneBook }) || 'Chat';
  return {
    id: chat.id,
    nombre: chat.propio ? 'Tú' : chat.channel ? `#${chat.name ?? 'canal'}` : contactName,
    subtitulo: chat.propio ? 'Envíate un mensaje' : chat.kind === 'notas' ? 'Solo tú lo ves' : chat.lastMessage?.body?.split('\n')[0],
    esGrupo: chat.kind === 'group',
    esBorrador: chat.kind === 'notas' && !chat.propio,
    propio: chat.propio,
    cifrado: chat.encrypted,
    ultimoEn: chat.lastMessage?.at,
    avatarUrl: chat.avatarUrl,
  };
}

function targetRows(possible: ChatParaReenviar[], frequencies: Frecuencias, query: string): Row[] {
  const { frecuentes, recientes } = destinosDeReenvio({ chats: possible, frecuencias: frequencies, busqueda: query, ahora: Date.now() });
  const asRows = (chats: ChatParaReenviar[]) => chats.map((chat) => ({ kind: 'chat' as const, chat }));
  return [
    ...(frecuentes.length ? [{ kind: 'label' as const, text: 'Chats frecuentes' }, ...asRows(frecuentes)] : []),
    ...(recientes.length ? [{ kind: 'label' as const, text: query ? 'Resultados' : 'Chats recientes' }, ...asRows(recientes)] : []),
  ];
}

/** To every chosen chat in turn; `null` (with the error already said) when one fails. */
async function sendToAll(params: SendParams): Promise<string[] | null> {
  const sentTo: string[] = [];
  for (const id of params.chosen) {
    const chatId = await resolveTarget(id, params);
    if (!chatId || !(await sendTo(chatId, params))) return null;
    sentTo.push(chatId);
  }
  return sentTo;
}

async function resolveTarget(id: string, params: SendParams): Promise<string | null> {
  if (id !== NEW_SELF) return id;
  const created = await createChat(params.token, { kind: 'yo', memberIds: [] });
  if (created.ok) return created.data.chatId;
  params.onError(created.message ?? 'No se pudo abrir tu chat.');
  return null;
}

/** Each message on its own and in order: text by the outbox, a photo or file of the chat by reference, a shared file by the file queue. */
async function sendTo(chatId: string, params: SendParams): Promise<boolean> {
  for (const step of params.steps) {
    if (!(await sendStep(chatId, step, params))) return false;
  }
  if (!(await queueSharedFiles(chatId, params.files ?? []))) {
    params.onError('No se pudo preparar un archivo compartido.');
    return false;
  }
  await queueText(chatId, params.note.trim());
  return true;
}

async function sendStep(chatId: string, step: PasoDeReenvio, params: SendParams): Promise<boolean> {
  if (step.tipo === 'texto') {
    await queueText(chatId, step.texto);
    return true;
  }
  const forwarded = await reenviarMensajeA(params.token, chatId, { desde: step.chatId, seq: step.seq, clientKey: Crypto.randomUUID() });
  if (!forwarded.ok) params.onError(forwarded.message ?? 'No se pudo reenviar.');
  return forwarded.ok;
}

async function queueText(chatId: string, text: string): Promise<void> {
  const item = text ? buildOutboxItem({ chatId, clientKey: Crypto.randomUUID(), text, queuedAt: new Date().toISOString() }) : null;
  if (item) await queueMessage(item);
}

/** Each shared file to the persisted file queue: its bubble shows at once and it uploads when there is network. */
async function queueSharedFiles(chatId: string, files: readonly SharedFile[]): Promise<boolean> {
  try {
    for (const file of files) await encolarArchivo({ chatId, ...file });
    return true;
  } catch (error) {
    reportarError('compartir-archivo', error);
    return false;
  }
}

function PickerHeader(props: { title: string; summary?: string; chosenCount: number; topInset: number; onClose: () => void }) {
  const colors = useColores();
  const subtitle = props.chosenCount ? (props.chosenCount === 1 ? '1 seleccionado' : `${props.chosenCount} seleccionados`) : props.summary;
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-2 pb-2" style={{ paddingTop: props.topInset }}>
      <Pressable testID="btn-cerrar-reenviar" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center">
        <ArrowLeft size={22} color={colors['on-surface']} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-[18px] font-semibold text-on-surface">{props.title}</Text>
        {subtitle ? (
          <Text testID={props.chosenCount ? undefined : 'resumen-compartido'} numberOfLines={1} className="text-[13px] text-on-surface-variant">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SendBar(props: { names: string[]; note: string; onNote: (text: string) => void; sending: boolean; bottomInset: number; onSend: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-3 border-t border-outline/10 bg-surface px-4 pt-2" style={{ paddingBottom: props.bottomInset + 8 }}>
      <View className="min-w-0 flex-1">
        <Text testID="elegidos-reenviar" numberOfLines={1} className="text-[14px] font-semibold text-on-surface">
          {props.names.join(', ')}
        </Text>
        <TextInput testID="input-mensaje-reenviar" value={props.note} onChangeText={props.onNote} placeholder="Añadir un mensaje…" placeholderTextColor={colors['on-surface-variant']} className="min-h-[40px] text-[14px] text-on-surface" />
      </View>
      <Pressable testID="btn-enviar-reenviar" accessibilityLabel="Enviar" disabled={props.sending} onPress={props.onSend} className={`h-14 w-14 items-center justify-center rounded-full bg-primary ${props.sending ? 'opacity-60' : ''}`}>
        <Send size={22} color={colors['on-primary']} />
      </Pressable>
    </View>
  );
}

function TargetRow(props: { chat: ChatParaReenviar; chosen: boolean; onToggle: () => void }) {
  const colors = useColores();
  const { chat } = props;
  const icon = chat.esGrupo ? <Users size={22} color={colors.primary} /> : chat.esBorrador ? <NotebookPen size={22} color={colors.primary} /> : undefined;
  return (
    <Pressable testID={`reenviar-a-${chat.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: props.chosen }} onPress={props.onToggle} className="min-h-[64px] flex-row items-center gap-3 px-5">
      <Avatar nombre={chat.nombre} foto={chat.avatarUrl} tamano={AVATAR_SIZE} icono={icon} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[16px] text-on-surface">{chat.nombre}</Text>
        {chat.subtitulo ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{chat.subtitulo}</Text> : null}
      </View>
      <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${props.chosen ? 'border-primary bg-primary' : 'border-outline/40'}`}>
        {props.chosen ? <Check size={14} color={colors['on-primary']} /> : null}
      </View>
    </Pressable>
  );
}
