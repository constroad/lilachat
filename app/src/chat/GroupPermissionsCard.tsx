import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { MEMBER_PERMISSION_ROWS, memberPermissionsOf, type MemberPermission, type MemberPermissions } from '@lilachat/shared';
import { Interruptor } from '../ui/Interruptor';
import { BASE_URL } from '../api/client';

const SAVE_TIMEOUT_MS = 10_000;

/**
 * «Permisos del grupo» in the group info (pending 8, design `permisos-admin`):
 * what the members may do; admins always can. Everyone sees it, only admins
 * move it, and the server checks each one (`PATCH /api/chats/:id/permissions`).
 * The design's «Cambiar admins» has no backend switch: it is not drawn.
 */
export function GroupPermissionsCard(props: { chatId: string; jwt: string; permissions: Partial<MemberPermissions> | undefined; isAdmin: boolean }) {
  const [value, setValue] = useState(() => memberPermissionsOf(props.permissions));
  const [saving, setSaving] = useState<MemberPermission | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setValue(memberPermissionsOf(props.permissions));
  }, [props.permissions]);

  const change = async (key: MemberPermission, next: boolean) => {
    setValue((current) => ({ ...current, [key]: next }));
    setSaving(key);
    setError('');
    const undo = () => setValue((current) => ({ ...current, [key]: !next }));
    try {
      const response = await fetch(`${BASE_URL}/api/chats/${props.chatId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` },
        body: JSON.stringify({ [key]: next }),
        signal: AbortSignal.timeout(SAVE_TIMEOUT_MS),
      });
      if (!response.ok) {
        const reply = (await response.json().catch(() => null)) as { message?: string } | null;
        undo();
        setError(reply?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      undo();
      setError('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View testID="tarjeta-permisos" className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <View className="h-[3px] bg-primary" />
      <View className="p-4">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Permisos</Text>
        <Text className="mt-2 text-[16px] font-bold text-on-surface">Qué pueden hacer los miembros</Text>
        <Text className="mt-1 text-[13px] text-on-surface-variant">{props.isAdmin ? 'Los admins siempre pueden todo. Los cambios se guardan solos.' : 'Solo los admins pueden cambiarlo.'}</Text>
        {MEMBER_PERMISSION_ROWS.map((row) => (
          <View key={row.key} className="mt-3 min-h-[52px] flex-row items-center gap-3 border-t border-outline/10 pt-3">
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-semibold text-on-surface">{row.title}</Text>
              <Text className="text-[13px] text-on-surface-variant">{row.detail}</Text>
            </View>
            <Interruptor testID={`switch-permiso-${row.key}`} value={value[row.key]} onValueChange={(next) => void change(row.key, next)} disabled={!props.isAdmin || saving !== null} />
          </View>
        ))}
        {error ? <Text className="mt-2 text-[13px] text-error">{error}</Text> : null}
      </View>
    </View>
  );
}
