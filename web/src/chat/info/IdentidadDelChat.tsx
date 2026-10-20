import { useRef, useState } from 'react';
import { Camera, Check, Pencil, X } from 'lucide-react';
import { MAX_NOMBRE_DE_GRUPO } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import type { ChatSummary } from '../types';

/** Foto grande, nombre (editable si se puede) y la línea de abajo (W3b). */
export function IdentidadDelChat(props: {
  chat: ChatSummary;
  nombre: string;
  foto?: string;
  subtitulo: string;
  puedeEditar: boolean;
  onRenombrar: (nombre: string) => Promise<boolean>;
  onCambiarFoto: (archivo: File) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(props.nombre);
  const archivo = useRef<HTMLInputElement>(null);
  const guardar = async () => {
    if (await props.onRenombrar(borrador)) setEditando(false);
  };
  return (
    <section className="flex flex-col items-center bg-surface px-6 pb-6 pt-8">
      <div className="relative">
        <Avatar name={props.nombre} kind={props.chat.kind} foto={props.foto} size={160} />
        {props.puedeEditar ? (
          <>
            <button type="button" data-testid="btn-cambiar-foto" aria-label="Cambiar la foto" onClick={() => archivo.current?.click()} className="absolute bottom-1 right-1 grid h-11 w-11 place-items-center rounded-full border-2 border-surface bg-primary text-on-primary">
              <Camera size={18} />
            </button>
            <input
              ref={archivo}
              type="file"
              accept="image/*"
              hidden
              data-testid="input-foto-del-chat"
              onChange={(evento) => {
                const elegido = evento.target.files?.[0];
                if (elegido) props.onCambiarFoto(elegido);
                evento.target.value = '';
              }}
            />
          </>
        ) : null}
      </div>
      {editando ? (
        <div className="mt-5 flex w-full items-center gap-2">
          <input
            data-testid="input-nombre-del-chat"
            autoFocus
            value={borrador}
            maxLength={MAX_NOMBRE_DE_GRUPO}
            onChange={(evento) => setBorrador(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') void guardar();
              if (evento.key === 'Escape') setEditando(false);
            }}
            className="h-11 min-w-0 flex-1 rounded-xl border border-primary bg-background px-3 text-base outline-none"
          />
          <button type="button" data-testid="btn-guardar-nombre" aria-label="Guardar el nombre" onClick={() => void guardar()} className="grid h-11 w-11 place-items-center rounded-full text-primary hover:bg-primary/10">
            <Check size={20} />
          </button>
          <button type="button" aria-label="Cancelar" onClick={() => setEditando(false)} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2">
          <h3 data-testid="nombre-en-info" className="text-center text-2xl font-semibold">
            {props.nombre}
          </h3>
          {props.puedeEditar ? (
            <button
              type="button"
              data-testid="btn-editar-nombre"
              aria-label="Cambiar el nombre"
              onClick={() => {
                setBorrador(props.nombre);
                setEditando(true);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background"
            >
              <Pencil size={16} />
            </button>
          ) : null}
        </div>
      )}
      <p className="mt-1 text-sm text-on-surface-variant">{props.subtitulo}</p>
    </section>
  );
}
