import { useState } from 'react';
import { api } from '../api';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';

/**
 * Un borrador nuevo (W3a): un chat solo contigo, con nombre, para notas, fotos
 * y links. Es el mismo `kind: 'notas'` de la app (FL15); el nombre lo valida el
 * server con la regla de los grupos.
 */
export function NuevoBorrador({ jwt, onClose, onCreated }: { jwt: string; onClose: () => void; onCreated: (chatId: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    if (guardando) return;
    if (!nombre.trim()) return setError('Ponle un nombre al borrador.');
    setGuardando(true);
    const creado = await api<{ chatId: string }>('/chats', { jwt, body: { kind: 'notas', name: nombre.trim() } });
    setGuardando(false);
    if (!creado.ok) return setError(creado.message);
    onCreated(creado.data.chatId);
  };

  return (
    <Overlay
      title="Nuevo borrador"
      onClose={onClose}
      footer={
        <>
          <PrimaryButton testId="btn-crear-borrador" onClick={() => void crear()} disabled={guardando}>
            Crear borrador
          </PrimaryButton>
          <FieldError>{error}</FieldError>
        </>
      }
    >
      <label className="block">
        <span className="text-[12px] font-semibold text-on-surface-variant">
          Nombre <span className="text-error">*</span>
        </span>
        <input
          data-testid="nombre-borrador"
          autoFocus
          value={nombre}
          onChange={(evento) => {
            setNombre(evento.target.value);
            setError('');
          }}
          onKeyDown={(evento) => evento.key === 'Enter' && void crear()}
          placeholder="Ideas, Compras, Links para leer…"
          aria-invalid={Boolean(error) && !nombre.trim()}
          className="mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary aria-[invalid=true]:border-error"
        />
      </label>
      <p className="mt-3 text-[13px] leading-5 text-on-surface-variant">Solo tú lo ves. Escríbete notas, guarda fotos y enlaces.</p>
    </Overlay>
  );
}
