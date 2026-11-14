import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { embedCloseRequest, embedErrorLine, nativeEmbedCommand, nativeEmbedEventOf, PORTAL_EMBED_ORIGINS, type EmbedLink, type VisitDocument } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import type { useVisit } from './useVisit';

const ORIGINS: readonly string[] = [PORTAL_EMBED_ORIGINS.production];
const CROQUIS_FAILED = 'No se pudo abrir el croquis.';
/** With nothing unsaved Portal answers `closed` at once; a page that does not answer does not keep the person in. */
const CLOSE_WAIT_MS = 3000;

/**
 * Portal's bridge in the WebView (8d2fe4a5): its «Cerrar editor» posts `closed`, and our ✕ asks it to close first so
 * it saves what is pending. An error is said; `expired` asks for the link again.
 */
function useCroquisBridge(onClosed: () => void, onExpired: () => void) {
  const view = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const message = nativeEmbedEventOf(event.nativeEvent.data);
    if (message?.type === 'ready') setReady(true);
    if (message?.type === 'closed') onClosed();
    if (message?.type === 'error' && message.code === 'expired') onExpired();
    else if (message?.type === 'error') setError(embedErrorLine(message.code));
  }, [onClosed, onExpired]);
  const requestClose = useCallback(() => {
    if (!ready || error) return onClosed();
    view.current?.postMessage(nativeEmbedCommand(embedCloseRequest()));
    setClosing(true);
  }, [ready, error, onClosed]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClosed, CLOSE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [closing, onClosed]);
  return { view, onMessage, requestClose, error };
}

/** Portal's own page, and nothing else: any other address stays out of the WebView. */
const insidePortal = (request: WebViewNavigation) => request.url === 'about:blank' || ORIGINS.some((origin) => request.url.startsWith(`${origin}/`));

/**
 * «Abrir croquis» on the phone (Portal 14/11, agentes 5ea69d0): Portal's croquis editor in a WebView. Each change is
 * saved by Portal at once; its bridge talks to the WebView (8d2fe4a5): its «Cerrar editor» closes this screen too.
 * The link lives only here, never in a message or the logs: it opens the visit to whoever has it (12 h).
 */
export function VisitCroquis({ visit, document, onClose }: { visit: ReturnType<typeof useVisit>; document: VisitDocument; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [link, setLink] = useState<EmbedLink | null>(null);
  const [failed, setFailed] = useState('');
  const [round, setRound] = useState(0);
  const { screen } = visit;
  useEffect(() => {
    let alive = true;
    setLink(null);
    void screen.croquis(ORIGINS).then((opened) => {
      if (!alive) return;
      if (opened) setLink(opened);
      else setFailed(screen.snapshot().notice || CROQUIS_FAILED);
    });
    return () => { alive = false; };
  }, [screen, round]);
  const close = useCallback(() => {
    void screen.reload();
    onClose();
  }, [screen, onClose]);
  const again = useCallback(() => setRound((count) => count + 1), []);
  const bridge = useCroquisBridge(close, again);
  const shown = failed || bridge.error;
  return (
    <Modal visible animationType="slide" onRequestClose={bridge.requestClose} statusBarTranslucent>
      <View testID="visita-croquis" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/15 px-2 pb-2">
          <Pressable testID="visita-croquis-cerrar" accessibilityLabel="Cerrar el croquis" onPress={bridge.requestClose} className="h-11 w-11 items-center justify-center rounded-full"><X size={22} color={colors['on-surface']} /></Pressable>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{`Visita técnica · ${document.code}`}</Text>
            <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">Croquis</Text>
          </View>
        </View>
        {shown ? <Text testID="visita-croquis-fallo" className="p-6 text-center text-[15px] text-on-surface">{shown}</Text> : null}
        {!shown && !link ? <ActivityIndicator testID="visita-croquis-cargando" className="mt-10" color={colors.primary} /> : null}
        {link && !bridge.error ? (
          <WebView
            ref={bridge.view}
            key={link.url}
            onMessage={bridge.onMessage}
            testID="visita-croquis-web"
            source={{ uri: link.url }}
            originWhitelist={['https://*']}
            onShouldStartLoadWithRequest={insidePortal}
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            domStorageEnabled
            style={{ flex: 1, paddingBottom: margins.pie }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
