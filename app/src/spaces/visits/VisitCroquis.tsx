import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { PORTAL_EMBED_ORIGINS, type EmbedLink, type VisitDocument } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import type { useVisit } from './useVisit';

const ORIGINS: readonly string[] = [PORTAL_EMBED_ORIGINS.production];
const CROQUIS_FAILED = 'No se pudo abrir el croquis.';

/** Portal's own page, and nothing else: any other address stays out of the WebView. */
const insidePortal = (request: WebViewNavigation) => request.url === 'about:blank' || ORIGINS.some((origin) => request.url.startsWith(`${origin}/`));

/**
 * «Abrir croquis» on the phone (Portal 14/11, agentes 5ea69d0): Portal's croquis editor in a WebView. Each change is
 * saved by Portal at once; in a WebView its bridge stays silent (it posts to a parent frame), so the close is ours.
 * The link lives only here, never in a message or the logs: it opens the visit to whoever has it (12 h).
 */
export function VisitCroquis({ visit, document, onClose }: { visit: ReturnType<typeof useVisit>; document: VisitDocument; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [link, setLink] = useState<EmbedLink | null>(null);
  const [failed, setFailed] = useState('');
  const { screen } = visit;
  useEffect(() => {
    let alive = true;
    void screen.croquis(ORIGINS).then((opened) => {
      if (!alive) return;
      if (opened) setLink(opened);
      else setFailed(screen.snapshot().notice || CROQUIS_FAILED);
    });
    return () => { alive = false; };
  }, [screen]);
  const close = useCallback(() => {
    void screen.reload();
    onClose();
  }, [screen, onClose]);
  return (
    <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View testID="visita-croquis" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/15 px-2 pb-2">
          <Pressable testID="visita-croquis-cerrar" accessibilityLabel="Cerrar el croquis" onPress={close} className="h-11 w-11 items-center justify-center rounded-full"><X size={22} color={colors['on-surface']} /></Pressable>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{`Visita técnica · ${document.code}`}</Text>
            <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">Croquis</Text>
          </View>
        </View>
        {failed ? <Text testID="visita-croquis-fallo" className="p-6 text-center text-[15px] text-on-surface">{failed}</Text> : null}
        {!failed && !link ? <ActivityIndicator testID="visita-croquis-cargando" className="mt-10" color={colors.primary} /> : null}
        {link ? (
          <WebView
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
