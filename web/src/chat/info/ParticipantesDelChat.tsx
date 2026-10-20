import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { AccionDeMiembro } from '@lilachat/shared';
import { useContactos } from '../../agenda/CreatePanels';
import { ContactPicker } from '../../contacts/ContactPicker';
import { Avatar } from '../../ui/Avatar';
import { Overlay } from '../../ui/Overlay';
import type { MiembroEnInfo } from './infoDelChat';

const ETIQUETAS: Record<AccionDeMiembro, string> = { 'hacer-admin': 'Nombrar admin', 'dejar-admin': 'Quitar como admin', sacar: 'Sacar del grupo' };

/** Los participantes del grupo (W3b): sumar, y el menú de cada uno con lo que se puede. */
export function ParticipantesDelChat(props: {
  jwt: string;
  miembros: MiembroEnInfo[];
  puedeAgregar: boolean;
  onAgregar: (userId: string) => void;
  onCambiarRol: (userId: string, role: 'admin' | 'member') => void;
  onSacar: (userId: string) => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [sacando, setSacando] = useState<MiembroEnInfo | null>(null);
  const aplicar = (miembro: MiembroEnInfo, accion: AccionDeMiembro) => {
    if (accion === 'sacar') return setSacando(miembro);
    props.onCambiarRol(miembro.id, accion === 'hacer-admin' ? 'admin' : 'member');
  };
  return (
    <section data-testid="participantes" className="mt-2 bg-surface py-2">
      <h4 className="px-6 py-2 text-sm text-on-surface-variant">{props.miembros.length} participantes</h4>
      {props.puedeAgregar ? (
        <button type="button" data-testid="btn-agregar-participante" onClick={() => setAgregando(true)} className="flex min-h-[56px] w-full items-center gap-4 px-6 text-left hover:bg-background">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-on-primary">
            <UserPlus size={18} />
          </span>
          <span className="text-[15px]">Añadir participante</span>
        </button>
      ) : null}
      {props.miembros.map((miembro) => (
        <div key={miembro.id} data-testid={`participante-${miembro.id}`} className="group flex min-h-[60px] items-center gap-4 px-6 hover:bg-background">
          <Avatar name={miembro.nombre} foto={miembro.foto} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{miembro.nombre}</span>
            {miembro.telefono && !miembro.esYo ? <span className="block text-xs text-on-surface-variant">{miembro.telefono}</span> : null}
          </span>
          {miembro.rol === 'admin' ? <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Admin</span> : null}
          {miembro.acciones.length ? (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button type="button" data-testid={`menu-participante-${miembro.id}`} aria-label={`Opciones de ${miembro.nombre}`} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant opacity-60 hover:bg-surface focus:opacity-100 group-hover:opacity-100">
                  <ChevronDown size={16} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} onCloseAutoFocus={(evento) => evento.preventDefault()} className="z-40 min-w-[200px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
                  {miembro.acciones.map((accion) => (
                    <DropdownMenu.Item
                      key={accion}
                      data-testid={`accion-participante-${accion}`}
                      onSelect={() => aplicar(miembro, accion)}
                      className={`flex min-h-[40px] cursor-pointer items-center rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background ${accion === 'sacar' ? 'text-error' : ''}`}
                    >
                      {ETIQUETAS[accion]}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      ))}
      {agregando ? (
        <AgregarParticipante
          jwt={props.jwt}
          yaEstan={new Set(props.miembros.map((uno) => uno.id))}
          onElegir={(userId) => {
            setAgregando(false);
            props.onAgregar(userId);
          }}
          onCerrar={() => setAgregando(false)}
        />
      ) : null}
      {sacando ? (
        <Overlay
          title={`¿Sacar a ${sacando.nombre} del grupo?`}
          onClose={() => setSacando(null)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setSacando(null)} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
                Cancelar
              </button>
              <button
                type="button"
                data-testid="btn-confirmar-sacar"
                onClick={() => {
                  props.onSacar(sacando.id);
                  setSacando(null);
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-error text-sm font-semibold text-white"
              >
                Sacar
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">Deja de recibir los mensajes del grupo. En el chat queda la línea «sacaste a…».</p>
        </Overlay>
      ) : null}
    </section>
  );
}

/** Elegir a quién sumar: los contactos con Lilachat que todavía no están. */
function AgregarParticipante(props: { jwt: string; yaEstan: ReadonlySet<string>; onElegir: (userId: string) => void; onCerrar: () => void }) {
  const grupos = useContactos(props.jwt, true);
  const disponibles = (grupos ?? []).map((grupo) => ({ ...grupo, contacts: grupo.contacts.filter((uno) => !props.yaEstan.has(uno.id)) })).filter((grupo) => grupo.contacts.length);
  return (
    <Overlay title="Añadir participante" onClose={props.onCerrar}>
      <ContactPicker groups={disponibles} selected={[]} onToggle={(contacto) => props.onElegir(contacto.id)} loading={grupos === null} multiple={false} />
    </Overlay>
  );
}
