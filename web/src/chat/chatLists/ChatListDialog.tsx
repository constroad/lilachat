import { useMemo, useState } from 'react';
import { Check, Search, Trash2 } from 'lucide-react';
import { CHAT_LIST_NAME_MAX, chatListNameError, diffListChats, sectionOfChat, type ChatList } from '@lilachat/shared';
import { FieldError, Overlay } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';
import type { ListOutcome } from './useChatListsWeb';

export type ListChat = { id: string; title: string };

const key = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Create or edit a list of my own on the web (pending 45): its name and its
 * chats, the chats already in it first. Deleting a list never deletes chats.
 */
export function ChatListDialog(props: {
  /** null: a new list. */
  list: ChatList | null;
  lists: readonly ChatList[];
  chats: readonly ListChat[];
  initialChatIds?: readonly string[];
  onCreate: (name: string, chatIds: string[]) => Promise<ListOutcome>;
  onUpdate: (listId: string, change: { name: string; add: string[]; remove: string[] }) => Promise<ListOutcome>;
  onDelete: (listId: string) => Promise<ListOutcome>;
  onClose: () => void;
}) {
  const { list } = props;
  const [name, setName] = useState(list?.name ?? '');
  const [chosen, setChosen] = useState<string[]>(() => (list ? [...list.chatIds] : [...(props.initialChatIds ?? [])]));
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const needle = key(search.trim());
    const matching = props.chats.filter((chat) => !needle || key(chat.title).includes(needle));
    const firstChosen = list ? list.chatIds : (props.initialChatIds ?? []);
    return [...matching.filter((chat) => firstChosen.includes(chat.id)), ...matching.filter((chat) => !firstChosen.includes(chat.id))];
  }, [props.chats, search, list, props.initialChatIds]);

  const toggle = (chatId: string) => setChosen((current) => (current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId]));

  const finish = (outcome: ListOutcome) => (outcome.ok ? props.onClose() : setError(outcome.message));

  const save = async () => {
    const invalid = chatListNameError(name, props.lists, list?.id);
    if (invalid) return setError(invalid);
    setSaving(true);
    const outcome = list ? await props.onUpdate(list.id, { name: name.trim(), ...diffListChats(list.chatIds, chosen) }) : await props.onCreate(name.trim(), chosen);
    setSaving(false);
    finish(outcome);
  };

  const remove = async () => {
    if (!list || !window.confirm('¿Eliminar la sección? Los chats no se borran: pasan a «Sin sección».')) return;
    finish(await props.onDelete(list.id));
  };

  return (
    <Overlay
      title={list ? 'Editar sección' : 'Nueva sección'}
      onClose={props.onClose}
      footer={
        <div className="flex items-center gap-2">
          {list ? (
            <button type="button" data-testid="btn-eliminar-lista" onClick={() => void remove()} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-error hover:bg-error/10">
              <Trash2 size={16} /> Eliminar sección
            </button>
          ) : null}
          <span className="flex-1" />
          <button type="button" data-testid="btn-guardar-lista" disabled={saving} onClick={() => void save()} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <input
        data-testid="campo-nombre-de-lista"
        value={name}
        maxLength={CHAT_LIST_NAME_MAX}
        onChange={(event) => {
          setName(event.target.value);
          setError('');
        }}
        placeholder="Nombre, por ejemplo Obra Huachipa"
        className="h-11 w-full rounded-xl border border-outline/30 bg-transparent px-3 text-[15px] outline-none focus:border-primary"
      />
      <FieldError>{error}</FieldError>
      <label className="mt-4 flex h-10 items-center gap-2 rounded-full bg-primary/[0.07] px-3">
        <Search size={16} className="text-primary" />
        <input data-testid="buscar-chats-de-lista" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar chats" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <p className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">{chosen.length === 1 ? '1 chat elegido' : `${chosen.length} chats elegidos`}</p>
      {shown.map((chat) => {
        const inside = chosen.includes(chat.id);
        // A chat lives in one section (pending 62): saving moves it from where it is.
        const elsewhere = sectionOfChat(props.lists.filter((one) => one.id !== list?.id), chat.id);
        return (
          <button key={chat.id} type="button" role="checkbox" aria-checked={inside} data-testid={`chat-de-lista-${chat.id}`} onClick={() => toggle(chat.id)} className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-1 text-left hover:bg-background">
            <Avatar name={chat.title} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{chat.title}</span>
              {elsewhere ? <span className="block truncate text-[12px] text-on-surface-variant">{inside ? `Sale de «${elsewhere.name}»` : `En «${elsewhere.name}»`}</span> : null}
            </span>
            <span className={`grid h-5 w-5 place-items-center rounded border-2 ${inside ? 'border-primary bg-primary text-on-primary' : 'border-outline/50'}`}>{inside ? <Check size={12} /> : null}</span>
          </button>
        );
      })}
    </Overlay>
  );
}
