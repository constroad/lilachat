import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ban } from 'lucide-react-native';
import { blockedListEmptyText } from '@lilachat/shared';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { listBlockedPeople, unblockPerson, type BlockedPerson } from './blockedApi';

/** «Contactos bloqueados» (pending 9): who I blocked, and unblocking with one tap. Read when opened. */
export function BlockedContactsSetting({ jwt }: { jwt: string }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<BlockedPerson[] | null | undefined>(undefined);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setPeople(undefined);
    setPeople(await listBlockedPeople(jwt));
  }, [jwt]);
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const unblock = async (person: BlockedPerson) => {
    setError('');
    const outcome = await unblockPerson(jwt, person.id);
    if (outcome.ok) setPeople((current) => current?.filter((one) => one.id !== person.id));
    else setError(outcome.message);
  };

  return (
    <>
      <FilaDeAjuste testID="btn-contactos-bloqueados" icono={Ban} titulo="Contactos bloqueados" detalle="No pueden llamarte ni escribirte por su chat" onPress={() => setOpen(true)} />
      <PantallaEnModal visible={open} titulo="Contactos bloqueados" onCerrar={() => setOpen(false)} testIDCerrar="btn-cerrar-bloqueados">
        {people === undefined ? <ActivityIndicator className="mt-8" /> : null}
        {people === null ? (
          <Pressable onPress={() => void load()} className="mt-8 items-center">
            <Text className="text-[14px] text-on-surface-variant">No se pudo cargar. Toca para reintentar.</Text>
          </Pressable>
        ) : null}
        {people?.length === 0 ? <Text testID="bloqueados-vacio" className="mt-8 text-center text-[14px] text-on-surface-variant">{blockedListEmptyText}</Text> : null}
        {people?.map((person) => (
          <View key={person.id} testID={`bloqueado-${person.id}`} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10 py-2">
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{person.name ?? person.phone}</Text>
              {person.name ? <Text className="text-[13px] text-on-surface-variant">{person.phone}</Text> : null}
            </View>
            <Pressable testID={`btn-desbloquear-${person.id}`} accessibilityRole="button" onPress={() => void unblock(person)} className="min-h-[40px] justify-center rounded-full border border-outline/20 px-4">
              <Text className="text-[14px] font-semibold text-primary">Desbloquear</Text>
            </Pressable>
          </View>
        ))}
        {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
      </PantallaEnModal>
    </>
  );
}
