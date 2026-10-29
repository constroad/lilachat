import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Building2, Info, Search } from 'lucide-react-native';
import { ARCHIVED_RULE, CLIENT_LIVE_DAYS, filterArchivedClients, shortDate, type ArchivedClientsFilter, type ClientEntry } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

type Entry = ClientEntry<ChatSummary>;
const CHIPS: { key: ArchivedClientsFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'Sin leer' },
  { key: 'recent', label: 'Último pedido < 6 meses' },
];

/** «Archivados» of the clients (design f-02): the rule, search by name or RUC, chips and groups by age. */
export function ArchivedClientsScreen(props: { archived: Entry[]; onOpen: (chat: ChatSummary) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArchivedClientsFilter>('all');
  const view = useMemo(() => filterArchivedClients(props.archived, { query, filter }, new Date()), [props.archived, query, filter]);
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="clientes-archivados-pantalla" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="archivados-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center"><ArrowLeft size={22} color={colors['on-surface']} /></Pressable>
          <Text className="text-[17px] font-bold text-on-surface">Clientes archivados</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-primary">Clientes</Text>
          <Text className="text-[26px] font-bold text-on-surface">Archivados</Text>
          <Text className="text-[14px] text-on-surface-variant">{`${props.archived.length} ${props.archived.length === 1 ? 'cliente' : 'clientes'} sin movimiento en ${CLIENT_LIVE_DAYS} días`}</Text>
          <View className="mt-3 flex-row gap-2 rounded-xl border border-outline/15 bg-surface p-3">
            <Info size={16} color={colors.primary} />
            <Text className="flex-1 text-[13px] text-on-surface-variant">{ARCHIVED_RULE}</Text>
          </View>
          <View className="mt-3 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
            <Search size={18} color={colors['on-surface-variant']} />
            <TextInput testID="buscar-archivados" value={query} onChangeText={setQuery} placeholder="Buscar cliente o RUC…" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
            {CHIPS.map((chip) => (
              <Pressable key={chip.key} testID={`chip-archivados-${chip.key}`} onPress={() => setFilter(chip.key)} accessibilityState={{ selected: filter === chip.key }} className={`min-h-[40px] flex-row items-center gap-1.5 rounded-full px-4 ${filter === chip.key ? 'bg-primary' : 'border border-outline/20 bg-surface'}`}>
                <Text className={`text-[14px] ${filter === chip.key ? 'font-bold text-on-primary' : 'text-on-surface'}`}>{chip.label}</Text>
                <Text className={`text-[12px] font-bold ${filter === chip.key ? 'text-on-primary' : 'text-primary'}`}>{view.counts[chip.key]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {view.groups.length === 0 ? <Text testID="archivados-vacio" className="pt-10 text-center text-[14px] text-on-surface-variant">Ningún cliente archivado coincide.</Text> : null}
          {view.groups.map((group) => (
            <View key={group.key} testID={`grupo-archivados-${group.key}`} className="mt-4 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
              <Text className="border-b border-outline/10 px-4 py-2 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{`${group.title} · ${group.entries.length}`}</Text>
              {group.entries.map((entry) => (
                <Pressable key={entry.client.id} testID={`archivado-tarjeta-${entry.client.id}`} disabled={!entry.chat} onPress={() => entry.chat && props.onOpen(entry.chat)} android_ripple={{ color: colors.outline }} className="min-h-[64px] flex-row items-center gap-3 border-b border-outline/10 px-4 py-2">
                  <View className="h-10 w-10 items-center justify-center rounded-xl border border-outline/15 bg-background"><Building2 size={18} color={colors['on-surface-variant']} /></View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className={`text-[15px] text-on-surface ${(entry.chat?.unread ?? 0) > 0 ? 'font-bold' : 'font-semibold'}`}>{entry.client.name}</Text>
                    <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">{[entry.client.ruc ? `RUC ${entry.client.ruc}` : null, entry.client.last_order_at ? `Último pedido ${shortDate(entry.client.last_order_at)}` : 'Sin pedidos'].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {(entry.chat?.unread ?? 0) > 0 ? <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5"><Text className="text-[12px] font-bold text-on-primary">{entry.chat?.unread}</Text></View> : null}
                </Pressable>
              ))}
            </View>
          ))}
          {view.shown > 0 ? <Text className="mt-3 text-center text-[12px] text-on-surface-variant">{`Mostrando ${view.shown} de ${props.archived.length}`}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
