import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ChannelLinks, ServiceMapResult } from '@lilachat/shared';

/** Most of the screen, leaving the tabs in sight. */
const MAP_SCREEN_SHARE = 0.68;

const originOf = (url: string) => /^https:\/\/[^/]+/.exec(url)?.[0] ?? '';

/** The link of the map, asked when it opens; only the latest question answers. */
function useServiceMap(links: ChannelLinks, clientId: string, serviceId: string) {
  const [map, setMap] = useState<ServiceMapResult | null>(null);
  const latestLinks = useRef(links);
  latestLinks.current = links;
  const turn = useRef(0);
  const ask = useCallback(async () => {
    turn.current += 1;
    const asked = turn.current;
    setMap(null);
    const result = await latestLinks.current.map({ kind: 'service', clientId, serviceId });
    if (asked === turn.current) setMap(result);
  }, [clientId, serviceId]);
  useEffect(() => {
    void ask();
    return () => {
      turn.current += 1;
    };
  }, [ask]);
  return { map, ask };
}

/**
 * «Mapa» of a service (José 06/11). The page is Portal's, made for a link, so it stays in this
 * WebView: its map moves with the finger inside the detail's scroll, and anything leaving that
 * site goes to the browser.
 */
export function ServiceMapPanel(props: { links: ChannelLinks; target: { kind: 'service'; clientId: string; serviceId: string } }) {
  const screen = useWindowDimensions();
  const { map, ask } = useServiceMap(props.links, props.target.clientId, props.target.serviceId);
  const height = Math.round(screen.height * MAP_SCREEN_SHARE);
  if (!map) return <View testID="mapa-cargando" className="rounded-2xl bg-surface-variant" style={{ height }} />;
  if (!map.ok) {
    return (
      <View testID="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <Text className="text-[15px] font-semibold text-on-surface">{map.message}</Text>
        <Pressable testID="mapa-reintentar" onPress={() => void ask()} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <Text className="text-[15px] font-semibold text-primary">Reintentar</Text>
        </Pressable>
      </View>
    );
  }
  const keepInside = (request: WebViewNavigation) => {
    if (request.url.startsWith(originOf(map.url))) return true;
    void Linking.openURL(request.url);
    return false;
  };
  return (
    <View testID="mapa-servicio" className="overflow-hidden rounded-2xl border border-outline/15" style={{ height }}>
      <WebView source={{ uri: map.url }} originWhitelist={['https://*']} onShouldStartLoadWithRequest={keepInside} nestedScrollEnabled setSupportMultipleWindows={false} allowFileAccess={false} mixedContentMode="never" />
    </View>
  );
}
