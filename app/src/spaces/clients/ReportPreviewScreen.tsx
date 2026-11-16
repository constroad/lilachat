import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { ExternalLink, X } from 'lucide-react-native';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

const PREVIEW_FAILED = 'No se pudo abrir la vista previa. Prueba con «Abrir en el navegador».';
/** A signed link lasts a while: an expired one asks to tap «Ver PDF» again. */
const PREVIEW_EXPIRED = 'La vista previa venció. Ciérrala y toca «Ver PDF» otra vez.';
const HTTP_CLIENT_ERROR = 400;

/**
 * Portal's sheets are A4 wide: on a phone the browser showed only their left side, with no zoom
 * (José 15/11). The page's viewport becomes the sheets' own width, scaled to the WebView's width
 * (measured by React Native: on a tablet it is a pane, not the screen), so the sheets show whole
 * and pinch to zoom. Run again when the WebView changes width (the phone turned).
 */
const fitSheets = (viewWidth: number) => `(function () {
  var page = document.documentElement, body = document.body;
  if (!page || !document.head) return;
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'viewport'); document.head.appendChild(meta); }
  meta.setAttribute('content', 'width=device-width');
  var wide = Math.max(page.scrollWidth, body ? body.scrollWidth : 0, 1);
  var view = ${Math.max(0, Math.round(viewWidth))} || window.innerWidth;
  var scale = Math.min(1, view / wide);
  meta.setAttribute('content', 'width=' + wide + ', initial-scale=' + scale + ', minimum-scale=' + scale + ', maximum-scale=5, user-scalable=yes');
})(); true;`;

const originOf = (url: string) => url.match(/^https:\/\/[^/]+/)?.[0] ?? '';

/**
 * «Ver PDF» of a draft inside Lilachat (José 15/11: «¿por qué no lo puedo ver en el visor?»): a
 * draft has no PDF file yet, only Portal's signed page of its sheets, so it opens here fitted to
 * the screen with zoom. Only that page loads; «Abrir en el navegador» stays as the way out.
 */
export function ReportPreviewScreen({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const web = useRef<WebView>(null);
  // Turned or resized after it loaded: fit the sheets to the new width.
  useEffect(() => { if (!loading && width) web.current?.injectJavaScript(fitSheets(width)); }, [loading, width]);
  const origin = originOf(url);
  const samePage = (request: WebViewNavigation) => request.url === 'about:blank' || (origin !== '' && request.url.startsWith(`${origin}/`));
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View testID="vista-previa-informe" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
        <View className="flex-row items-center gap-2 border-b border-outline/15 px-2 pb-2">
          <Pressable testID="vista-previa-cerrar" accessibilityLabel="Cerrar la vista previa" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full"><X size={22} color={colors['on-surface']} /></Pressable>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Vista previa · borrador</Text>
            <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{title}</Text>
          </View>
          <Pressable testID="vista-previa-navegador" accessibilityLabel="Abrir en el navegador" onPress={() => void Linking.openURL(url)} className="h-11 w-11 items-center justify-center rounded-full"><ExternalLink size={20} color={colors.primary} /></Pressable>
        </View>
        {failed ? <Text testID="vista-previa-fallo" className="p-6 text-center text-[15px] text-on-surface">{failed}</Text> : (
          <View className="flex-1" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            <WebView
              ref={web}
              testID="vista-previa-web"
              source={{ uri: url }}
              originWhitelist={['https://*']}
              onShouldStartLoadWithRequest={samePage}
              setSupportMultipleWindows={false}
              allowFileAccess={false}
              scalesPageToFit
              setBuiltInZoomControls
              setDisplayZoomControls={false}
              injectedJavaScript={fitSheets(width)}
              onLoadEnd={() => setLoading(false)}
              onError={() => setFailed(PREVIEW_FAILED)}
              onHttpError={(event) => setFailed(event.nativeEvent.statusCode >= HTTP_CLIENT_ERROR && event.nativeEvent.statusCode < 500 ? PREVIEW_EXPIRED : PREVIEW_FAILED)}
              style={{ flex: 1, backgroundColor: colors.background }}
            />
            {loading ? <View pointerEvents="none" className="absolute inset-0 items-center pt-10"><ActivityIndicator color={colors.primary} /></View> : null}
          </View>
        )}
      </View>
    </Modal>
  );
}
