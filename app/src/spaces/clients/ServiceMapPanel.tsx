import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { loadWorkMap, serviceMapPage, WORK_MAP_EMPTY, type ChannelLinks, type WorkMap, type WorkMapState } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { WorkMapBoard } from './workMap/WorkMapBoard';

/** Most of the screen, leaving the tabs in sight. */
const MAP_SCREEN_SHARE = 0.5;

type ServiceTarget = { kind: 'service'; clientId: string; serviceId: string };

/** The map of the service, asked when it opens; only the latest question answers. */
function useServiceMap(jwt: string, links: ChannelLinks, target: ServiceTarget) {
  const [state, setState] = useState<WorkMapState>({ kind: 'loading' });
  const latestLinks = useRef(links);
  latestLinks.current = links;
  const turn = useRef(0);
  const { clientId, serviceId } = target;
  const ask = useCallback(async () => {
    turn.current += 1;
    const asked = turn.current;
    setState({ kind: 'loading' });
    const read = (link: string) => jsonCall<{ map: WorkMap | null }>(`${BASE_URL}/api/service-work-map`, jwt, { method: 'POST', body: JSON.stringify({ link, serviceId }) });
    const next = await loadWorkMap(() => latestLinks.current.map({ kind: 'service', clientId, serviceId }), read);
    if (asked === turn.current) setState(next);
  }, [jwt, clientId, serviceId]);
  useEffect(() => {
    void ask();
    return () => {
      turn.current += 1;
    };
  }, [ask]);
  return { state, ask };
}

const PortalLink = (props: { url: string }) => (
  <Pressable testID="mapa-abrir" onPress={() => void Linking.openURL(props.url)} className="mt-2 min-h-[48px] items-center justify-center">
    <Text className="text-[15px] font-semibold text-primary">Abrir en Portal</Text>
  </Pressable>
);

/** «Mapa» of a service (José 06/11: «el mapa literal de la obra»), drawn with what Portal shows a client. */
export function ServiceMapPanel(props: { jwt: string; links: ChannelLinks; target: ServiceTarget; title: string }) {
  const screen = useWindowDimensions();
  const { state, ask } = useServiceMap(props.jwt, props.links, props.target);
  const height = Math.round(screen.height * MAP_SCREEN_SHARE);
  const pageOf = (url: string) => serviceMapPage(url, props.target.serviceId);
  if (state.kind === 'loading') return <View testID="mapa-cargando" className="rounded-2xl bg-surface-variant" style={{ height }} />;
  if (state.kind === 'failed') {
    return (
      <View testID="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <Text className="text-[15px] font-semibold text-on-surface">{state.message}</Text>
        <Pressable testID="mapa-reintentar" onPress={() => void ask()} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-primary/30">
          <Text className="text-[15px] font-semibold text-primary">Reintentar</Text>
        </Pressable>
        {state.url ? <PortalLink url={pageOf(state.url)} /> : null}
      </View>
    );
  }
  if (!state.map) {
    return (
      <View testID="mapa-vacio" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <Text className="text-[15px] text-on-surface-variant">{WORK_MAP_EMPTY}</Text>
        <PortalLink url={pageOf(state.url)} />
      </View>
    );
  }
  return <WorkMapBoard map={state.map} pageUrl={pageOf(state.url)} height={height} title={props.title} />;
}
