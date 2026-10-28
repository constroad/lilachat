import { useFunPlayback } from './nudge';
import { useLastSeen } from './useLastSeen';
import { usePresenceStatus } from '../presence/presenceStatus';
import { NotificationsBanner } from '../notify/NotificationsBanner';
import { ConversacionContext } from './contextoDeLaConversacion';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Phone, Search, Video } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { AgendaReminder, DirectoryApp, MencionElegida, MencionEnMensaje, WinkId } from '@lilachat/shared';
import { formatUltimaVez, presenceLine, type PresenceStatus, memberCountLabel } from '@lilachat/shared';
import { Composer, type ContextoDelComposer } from './Composer';
import { useChatCommands } from './commands/useChatCommands';
import { AppCommandsBar, AppConversationHeader, type AppConversationTab } from '../spaces/apps/AppConversation';
import { AppDetail } from '../spaces/apps/AppDetail';
import type { SpaceApps } from '../spaces/apps/useSpaceApps';
import type { Mencionable } from './SugerenciasDeMencion';
import type { NotaDeVozGrabada } from './useGrabadoraDeVoz';
import { ListaDeMensajes } from './ListaDeMensajes';
import type { ChatSummary, MensajeEnPantalla } from './types';

/**
 * El panel derecho: cabecera, mensajes y composer.
 *
 * ONE header. Video call and call work in a 1:1 with a person (José, 21/10);
 * search is still to come: dimmed, and hidden on a narrow screen, where the
 * name needs the width.
 *
 * Los mensajes salen de la base local (W1): `null` es que todavía se está
 * leyendo el disco, no la red.
 */
export function Conversation(props: {
  chat: ChatSummary;
  mensajes: MensajeEnPantalla[] | null;
  yo: string;
  typingName: string | null;
  onBack: () => void;
  onSend: (text: string, menciones?: MencionEnMensaje[]) => void;
  /** En grupos: a quién se puede @mencionar (W2). */
  mencionables?: Mencionable[];
  onOutsideMentions?: (people: MencionElegida[]) => void;
  avisoDeMencion?: ReactNode;
  /** Para pedir tarjetas de enlaces al escribir; sin él no se piden. */
  jwtParaEnlaces?: string;
  onNotaDeVoz?: (nota: NotaDeVozGrabada) => void;
  onEscribiendo?: () => void;
  /** Respondiendo o editando (W2): la franja sobre el campo. */
  contexto?: ContextoDelComposer | null;
  onCancelarContexto?: () => void;
  /** The message being replied to: a sticker also quotes it, then the strip closes. */
  replyingTo?: number;
  /** The MSN nudge (backlog 3), only in a 1:1. */
  onNudge?: () => void;
  onWink?: (wink: WinkId) => void;
  /** A 1:1 with a person: voice or video call (José, 21/10). Without it the buttons stay hidden. */
  onCall?: (video: boolean) => void;
  /** The arrow with «Programar llamada» and «Crear enlace de llamada» (pending 42). */
  callExtras?: ReactNode;
  showBack: boolean;
  hayAnteriores: boolean;
  onCargarAnteriores: () => void;
  onReintentar: (clientKey: string) => void;
  onDescartar: (clientKey: string) => void;
  onLeido: (seq: number) => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  /** W3c: el recordatorio del chat. Sin esto (sin permiso o secreto), el «+» no lo ofrece. */
  onCreateReminder?: () => void;
  onCreateChecklist?: () => void;
  /** Editar uno desde su tarjeta (W3c). */
  onEditReminder?: (recordatorio: AgendaReminder) => void;
  onElegirArchivos: (files: File[]) => void;
  /** La franja del mensaje fijado (19/10), bajo la cabecera. */
  franja?: ReactNode;
  /** The cards queued over the writing bar (backlog 36). */
  queue?: ReactNode;
  /** Ir a un mensaje (desde la franja). */
  salto?: { seq: number; vez: number } | null;
  onNoEsta?: () => void;
  /** A window around an old message (pending 44); `viewId` remounts the list when it opens or closes. */
  ventana?: { hasNewer: boolean; onCargarSiguientes: () => void; onIrAlUltimo: () => void };
  viewId?: number;
  /** Abrir «Info.» del chat (W3b) al tocar su nombre o su foto. */
  onAbrirInfo?: () => void;
  /** A 1:1 with an app (designs e-23/e-26): its head, the «Información» tab and its commands. */
  app?: DirectoryApp;
  spaceName?: string;
  /** The space's apps: its «Información» is the same detail as the directory's, with Ajustes for an admin (pending 99). */
  spaceApps?: SpaceApps;
}) {
  const { chat } = props;
  const [appTab, setAppTab] = useState<AppConversationTab>('messages');
  useEffect(() => {
    setAppTab('messages');
  }, [chat.id]);
  const [soltando, setSoltando] = useState(false);
  const otherId = chat.kind === 'direct' ? (chat.memberIds.find((id) => id !== props.yo) ?? null) : null;
  const lastSeen = useLastSeen(otherId);
  const otherStatus = usePresenceStatus(otherId);
  const fun = useFunPlayback({ messages: props.mensajes, me: props.yo, chatId: chat.id, muted: Boolean(chat.muted), afterSeq: chat.lastSeq - chat.unread });
  const commands = useChatCommands({ jwt: props.jwtParaEnlaces, chatId: chat.id, workspaceId: chat.workspaceId, shareable: chat.kind === 'group' });
  return (
    <section
      data-testid="panel-conversacion"
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragOver={(evento) => {
        if (!evento.dataTransfer.types.includes('Files')) return;
        evento.preventDefault();
        setSoltando(true);
      }}
      onDragLeave={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setSoltando(false);
      }}
      onDrop={(evento) => {
        evento.preventDefault();
        setSoltando(false);
        const soltados = [...evento.dataTransfer.files];
        if (soltados.length) props.onElegirArchivos(soltados);
      }}
    >
      {soltando ? (
        <div data-testid="zona-soltar" className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-surface/90 text-sm font-semibold text-primary">
          Suelta para enviar
        </div>
      ) : null}
      {fun.overlay}
      {props.app ? (
        <AppConversationHeader app={props.app} tab={appTab} onTab={setAppTab} showBack={props.showBack} onBack={props.onBack} />
      ) : (
        <CabeceraDeLaConversacion chat={chat} typingName={props.typingName} showBack={props.showBack} onBack={props.onBack} onAbrirInfo={props.onAbrirInfo} lastSeen={lastSeen} status={otherStatus} onCall={props.onCall} callExtras={props.callExtras} />
      )}
      {props.app && appTab === 'info' ? (
        <div data-testid="informacion-app" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-8">
          <div className="mx-auto max-w-3xl">
            <AppDetail
              key={props.app.appId}
              app={props.app}
              jwt={props.jwtParaEnlaces ?? ''}
              spaceId={props.jwtParaEnlaces ? (chat.workspaceId ?? null) : null}
              spaceName={props.spaceName ?? ''}
              admin={props.spaceApps?.directory?.canInstall ?? false}
              uninstalling={props.spaceApps?.uninstallingId === props.app.appId}
              onMessage={() => setAppTab('messages')}
              onInstall={() => props.app && props.spaceApps?.install(props.app)}
              onUninstall={props.spaceApps?.directory?.canInstall ? () => props.app && props.spaceApps?.uninstall(props.app) : undefined}
            />
          </div>
        </div>
      ) : (
      <>
      <BannerWithSession />
      {props.franja}
      {props.mensajes === null ? (
        <EsqueletoDeMensajes />
      ) : props.mensajes.length === 0 ? (
        <p className="min-h-0 flex-1 pt-10 text-center text-sm text-on-surface-variant">Todavía no hay mensajes. Escribe el primero.</p>
      ) : (
        <ListaDeMensajes
          key={`${chat.id}-${props.viewId ?? 0}`}
          chat={chat}
          mensajes={props.mensajes}
          yo={props.yo}
          escribiendo={Boolean(props.typingName)}
          hayAnteriores={props.hayAnteriores}
          onCargarAnteriores={props.onCargarAnteriores}
          onReintentar={props.onReintentar}
          onDescartar={props.onDescartar}
          onLeido={props.onLeido}
          salto={props.salto}
          onNoEsta={props.onNoEsta}
          ventana={props.ventana}
        />
      )}
      {chat.encrypted ? (
        // La web no tiene sobre propio todavía (§54.4): escribir acá saldría en claro.
        <p data-testid="aviso-chat-secreto" className="border-t border-outline/15 bg-surface px-4 py-4 text-center text-[13px] text-on-surface-variant">
          Este chat secreto se lee y se escribe en tu teléfono.
        </p>
      ) : (
      <>
      {props.queue}
      {props.app ? <AppCommandsBar commands={props.app.commands} /> : null}
      <Composer
        onSend={props.onSend}
        onCreateEvent={props.onCreateEvent}
        onCreatePoll={props.onCreatePoll}
        onCreateReminder={props.onCreateReminder}
        onCreateChecklist={props.onCreateChecklist}
        onNudge={props.onNudge}
        onWink={props.onWink}
        recipient={chat.name ?? chat.phone}
        onElegirArchivos={props.onElegirArchivos}
        contexto={props.contexto}
        onCancelarContexto={props.onCancelarContexto}
        mencionables={props.mencionables}
        onOutsideMentions={props.onOutsideMentions}
        avisoDeMencion={props.avisoDeMencion}
        jwtParaEnlaces={props.jwtParaEnlaces}
        onNotaDeVoz={props.onNotaDeVoz}
        onEscribiendo={props.onEscribiendo}
        commands={commands.enabled ? commands : undefined}
        stickers={props.jwtParaEnlaces ? { jwt: props.jwtParaEnlaces, me: props.yo, chatId: chat.id, chatName: chat.name ?? chat.phone ?? '', replyToSeq: props.replyingTo, onSent: props.replyingTo ? props.onCancelarContexto : undefined } : undefined}
      />
      </>
      )}
      </>
      )}
    </section>
  );
}

function CabeceraDeLaConversacion(props: { chat: ChatSummary; typingName: string | null; showBack: boolean; onBack: () => void; onAbrirInfo?: () => void; /** The other's «últ. vez» in a 1:1, like the app. */ lastSeen?: string; /** «Ausente» or «Ocupado» (pending 15). */ status?: PresenceStatus; onCall?: (video: boolean) => void; callExtras?: ReactNode }) {
  const { chat, typingName } = props;
  // A channel of a space reads as Slack's: «#planta-web».
  const title = chat.channel ? `#${chat.name ?? ''}` : (chat.name ?? chat.phone ?? 'Conversación');
  return (
    <header className="flex items-center gap-3 border-b border-outline/15 bg-primary/5 px-4 py-3">
      {props.showBack ? (
        <button type="button" data-testid="btn-volver" aria-label="Volver" onClick={props.onBack} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-surface">
          <ArrowLeft size={20} />
        </button>
      ) : null}
      {/* Nombre y foto abren «Info.» (W3b), como en WhatsApp Web. */}
      <button type="button" data-testid="btn-info-del-chat" aria-label={`Info. de ${title}`} onClick={props.onAbrirInfo} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
      <Avatar name={title} kind={chat.kind} online={chat.online} foto={chat.avatarUrl} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-bold">{title}</h2>
        {/* La línea de estado no desaparece cuando nadie escribe: si el alto
            cambiara, la cabecera saltaría con cada tecla del otro. */}
        <p data-testid="estado-chat" className={`truncate text-[13px] ${typingName ? 'text-primary' : 'text-on-surface-variant'}`}>
          {typingName ? (chat.kind === 'group' ? `${typingName} está escribiendo…` : 'Escribiendo…') : chat.kind === 'notas' ? 'Solo tú lo ves' : chat.kind === 'group' ? (memberCountLabel(chat.memberIds.length) || ' ') : chat.online ? presenceLine({ online: true, status: props.status }) : props.lastSeen ? formatUltimaVez(props.lastSeen) : ' '}
        </p>
      </div>
      </button>
      {props.onCall ? (
        <div className="flex items-center gap-1 text-on-surface-variant">
          <button type="button" data-testid="btn-videollamada" aria-label="Videollamada" title="Videollamada" onClick={() => props.onCall?.(true)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface">
            <Video size={18} />
          </button>
          <button type="button" data-testid="btn-llamada" aria-label="Llamada" title="Llamada" onClick={() => props.onCall?.(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface">
            <Phone size={18} />
          </button>
          {props.callExtras}
        </div>
      ) : null}
      <div className="hidden items-center gap-1 text-on-surface-variant/40 sm:flex">
        <span className="grid h-9 w-9 place-items-center" title="Buscar (próximamente)">
          <Search size={18} />
        </span>
      </div>
    </header>
  );
}

function EsqueletoDeMensajes() {
  return (
    <div data-testid="mensajes-cargando" className="min-h-0 flex-1 space-y-3 px-4 py-4">
      {[0, 1, 2].map((indice) => (
        <div key={indice} className={`h-10 animate-pulse rounded-xl bg-surface ${indice % 2 ? 'ml-auto w-1/3' : 'w-1/2'}`} />
      ))}
    </div>
  );
}

/** The notifications banner needs the session's token, which lives in the conversation's context. */
function BannerWithSession() {
  const context = useContext(ConversacionContext);
  return context ? <NotificationsBanner jwt={context.jwt} /> : null;
}
