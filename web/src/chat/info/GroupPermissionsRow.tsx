import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { MEMBER_PERMISSION_ROWS, memberPermissionsOf, type MemberPermission } from '@lilachat/shared';

/**
 * «Permisos del grupo» in the group info (pending 8, design `permisos-admin`):
 * what the members may do; admins always can. Everyone sees it, only admins
 * move it, and the server checks each one (`PATCH /api/chats/:id/permissions`).
 */
export function GroupPermissionsRow(props: { chatId: string; jwt: string; permissions: unknown; isAdmin: boolean; onAviso: (text: string) => void }) {
  const [value, setValue] = useState(() => memberPermissionsOf(props.permissions));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setValue(memberPermissionsOf(props.permissions));
  }, [props.permissions]);
  const change = async (key: MemberPermission, next: boolean) => {
    setValue((current) => ({ ...current, [key]: next }));
    setSaving(true);
    const undo = () => setValue((current) => ({ ...current, [key]: !next }));
    try {
      const response = await fetch(`/api/chats/${props.chatId}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ [key]: next }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        undo();
        props.onAviso(body?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      undo();
      props.onAviso('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section data-testid="permisos-del-grupo" className="mt-2 bg-surface px-6 py-3">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"><ShieldCheck size={14} /> Permisos</p>
      <p className="mt-1 text-[12px] text-on-surface-variant">{props.isAdmin ? 'Qué pueden hacer los miembros. Los admins siempre pueden todo.' : 'Qué pueden hacer los miembros. Solo los admins pueden cambiarlo.'}</p>
      {MEMBER_PERMISSION_ROWS.map((row) => (
        <label key={row.key} className={`flex min-h-[56px] items-center gap-4 border-t border-outline/10 py-2 ${props.isAdmin ? 'cursor-pointer' : ''}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px]">{row.title}</span>
            <span className="block text-[12px] text-on-surface-variant">{row.detail}</span>
          </span>
          <input type="checkbox" role="switch" data-testid={`interruptor-permiso-${row.key}`} checked={value[row.key]} disabled={!props.isAdmin || saving} onChange={() => void change(row.key, !value[row.key])} className="h-5 w-5 accent-primary" />
        </label>
      ))}
    </section>
  );
}
