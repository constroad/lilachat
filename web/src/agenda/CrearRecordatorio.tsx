import { useMemo, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { aQuienSuena, crearRecordatorio, editarRecordatorio, ETIQUETA_DE_REPETICION, opcionesRapidas, valorInicial, type AgendaReminder, type Recurrence } from '@lilachat/shared';
import { api } from '../api';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';
import { aValorLocal, validarRecordatorio } from './formularioDeRecordatorio';

export { aValorLocal, validarRecordatorio } from './formularioDeRecordatorio';

const REPETICIONES: Recurrence[] = ['once', 'daily', 'weekly'];
const CAMPO = 'mt-1 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary aria-[invalid=true]:border-error';

type ChatDelRecordatorio = { id: string; name?: string | null; kind: 'direct' | 'group' | 'notas' };

/** La imagen va como archivo: el `api` común manda JSON. */
async function subirImagen(id: string, archivo: File, jwt: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const formulario = new FormData();
  formulario.append('file', archivo);
  try {
    const respuesta = await fetch(`/api/agenda/reminders/${id}/imagen`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: formulario });
    if (respuesta.ok) return { ok: true };
    const datos = (await respuesta.json().catch(() => ({}))) as { message?: string };
    return { ok: false, motivo: datos.message ?? 'No se pudo subir.' };
  } catch {
    return { ok: false, motivo: 'Sin conexión.' };
  }
}

/**
 * Crear o editar un recordatorio desde la web —de un chat o personal, sin chat—
 * (W3c, 20/10; diseño
 * `w3c-web-recordatorio`), con el mismo cuerpo y el mismo orden que la app
 * (`crearRecordatorio`: con imagen se publica recién después de subirla).
 */
export function CrearRecordatorio({ jwt, chat, editando, onClose, onGuardado }: { jwt: string; chat: ChatDelRecordatorio | null; editando?: AgendaReminder; onClose: () => void; onGuardado: () => void }) {
  const [titulo, setTitulo] = useState(editando?.title ?? '');
  const [nota, setNota] = useState(editando?.note ?? '');
  const [cuando, setCuando] = useState(() => aValorLocal(valorInicial(editando?.startsAt, new Date())));
  const [repetir, setRepetir] = useState<Recurrence>(editando?.recurrence ?? 'once');
  const [imagen, setImagen] = useState<File | null>(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const atajos = useMemo(() => opcionesRapidas(new Date()), []);

  const guardar = async () => {
    if (guardando) return;
    const fecha = new Date(cuando);
    const invalido = validarRecordatorio({ titulo, cuando: fecha, repetir, ahora: new Date() });
    if (invalido) return setError(invalido);
    setGuardando(true);
    setError('');
    const cuerpo = { title: titulo.trim(), note: nota.trim(), startsAt: fecha.toISOString(), recurrence: repetir };
    const resultado = editando
      ? await editarRecordatorio(
          { imagen: imagen ? 'nueva' : quitarImagen ? 'quitar' : 'igual' },
          {
            guardar: async () => {
              const r = await api(`/agenda/reminders/${editando._id}`, { method: 'PATCH', jwt, body: cuerpo });
              return r.ok ? { ok: true } : { ok: false, motivo: r.message };
            },
            subirImagen: () => subirImagen(editando._id, imagen!, jwt),
            quitarImagen: async () => ({ ok: (await api(`/agenda/reminders/${editando._id}/imagen`, { method: 'DELETE', jwt })).ok }),
          }
        )
      : await crearRecordatorio(
          { conImagen: Boolean(imagen), delGrupo: Boolean(chat) },
          {
            crear: async ({ publicar }) => {
              const r = await api<{ id?: string }>('/agenda/reminders', { jwt, body: { ...cuerpo, note: cuerpo.note || undefined, ...(chat ? { chatId: chat.id, publicar } : {}) } });
              return r.ok && r.data.id ? { ok: true, id: r.data.id } : { ok: false, motivo: r.ok ? 'No se pudo crear.' : r.message };
            },
            subirImagen: (id) => subirImagen(id, imagen!, jwt),
            publicar: async (id) => ({ ok: (await api(`/agenda/reminders/${id}/publicar`, { method: 'POST', jwt, body: {} })).ok }),
          }
        );
    setGuardando(false);
    // Guardado aunque la imagen falle: se cierra (reintentar crearía otro igual).
    if (resultado.ok || resultado.guardado) return onGuardado();
    setError(resultado.motivo);
  };

  const eliminar = async () => {
    if (!editando || !window.confirm('¿Eliminar el recordatorio? Deja de sonar para todos.')) return;
    const r = await api(`/agenda/reminders/${editando._id}`, { method: 'DELETE', jwt });
    if (r.ok) onGuardado();
    else setError(r.message);
  };

  const conImagen = Boolean(imagen) || (Boolean(editando?.imageUrl) && !quitarImagen);
  return (
    <Overlay
      title={editando ? 'Editar recordatorio' : 'Nuevo recordatorio'}
      onClose={onClose}
      footer={
        <>
          <div className="flex items-center gap-2">
            {editando ? (
              <button type="button" data-testid="btn-eliminar-recordatorio" onClick={() => void eliminar()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-error hover:bg-error/10" aria-label="Eliminar el recordatorio" title="Eliminar">
                <Trash2 size={18} />
              </button>
            ) : null}
            <PrimaryButton testId="btn-guardar-recordatorio" onClick={() => void guardar()} disabled={guardando}>
              {editando ? 'Guardar cambios' : 'Crear recordatorio'}
            </PrimaryButton>
          </div>
          <FieldError>{error}</FieldError>
        </>
      }
    >
      <p className="mb-3 text-[12px] text-on-surface-variant">{chat ? aQuienSuena(chat.kind, chat.name ?? 'este chat') : aQuienSuena('notas', '')}</p>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Qué recordar</span>
        <input data-testid="titulo-recordatorio" value={titulo} onChange={(evento) => { setTitulo(evento.target.value); setError(''); }} placeholder="Pagar la luz" aria-invalid={Boolean(error) && !titulo.trim()} className={`${CAMPO} h-11`} />
      </label>
      <textarea data-testid="nota-recordatorio" value={nota} onChange={(evento) => setNota(evento.target.value)} rows={2} placeholder="Descripción (opcional): los links se podrán tocar en el chat" className={`${CAMPO} py-2.5`} />

      <fieldset className="mt-4">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Cuándo</legend>
        <input type="datetime-local" data-testid="fecha-recordatorio" value={cuando} onChange={(evento) => { setCuando(evento.target.value); setError(''); }} className={`${CAMPO} h-11`} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {atajos.map((atajo) => (
            <button key={atajo.id} type="button" data-testid={`atajo-${atajo.id}`} onClick={() => { setCuando(aValorLocal(atajo.fecha)); setError(''); }} className="min-h-[32px] rounded-lg bg-background px-2.5 text-[12px] text-on-surface-variant hover:bg-primary/10 hover:text-primary">
              {atajo.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Repetir</legend>
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-background p-1">
          {REPETICIONES.map((opcion) => (
            <button key={opcion} type="button" data-testid={`repetir-${opcion}`} aria-pressed={repetir === opcion} onClick={() => setRepetir(opcion)} className={`min-h-[40px] rounded-lg text-[13px] font-medium ${repetir === opcion ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              {ETIQUETA_DE_REPETICION[opcion]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Imagen (opcional)</p>
        <label className="mt-1 flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-outline/40 bg-background px-3 text-[13px] text-primary hover:bg-primary/5">
          <ImagePlus size={18} />
          <span className="truncate">{imagen ? imagen.name : conImagen ? 'Cambiar la imagen' : 'Agregar una imagen · se ve en la tarjeta del chat'}</span>
          <input type="file" accept="image/*" data-testid="imagen-recordatorio" className="hidden" onChange={(evento) => { setImagen(evento.target.files?.[0] ?? null); setQuitarImagen(false); }} />
        </label>
        {conImagen ? (
          <button type="button" onClick={() => { setImagen(null); setQuitarImagen(true); }} className="mt-1 text-[12px] text-on-surface-variant underline">
            Quitar la imagen
          </button>
        ) : null}
      </div>
    </Overlay>
  );
}
