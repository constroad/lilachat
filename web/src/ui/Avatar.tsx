import { Users } from 'lucide-react';

/**
 * El avatar del diseño: círculo de acento con la inicial, o el icono de grupo
 * si es una conversación de varios. El punto de presencia va PEGADO al borde
 * inferior derecho, con un anillo del color del fondo para que se lea sobre
 * cualquier superficie.
 */
export function Avatar({
  name,
  kind = 'direct',
  size = 40,
  online,
}: {
  name?: string | null;
  kind?: 'direct' | 'group';
  size?: number;
  online?: boolean;
}) {
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full bg-primary text-on-primary"
        style={{ fontSize: size * 0.4 }}
      >
        {kind === 'group' ? <Users size={size * 0.5} /> : <span className="font-semibold">{initial}</span>}
      </div>
      {online === undefined ? null : (
        <span
          data-testid="punto-presencia"
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-surface ${
            online ? 'bg-emerald-500' : 'bg-outline/50'
          }`}
          style={{ width: size * 0.25, height: size * 0.25 }}
        />
      )}
    </div>
  );
}
