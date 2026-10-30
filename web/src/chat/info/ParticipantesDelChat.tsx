import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { AccionDeMiembro } from '@lilachat/shared';
import { membersHeading } from '@lilachat/shared';
import { ContactPicker } from '../../contacts/ContactPicker';
import type { Contact } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Overlay } from '../../ui/Overlay';
import type { MiembroEnInfo } from './infoDelChat';
import { useAddCandidates } from './useAddCandidates';
import { HistoryChoiceDialog } from './HistoryChoiceDialog';

const ETIQUETAS: Record<AccionDeMiembro, string> = { 'hacer-admin': 'Nombrar admin', 'dejar-admin': 'Quitar como admin', sacar: 'Sacar del grupo' };
/** An app is taken out of the channel, and stays out until an admin adds it again (pending 91). */
const labelOf = (isApp: boolean, accion: AccionDeMiembro) => (isApp && accion === 'sacar' ? 'Quitar del canal' : ETIQUETAS[accion]);

/** Los participantes del grupo (W3b): sumar, y el menú de cada uno con lo que se puede. */
export function ParticipantesDelChat(props: {
  jwt: string;
  /** Inside a space, «Agregar miembros» lists the space's members. */
  workspaceId?: string;
  miembros: MiembroEnInfo[];
  /** The installed apps among them (pending 91). */
  appIds: ReadonlySet<string>;
  puedeAgregar: boolean;
  /** The chat already has messages: adding someone asks whether they see them. */
  hasHistory?: boolean;
  onAgregar: (userId: string, history?: boolean) => void;
  onCambiarRol: (userId: string, role: 'admin' | 'member') => void;
  onSacar: (userId: string) => void;
  /** Tapping a row opens that person's card (José, 25/10). Without it, the rows are plain. */
  onViewPerson?: (userId: string) => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [askingHistory, setAskingHistory] = useState<Contact | null>(null);
  const [sacando, setSacando] = useState<MiembroEnInfo | null>(null);
  const aplicar = (miembro: MiembroEnInfo, accion: AccionDeMiembro) => {
    if (accion === 'sacar') return setSacando(miembro);
    props.onCambiarRol(miembro.id, accion === 'hacer-admin' ? 'admin' : 'member');
  };
  return (
    <section data-testid="participantes" className="mt-2 bg-surface py-2">
      {props.puedeAgregar ? (
        <button type="button" data-testid="btn-agregar-participante" onClick={() => setAgregando(true)} className="flex min-h-[56px] w-full items-center gap-4 px-6 text-left hover:bg-background">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <UserPlus size={18} />
          </span>
          <span className="text-[15px] font-semibold text-primary">Agregar miembros</span>
        </button>
      ) : null}
      {/* Pending 69 (design `r151-detalle-grupo`): «Agregar miembros» first, then how many they are. */}
      <h4 className="px-6 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">{membersHeading(props.miembros.length)}</h4>
      {props.miembros.map((miembro) => (
        <div key={miembro.id} data-testid={`participante-${miembro.id}`} className="group flex min-h-[60px] items-center gap-4 px-6 hover:bg-background">
          <MemberTap onTap={props.onViewPerson && !miembro.esYo ? () => props.onViewPerson?.(miembro.id) : undefined} id={miembro.id} name={miembro.nombre}>
            <Avatar name={miembro.nombre} foto={miembro.foto} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{miembro.nombre}</span>
              {miembro.telefono && !miembro.esYo ? <span className="block text-xs text-on-surface-variant">{miembro.telefono}</span> : null}
            </span>
          </MemberTap>
          {miembro.rol === 'admin' ? <span className="shrink-0 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-primary">Admin del grupo</span> : null}
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
                      {labelOf(props.appIds.has(miembro.id), accion)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      ))}
      {agregando ? (
        <AddParticipant
          jwt={props.jwt}
          workspaceId={props.workspaceId}
          yaEstan={new Set(props.miembros.map((uno) => uno.id))}
          onElegir={(contact) => {
            setAgregando(false);
            if (props.hasHistory) setAskingHistory(contact);
            else props.onAgregar(contact.id);
          }}
          onCerrar={() => setAgregando(false)}
        />
      ) : null}
      {askingHistory ? (
        <HistoryChoiceDialog
          name={askingHistory.name ?? askingHistory.phone}
          onChoose={(history) => {
            setAskingHistory(null);
            props.onAgregar(askingHistory.id, history);
          }}
          onClose={() => setAskingHistory(null)}
        />
      ) : null}
      {sacando ? (
        <Overlay
          title={props.appIds.has(sacando.id) ? `¿Quitar ${sacando.nombre} del canal?` : `¿Sacar a ${sacando.nombre} del grupo?`}
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
                {props.appIds.has(sacando.id) ? 'Quitar' : 'Sacar'}
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">{props.appIds.has(sacando.id) ? 'Deja de publicar aquí y no vuelve sola. Para que vuelva, un admin elige este canal en «¿Dónde llega cada aviso?», en el detalle de la app.' : 'Deja de recibir los mensajes del grupo. En el chat queda la línea «sacaste a…».'}</p>
        </Overlay>
      ) : null}
    </section>
  );
}

/** Pick who to add: the contacts with Lilachat that are not in yet (inside a space, its members). */
function AddParticipant(props: { jwt: string; workspaceId?: string; yaEstan: ReadonlySet<string>; onElegir: (contact: Contact) => void; onCerrar: () => void }) {
  const groups = useAddCandidates(props.jwt, props.workspaceId);
  const available = (groups ?? []).map((group) => ({ ...group, contacts: group.contacts.filter((one) => !props.yaEstan.has(one.id)) })).filter((group) => group.contacts.length);
  return (
    <Overlay title="Añadir participante" onClose={props.onCerrar}>
      <ContactPicker groups={available} selected={[]} onToggle={(contact) => props.onElegir(contact)} loading={groups === null} multiple={false} />
    </Overlay>
  );
}

/** The photo and name of a member: a button to their card when there is one, the plain row when not. */
function MemberTap(props: { onTap?: () => void; id: string; name: string; children: ReactNode }) {
  if (!props.onTap) return <div className="flex min-w-0 flex-1 items-center gap-4">{props.children}</div>;
  return (
    <button type="button" data-testid={`ver-participante-${props.id}`} aria-label={`Ver a ${props.name}`} onClick={props.onTap} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-4 text-left">
      {props.children}
    </button>
  );
}
