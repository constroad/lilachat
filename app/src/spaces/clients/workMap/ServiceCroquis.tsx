import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { PenLine, X } from 'lucide-react-native';
import { embedCloseRequest, embedErrorLine, nativeEmbedCommand, nativeEmbedEventOf, PORTAL_EMBED_ORIGINS, SERVICE_CROQUIS_LABEL, serviceCroquisVia, type EmbedLink, type MapEditSend } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';

const PORTAL_ORIGINS: readonly string[] = [PORTAL_EMBED_ORIGINS.production];
/** Portal answers `closed` at once when nothing is pending; past this the screen closes anyway. */
const CLOSED_TIMEOUT_MS = 3000;

type Opening = { link: EmbedLink | null; problem: string };

/** The editor's link through the map's door; «Reintentar» (or an expired link) asks for a new one. */
function useCroquisLink(send: MapEditSend) {
  const [opening, setOpening] = useState<Opening>({ link: null, problem: '' });
  const [attempt, setAttempt] = useState(0);
  // The door is made again on every render of the map: only a new attempt asks again.
  const door = useRef(send);
  door.current = send;
  useEffect(() => {
    let alive = true;
    setOpening({ link: null, problem: '' });
    void serviceCroquisVia(door.current, PORTAL_ORIGINS).then((opened) => {
      if (alive) setOpening(opened.ok ? { link: opened.link, problem: '' } : { link: null, problem: opened.message });
    });
    return () => { alive = false; };
  }, [attempt]);
  return { ...opening, retry: useCallback(() => setAttempt((count) => count + 1), []) };
}

/** Portal's page in the WebView talks by `portal-embed:` v1; our ✕ asks it to close so it saves what is pending. */
function useEditorTalk(onClosed: () => void, onExpired: () => void) {
  const web = useRef<WebView>(null);
  const [talk, setTalk] = useState({ ready: false, error: '', closing: false });
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const message = nativeEmbedEventOf(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'ready') setTalk((before) => ({ ...before, ready: true }));
    else if (message.type === 'closed') onClosed();
    else if (message.type === 'error') {
      if (message.code === 'expired') onExpired();
      else setTalk((before) => ({ ...before, error: embedErrorLine(message.code) }));
    }
  }, [onClosed, onExpired]);
  const askClose = useCallback(() => {
    if (!talk.ready || talk.error) { onClosed(); return; }
    web.current?.postMessage(nativeEmbedCommand(embedCloseRequest()));
    setTalk((before) => ({ ...before, closing: true }));
  }, [talk.ready, talk.error, onClosed]);
  useEffect(() => {
    if (!talk.closing) return undefined;
    const timer = setTimeout(onClosed, CLOSED_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [talk.closing, onClosed]);
  return { web, onMessage, askClose, error: talk.error };
}

const staysInPortal = (request: WebViewNavigation) => request.url === 'about:blank' || PORTAL_ORIGINS.some((origin) => request.url.startsWith(`${origin}/`));

/**
 * Portal's croquis editor of the service on the phone (José 19/11), like a visit's croquis. Its link
 * lives only here (12 h), never in a message or the logs. Closing reads the map again.
 */
function ServiceCroquisScreen(props: { send: MapEditSend; title: string; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const croquis = useCroquisLink(props.send);
  const talk = useEditorTalk(props.onClose, croquis.retry);
  const problem = croquis.problem || talk.error;
  return (
    <Modal visible animationType="slide" onRequestClose={talk.askClose} statusBarTranslucent>
      <View testID="servicio-croquis" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
        <View className="flex-row items-center gap-2 border-b border-outline/15 px-2 pb-2">
          <Pressable testID="servicio-croquis-cerrar" accessibilityLabel="Cerrar el croquis" onPress={talk.askClose} className="h-11 w-11 items-center justify-center rounded-full"><X size={22} color={colors['on-surface']} /></Pressable>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{props.title}</Text>
            <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">Croquis</Text>
          </View>
        </View>
        {problem ? (
          <View className="items-center gap-3 p-6">
            <Text testID="servicio-croquis-fallo" className="text-center text-[15px] text-on-surface">{problem}</Text>
            <Pressable testID="servicio-croquis-reintentar" onPress={croquis.retry} className="h-11 justify-center rounded-xl border border-primary/30 px-4"><Text className="text-[14px] font-semibold text-primary">Reintentar</Text></Pressable>
          </View>
        ) : null}
        {!problem && !croquis.link ? <ActivityIndicator testID="servicio-croquis-cargando" className="mt-10" color={colors.primary} /> : null}
        {croquis.link && !talk.error ? <WebView ref={talk.web} key={croquis.link.url} testID="servicio-croquis-web" source={{ uri: croquis.link.url }} onMessage={talk.onMessage} originWhitelist={['https://*']} onShouldStartLoadWithRequest={staysInPortal} setSupportMultipleWindows={false} allowFileAccess={false} domStorageEnabled style={{ flex: 1 }} /> : null}
      </View>
    </Modal>
  );
}

/** «Editar croquis» for every member of the channel: the button and, once pressed, the editor. */
export function ServiceCroquisButton(props: { send: MapEditSend; title: string; onDone: () => void; /** Over the map (José 19/11: he did not see it under the other buttons, design cc-04). */ pill?: boolean }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const { onDone } = props;
  const close = useCallback(() => { setOpen(false); onDone(); }, [onDone]);
  return (
    <>
      <Pressable testID="mapa-editar-croquis" onPress={() => setOpen(true)} className={props.pill ? 'h-11 flex-row items-center gap-2 rounded-full border border-primary/40 bg-surface px-4' : 'min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-primary/30 bg-surface'} style={props.pill ? { elevation: 4 } : undefined}>
        <PenLine size={18} color={colors.primary} />
        <Text className="text-[15px] font-semibold text-primary">{SERVICE_CROQUIS_LABEL}</Text>
      </Pressable>
      {open ? <ServiceCroquisScreen send={props.send} title={props.title} onClose={close} /> : null}
    </>
  );
}
