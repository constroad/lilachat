import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { CheckSquare, ChevronRight, ShieldCheck, Square } from 'lucide-react-native';
import { accessSummary, CHANNEL_TAB_LABELS, clientAccessPath, DEFAULT_RESTRICTED, memberAccessIn, MONEY_HINT, RESTRICTABLE_TAB_HINTS, RESTRICTABLE_TABS, toggleInAccess, type ClientAccessList, type MemberAccess, type MemberAccessEntry } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import type { ServiceAskTarget } from './useServiceAsk';

export type StageOption = { id: string; title: string };
type SaveBody = { money?: boolean; restricted?: MemberAccess | null };

/** The channel's access list; `null` while loading or for a non-admin (the server says 403). */
export function useClientAccess(target: ServiceAskTarget | null) {
  const [list, setList] = useState<ClientAccessList | null>(null);
  const base = target ? `${BASE_URL}/api${clientAccessPath(target.spaceId, target.clientId)}` : null;
  const jwt = target?.jwt ?? '';
  useEffect(() => {
    if (!base) return undefined;
    let alive = true;
    void jsonCall<ClientAccessList>(base, jwt).then((response) => {
      if (alive && response.ok) setList(response.data);
    });
    return () => {
      alive = false;
    };
  }, [base, jwt]);
  const save = useCallback(async (userId: string, body: SaveBody): Promise<string | null> => {
    if (!base) return 'Sin espacio.';
    const response = await jsonCall<ClientAccessList>(`${base}/${userId}`, jwt, { method: 'PUT', body: JSON.stringify(body) });
    if (!response.ok) return response.message ?? 'No se pudo guardar. Prueba de nuevo.';
    setList(response.data);
    return null;
  }, [base, jwt]);
  return { list, save };
}

/** The checklist's stages of the channel, for picking which ones a member sees. */
export function useChannelStages(jwt: string, chatId: string, enabled: boolean): StageOption[] {
  const [stages, setStages] = useState<StageOption[]>([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    void jsonCall<{ stages: { _id: string; title: string }[] }>(`${BASE_URL}/api/agenda/checklists/stages?chatId=${chatId}`, jwt).then((response) => {
      if (alive && response.ok) setStages(response.data.stages.map((stage) => ({ id: stage._id, title: stage.title })));
    });
    return () => {
      alive = false;
    };
  }, [jwt, chatId, enabled]);
  return stages;
}

const PrimaryButton = (props: { testID: string; label: string; disabled?: boolean; onPress: () => void }) => (
  <Pressable testID={props.testID} disabled={props.disabled} onPress={props.onPress} className="min-h-[48px] items-center justify-center rounded-xl bg-primary">
    <Text className="text-[15px] font-semibold text-on-primary">{props.label}</Text>
  </Pressable>
);

function CheckRow(props: { testID: string; checked: boolean; label: string; hint?: string; onPress: () => void }) {
  const colors = useColores();
  const Icon = props.checked ? CheckSquare : Square;
  return (
    <Pressable testID={props.testID} accessibilityRole="checkbox" accessibilityState={{ checked: props.checked }} onPress={props.onPress} className="min-h-[52px] flex-row items-center gap-3 py-1.5">
      <Icon size={20} color={props.checked ? colors.primary : colors['on-surface-variant']} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">{props.label}</Text>
        {props.hint ? <Text className="text-[12px] text-on-surface-variant">{props.hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/** «Todo el canal» or «Solo lo que elijas» (José 30/10 night); `null` = the whole channel. */
export function AccessFields(props: { value: MemberAccess | null; stages: readonly StageOption[]; onChange: (value: MemberAccess | null) => void }) {
  const restricted = props.value;
  const option = (some: boolean, label: string, hint: string) => (
    <Pressable testID={some ? 'acceso-some' : 'acceso-all'} onPress={() => props.onChange(some ? (restricted ?? DEFAULT_RESTRICTED) : null)} className={`flex-1 rounded-xl border px-3 py-2 ${some === Boolean(restricted) ? 'border-primary bg-primary/10' : 'border-outline/20'}`}>
      <Text className="text-[14px] font-semibold text-on-surface">{label}</Text>
      <Text className="text-[12px] text-on-surface-variant">{hint}</Text>
    </Pressable>
  );
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {option(false, 'Todo el canal', 'Todas las pestañas, sin montos')}
        {option(true, 'Solo lo que elijas', 'El chat y lo que marques')}
      </View>
      {restricted ? (
        <View className="rounded-xl border border-outline/15 px-3">
          {RESTRICTABLE_TABS.map((tab) => <CheckRow key={tab} testID={`acceso-pestana-${tab}`} checked={restricted.tabs.includes(tab)} label={CHANNEL_TAB_LABELS[tab]} hint={RESTRICTABLE_TAB_HINTS[tab]} onPress={() => props.onChange(toggleInAccess(restricted, { tab }))} />)}
          {restricted.tabs.includes('checklist') ? (
            <View className="border-t border-outline/10 pb-2 pl-8">
              <Text className="pt-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Etapas que ve enteras</Text>
              {props.stages.length ? props.stages.map((stage) => <CheckRow key={stage.id} testID={`acceso-etapa-${stage.id}`} checked={restricted.stages.includes(stage.id)} label={stage.title} onPress={() => props.onChange(toggleInAccess(restricted, { stage: stage.id }))} />) : <Text className="py-2 text-[12px] text-on-surface-variant">El checklist todavía no tiene etapas.</Text>}
              <Text className="text-[12px] text-on-surface-variant">En las demás solo ve las tareas que le asignes.</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MemberAccessScreen(props: { name: string; entry: MemberAccessEntry; stages: readonly StageOption[]; onSave: (body: SaveBody) => Promise<string | null>; onClose: () => void }) {
  const colors = useColores();
  const [money, setMoney] = useState(props.entry.money);
  const [restricted, setRestricted] = useState<MemberAccess | null>(props.entry.restricted ?? null);
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const message = await props.onSave({ money, restricted });
    setSaving(false);
    if (message) setFailure(message);
    else props.onClose();
  };
  return (
    <PantallaEnModal visible titulo={`Acceso de ${props.name}`} onCerrar={props.onClose} testIDCerrar="cerrar-acceso" footer={<PrimaryButton testID="guardar-acceso" label={saving ? 'Guardando…' : 'Guardar'} disabled={saving} onPress={() => void save()} />}>
      <AccessFields value={restricted} stages={props.stages} onChange={setRestricted} />
      <View className="mt-3 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/15 px-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-on-surface">Ve montos</Text>
          <Text className="text-[12px] text-on-surface-variant">{MONEY_HINT}</Text>
        </View>
        <Switch testID="acceso-montos" value={money} onValueChange={setMoney} trackColor={{ true: colors.primary }} />
      </View>
      {failure ? <Text className="mt-3 text-[14px] text-error">{failure}</Text> : null}
    </PantallaEnModal>
  );
}

/**
 * «Accesos del canal» of a client's channel, for the space's admins (José 30/10
 * night): each member with what they see; tapping one edits it. Replaces
 * «Quién ve la cobranza», which is now its «Ve montos».
 */
export function ClientAccessRow(props: { target: ServiceAskTarget; members: ReadonlyMap<string, string>; me: string; chatId: string }) {
  const colors = useColores();
  const { list, save } = useClientAccess(props.target);
  const stages = useChannelStages(props.target.jwt, props.chatId, list !== null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  if (!list) return null;
  const titles = new Map(stages.map((stage) => [stage.id, stage.title]));
  const people = [...props.members].filter(([userId]) => userId !== props.me);
  return (
    <>
      <Pressable testID="accesos-del-canal" onPress={() => setOpen(true)} className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3">
        <ShieldCheck size={18} color={colors.primary} />
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-semibold text-on-surface">Accesos del canal</Text>
          <Text className="text-[12px] text-on-surface-variant">{list.restricted.length ? `${list.restricted.length} con acceso restringido` : 'Todos ven el canal; los montos, solo los admins'}</Text>
        </View>
        <ChevronRight size={16} color={colors['on-surface-variant']} />
      </Pressable>
      <PantallaEnModal visible={open && !editing} titulo="Accesos del canal" onCerrar={() => setOpen(false)} testIDCerrar="cerrar-accesos">
        <Text className="mb-3 text-[14px] text-on-surface-variant">Los admins del espacio ven todo. Elige qué ve cada uno de los demás.</Text>
        <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          {people.map(([userId, name], index) => {
            const entry = memberAccessIn(list, userId);
            return (
              <Pressable key={userId} testID={`acceso-de-${userId}`} disabled={entry.admin} onPress={() => setEditing({ id: userId, name })} className={`min-h-[60px] flex-row items-center gap-3 px-4 py-2 ${index ? 'border-t border-outline/10' : ''}`}>
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] text-on-surface" numberOfLines={1}>{name}</Text>
                  <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{entry.admin ? 'Admin del espacio · ve todo' : accessSummary(entry, titles)}</Text>
                </View>
                {entry.admin ? null : <ChevronRight size={16} color={colors['on-surface-variant']} />}
              </Pressable>
            );
          })}
        </View>
      </PantallaEnModal>
      {editing ? <MemberAccessScreen name={editing.name} entry={memberAccessIn(list, editing.id)} stages={stages} onSave={(body) => save(editing.id, body)} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/**
 * Adding someone to a client's channel (José 30/10 night: «con accesos
 * restringidos»): whether they read the history and what they see, in one step.
 */
export function JoinAccessScreen(props: { name: string | null; askHistory: boolean; stages: readonly StageOption[]; onConfirm: (history: boolean, access: MemberAccess | null) => void; onClose: () => void }) {
  const [history, setHistory] = useState(true);
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const choice = (value: boolean, label: string) => (
    <Pressable testID={value ? 'historial-todo' : 'historial-desde-ahora'} onPress={() => setHistory(value)} className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${history === value ? 'border-primary bg-primary/10' : 'border-outline/20'}`}>
      <Text className={`text-[14px] text-on-surface ${history === value ? 'font-semibold' : ''}`}>{label}</Text>
    </Pressable>
  );
  return (
    <PantallaEnModal visible={props.name !== null} titulo={`Agregar a ${props.name ?? ''}`} onCerrar={props.onClose} testIDCerrar="cerrar-agregar" footer={<PrimaryButton testID="confirmar-agregar" label="Agregar" onPress={() => props.onConfirm(history, access)} />}>
      {props.askHistory ? (
        <View className="mb-4">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">¿Ve el historial?</Text>
          <View className="flex-row gap-2">{choice(true, 'Sí, todo')}{choice(false, 'Solo desde ahora')}</View>
        </View>
      ) : null}
      <Text className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">¿Qué ve?</Text>
      <AccessFields value={access} stages={props.stages} onChange={setAccess} />
    </PantallaEnModal>
  );
}
