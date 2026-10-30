import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { ChevronRight, Wallet } from 'lucide-react-native';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import type { ServiceAskTarget } from './useServiceAsk';

type Viewers = { viewers: string[] };

/** `null` = not an admin (the server says 403) or still loading: the row does not show. */
function useBillingViewers(target: ServiceAskTarget) {
  const { jwt, spaceId, clientId } = target;
  const base = `${BASE_URL}/api/workspaces/${spaceId}/clients/${clientId}/billing-viewers`;
  const [viewers, setViewers] = useState<string[] | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    let alive = true;
    void jsonCall<Viewers>(base, jwt).then((response) => {
      if (alive && response.ok) setViewers(response.data.viewers);
    });
    return () => {
      alive = false;
    };
  }, [base, jwt]);
  const mark = useCallback(async (userId: string, sees: boolean) => {
    setFailure('');
    const response = await jsonCall<Viewers>(`${base}/${userId}`, jwt, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sees }) });
    if (response.ok) setViewers(response.data.viewers);
    else setFailure(response.message ?? 'No se pudo guardar. Prueba de nuevo.');
  }, [base, jwt]);
  return { viewers, mark, failure };
}

/**
 * José 30/10: the collection is seen by the space's admins plus any channel
 * member an admin picks. Only an admin sees this row; the switch of each
 * channel member marks who else sees the collection tab.
 */
export function BillingViewers(props: { target: ServiceAskTarget; members: ReadonlyMap<string, string>; me: string }) {
  const colors = useColores();
  const { viewers, mark, failure } = useBillingViewers(props.target);
  const [open, setOpen] = useState(false);
  if (viewers === null) return null;
  const others = [...props.members].filter(([userId]) => userId !== props.me);
  return (
    <>
      <Pressable testID="quien-ve-cobranza" onPress={() => setOpen(true)} className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3">
        <Wallet size={18} color={colors.primary} />
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-semibold text-on-surface">Quién ve la cobranza</Text>
          <Text className="text-[12px] text-on-surface-variant">{viewers.length ? `Los admins y ${viewers.length} ${viewers.length === 1 ? 'miembro más' : 'miembros más'}` : 'Solo los admins del espacio'}</Text>
        </View>
        <ChevronRight size={16} color={colors['on-surface-variant']} />
      </Pressable>
      <PantallaEnModal visible={open} titulo="Quién ve la cobranza" onCerrar={() => setOpen(false)} testIDCerrar="cerrar-quien-ve-cobranza">
        <Text className="mb-3 text-[14px] text-on-surface-variant">Los admins del espacio siempre la ven. Marca a quién más de este canal le aparece la pestaña Cobranza.</Text>
        <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          {others.map(([userId, name], index) => (
            <View key={userId} className={`min-h-[56px] flex-row items-center gap-3 px-4 ${index ? 'border-t border-outline/10' : ''}`}>
              <Text className="min-w-0 flex-1 text-[15px] text-on-surface" numberOfLines={1}>{name}</Text>
              <Switch testID={`ve-cobranza-${userId}`} value={viewers.includes(userId)} onValueChange={(sees) => void mark(userId, sees)} trackColor={{ true: colors.primary }} />
            </View>
          ))}
        </View>
        {failure ? <Text className="mt-3 text-[14px] text-error">{failure}</Text> : null}
      </PantallaEnModal>
    </>
  );
}
