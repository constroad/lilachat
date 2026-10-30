import { Bell, BellOff, LogOut, Trash2, X } from 'lucide-react';
import { NOTIFICATION_LEVEL_TEXT, type NotificationLevel } from '@lilachat/shared';
import { chatDetailTabs, initialChatDetailTab, type ChatDetailTab } from '@lilachat/shared';
import { useState, type ReactNode } from 'react';
import type { BaseLocal } from '../../local/baseLocal';
import { ConfirmChatAction } from '../MenuDeChat';
import type { ChatAction } from '../menuDelChat';
import type { DetalleDelChat } from '../useDetalleDelChat';
import type { ChatSummary, MensajeEnPantalla } from '../types';
import { ArchivosDelChat } from './ArchivosDelChat';
import { DetailTabBar } from './DetailTabBar';
import { IdentidadDelChat } from './IdentidadDelChat';
import { DescripcionDelChat } from './DescripcionDelChat';
import { GroupFunRow } from './GroupFunRow';
import { GroupPermissionsRow } from './GroupPermissionsRow';
import { BirthdaysRow } from './BirthdaysRow';
import { ChannelVisibilityRow } from './ChannelVisibilityRow';
import { armarInfo } from './infoDelChat';
import { NotificationLevelDialog } from './NotificationLevelDialog';
import { ParticipantesDelChat } from './ParticipantesDelChat';
import { useEditarChat } from './useEditarChat';

const NO_APPS: ReadonlySet<string> = new Set();

/**
 * «Info. del grupo / del contacto / del borrador» (W3b, diseño
 * `w3-web-info-grupo.png`): tercera columna de 400 px desde 1024 px; en
 * pantallas más angostas, encima de la conversación.
 *
 * Pending 69: grouped in tabs like WhatsApp (Miembros · Media · Ajustes).
 */
export function PanelDeInfo(props: {
  chat: ChatSummary;
  detalle: DetalleDelChat | null;
  yo: string;
  jwt: string;
  base: BaseLocal | null;
  onCerrar: () => void;
  onAviso: (texto: string) => void;
  onCambio: () => void;
  onAccionDeChat: (chat: ChatSummary, accion: ChatAction) => void;
  /** E3b: a group's notification level. */
  onLevel: (chat: ChatSummary, level: NotificationLevel) => void;
  onVerFoto: (mensaje: MensajeEnPantalla) => void;
  /** Tarjetas que arma la conversación (20/10: los fijados), antes de los archivos. */
  tarjetas?: ReactNode;
  /** A member's row opens their card (José, 25/10). */
  onViewPerson?: (userId: string) => void;
}) {
  const { chat, detalle } = props;
  const info = armarInfo({ chat, detalle, yo: props.yo });
  const editar = useEditarChat({ chatId: chat.id, jwt: props.jwt, onCambio: props.onCambio, onAviso: props.onAviso });
  const [confirmando, setConfirmando] = useState<ChatAction | null>(null);
  const silenciado = Boolean(chat.muted ?? detalle?.silenciado);
  const level: NotificationLevel = chat.avisos ?? (silenciado ? 'menciones' : 'todo');
  const [choosingLevel, setChoosingLevel] = useState(false);
  const [tab, setTab] = useState<ChatDetailTab>(() => initialChatDetailTab(chat.kind));
  return (
    <aside data-testid="panel-info" className="fixed inset-0 z-30 flex flex-col bg-background lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:border-l lg:border-outline/15">
      <header className="flex items-center gap-3 border-b border-outline/15 bg-surface px-3 py-3">
        <button type="button" data-testid="btn-cerrar-info" aria-label="Cerrar" onClick={props.onCerrar} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <X size={20} />
        </button>
        <h2 className="text-base font-semibold">{info.titulo}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <IdentidadDelChat
          chat={chat}
          nombre={chat.name ?? chat.phone ?? 'Conversación'}
          foto={chat.avatarUrl ?? detalle?.foto}
          subtitulo={info.subtitulo}
          puedeEditar={info.puedeEditar}
          onRenombrar={editar.renombrar}
          onCambiarFoto={(archivo) => void editar.cambiarFoto(archivo)}
        />
        {chat.kind !== 'direct' ? <DescripcionDelChat descripcion={detalle?.descripcion} editable={info.puedeEditar} onGuardar={editar.describir} /> : null}
        {props.tarjetas}
        <DetailTabBar tabs={chatDetailTabs(chat.kind)} active={tab} onChange={setTab} />
        {tab === 'members' && info.miembros.length ? (
          <ParticipantesDelChat
            jwt={props.jwt}
            workspaceId={chat.workspaceId}
            miembros={info.miembros}
            appIds={detalle?.appIds ?? NO_APPS}
            puedeAgregar={info.puedeAgregar}
            onAgregar={(userId) => void editar.agregar(userId)}
            onCambiarRol={(userId, role) => void editar.cambiarRol(userId, role)}
            onSacar={(userId) => void editar.sacar(userId)}
            onViewPerson={props.onViewPerson}
          />
        ) : null}
        {tab === 'media' ? <ArchivosDelChat base={props.base} chatId={chat.id} onVerFoto={props.onVerFoto} /> : null}
        {tab === 'settings' && chat.kind === 'group' ? (
          <button type="button" data-testid="btn-avisos" onClick={() => setChoosingLevel(true)} className="mt-2 flex min-h-[56px] w-full items-center gap-4 bg-surface px-6 text-left hover:bg-background">
            {level === 'todo' ? <Bell size={18} className="text-on-surface-variant" /> : <BellOff size={18} className="text-on-surface-variant" />}
            <span className="flex-1 text-[15px]">Avisos</span>
            <span className="text-sm text-on-surface-variant">{NOTIFICATION_LEVEL_TEXT[level].title}</span>
          </button>
        ) : null}
        {tab === 'settings' && (chat.channel || detalle?.channel) ? <ChannelVisibilityRow chatId={chat.id} jwt={props.jwt} isPrivate={detalle?.channel ? detalle.channel.isPrivate : chat.channel?.visibility === 'private'} isAdmin={Boolean(detalle?.soyAdmin)} isGeneral={Boolean(detalle?.channel?.general)} onNotice={props.onAviso} /> : null}
        {tab === 'settings' && chat.kind === 'group' ? <GroupPermissionsRow chatId={chat.id} jwt={props.jwt} permissions={detalle?.memberPermissions} isAdmin={Boolean(detalle?.soyAdmin)} onAviso={props.onAviso} /> : null}
        {tab === 'settings' && chat.kind === 'group' ? <GroupFunRow chatId={chat.id} jwt={props.jwt} allowed={Boolean(chat.funAllowed ?? detalle?.funAllowed)} isAdmin={Boolean(detalle?.soyAdmin)} onAviso={props.onAviso} /> : null}
        {tab === 'settings' && (chat.kind === 'group' || chat.kind === 'direct') ? <BirthdaysRow chatId={chat.id} jwt={props.jwt} on={Boolean(chat.birthdaysOn ?? detalle?.birthdaysOn)} canChange={chat.kind === 'direct' || Boolean(detalle?.soyAdmin)} isGroup={chat.kind === 'group'} onAviso={props.onAviso} /> : null}
        {choosingLevel ? (
          <NotificationLevelDialog
            level={level}
            onChoose={(next) => {
              setChoosingLevel(false);
              props.onLevel(chat, next);
            }}
            onClose={() => setChoosingLevel(false)}
          />
        ) : null}
        {tab !== 'settings' || chat.kind !== 'direct' ? null : (
          <label className="mt-2 flex min-h-[56px] cursor-pointer items-center gap-4 bg-surface px-6">
            <Bell size={18} className="text-on-surface-variant" />
            <span className="flex-1 text-[15px]">Silenciar notificaciones</span>
            <input
              type="checkbox"
              role="switch"
              data-testid="interruptor-silenciar"
              checked={silenciado}
              onChange={() => props.onAccionDeChat(chat, silenciado ? 'reactivar' : 'silenciar')}
              className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-outline/30 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-primary checked:before:translate-x-[18px]"
            />
          </label>
        )}
        {tab !== 'settings' ? null : (
        <section className="mt-2 bg-surface py-2">
          {info.puedeSalir ? (
            <button type="button" data-testid="btn-salir-del-grupo" onClick={() => setConfirmando('salir')} className="flex min-h-[52px] w-full items-center gap-4 px-6 text-left text-[15px] text-error hover:bg-background">
              <LogOut size={18} /> Salir del grupo
            </button>
          ) : null}
          {info.puedeEliminar ? (
            <button type="button" data-testid="btn-eliminar-desde-info" onClick={() => setConfirmando('eliminar')} className="flex min-h-[52px] w-full items-center gap-4 px-6 text-left text-[15px] text-error hover:bg-background">
              <Trash2 size={18} /> Eliminar chat
            </button>
          ) : null}
        </section>
        )}
      </div>
      {confirmando ? (
        <ConfirmChatAction
          chat={chat}
          accion={confirmando}
          onCerrar={() => setConfirmando(null)}
          onConfirmar={() => {
            const accion = confirmando;
            setConfirmando(null);
            props.onAccionDeChat(chat, accion);
            if (accion === 'eliminar') props.onCerrar();
          }}
        />
      ) : null}
    </aside>
  );
}
