import type { LiftRow } from './workMap/WorkMapItems';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { afterQuietReload, reloadWorkMap, deleteThenReload, editThenReload, loadWorkMap, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, serviceMapPage, type ChannelLinks, type UnitDischarge, type MapPhoto, type WorkMap, type WorkMapState } from '@lilachat/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api/client';
import { spaceDiskKey } from '../spaceCache';
import { jsonCall } from '../../api/jsonCall';
import type { PhotoAsset } from './workMap/ManualProgress';
import type { TraceFile } from './useDriveUpload';
import { WorkMapBoard } from './workMap/WorkMapBoard';
import type { ProgressSend } from './workMap/WorkMapDischarges';
import { WorkMapFirst } from './workMap/WorkMapFirst';
import { EMPTY_WORK_MAP } from '@lilachat/shared';
import { ImportTrace } from './workMap/ImportTrace';
import { ServiceCroquisButton } from './workMap/ServiceCroquis';
import { WorkStreetEditor } from './workMap/WorkStreetEditor';
import { WorkStreetBatch } from './workMap/WorkStreetBatch';
import type { StreetDeleteSend } from './workMap/StreetDelete';
import { placeAsker, type StreetSend } from './workMap/workProgressSender';

/** The map's own states (loading, failed, first street) keep the padding of the other sections. */
const BODY = { padding: 16, gap: 12, paddingBottom: 40 };

type ServiceTarget = { kind: 'service'; clientId: string; serviceId: string };

/** The map of the service, asked when it opens; only the latest question answers. */
function useServiceMap(jwt: string, links: ChannelLinks, target: ServiceTarget) {
  const [state, setState] = useState<WorkMapState>({ kind: 'loading' });
  const shown = useRef(state);
  shown.current = state;
  const latestLinks = useRef(links);
  latestLinks.current = links;
  const turn = useRef(0);
  const { clientId, serviceId } = target;
  /** `quiet` after an edit: the map on screen stays while Portal answers (an open street does not close). */
  const ask = useCallback(async (quiet = false) => {
    turn.current += 1;
    const asked = turn.current;
    if (!quiet) setState({ kind: 'loading' });
    const read = (link: string) => jsonCall<{ map: WorkMap | null }>(`${BASE_URL}/api/service-work-map`, jwt, { method: 'POST', body: JSON.stringify({ link, serviceId }) });
    const link = () => latestLinks.current.map({ kind: 'service', clientId, serviceId });
    // After an edit the link on screen is read again: a new one is a new public link in Portal.
    const fresh = quiet ? await reloadWorkMap(shown.current, link, read) : await loadWorkMap(link, read);
    // The map Portal last drew stays on the phone (José 26/11): without signal it is shown, with no link to Portal.
    if (fresh.kind === 'ready') keepWorkMap(clientId, serviceId, fresh.map);
    const next = fresh.kind === 'failed' ? (await keptWorkMap(clientId, serviceId)) ?? fresh : fresh;
    if (asked === turn.current) setState((previous) => (quiet ? afterQuietReload(previous, next) : next));
  }, [jwt, clientId, serviceId]);
  useEffect(() => {
    void ask();
    return () => {
      turn.current += 1;
    };
  }, [ask]);
  return { state, ask };
}

const workMapKey = (clientId: string, serviceId: string) => spaceDiskKey(`work-map:${clientId}:${serviceId}`);
function keepWorkMap(clientId: string, serviceId: string, map: WorkMap | null): void {
  if (map) AsyncStorage.setItem(workMapKey(clientId, serviceId), JSON.stringify(map)).catch(() => undefined);
}
async function keptWorkMap(clientId: string, serviceId: string): Promise<WorkMapState | null> {
  const raw = await AsyncStorage.getItem(workMapKey(clientId, serviceId)).catch(() => null);
  try {
    return raw ? { kind: 'ready', url: '', map: JSON.parse(raw) as WorkMap } : null;
  } catch {
    return null;
  }
}

const PortalLink = (props: { url: string }) => (
  <Pressable testID="mapa-abrir" onPress={() => void Linking.openURL(props.url)} className="mt-2 min-h-[48px] items-center justify-center">
    <Text className="text-[15px] font-semibold text-primary">Abrir en Portal</Text>
  </Pressable>
);

/**
 * «Mapa» of a service (José 06/11: «el mapa literal de la obra»), drawn with what Portal shows a
 * client. José 20/11 (design mapa-v2): it takes the rest of the screen under the service's head.
 */
export function ServiceMapPanel(props: { jwt: string; links: ChannelLinks; target: ServiceTarget; title: string; badge?: ReactNode; /** Where the streets are drawn today (Portal's «Mapa» tab). */ drawUrl?: string | null; discharges?: UnitDischarge[]; /** Field photos with their place (José 08/11). */ mapPhotos?: MapPhoto[]; /** The service's place (Portal da5382a5). */ start?: { lat: number; lng: number }; send?: ProgressSend; /** «Guardar calle» (o-02): everyone draws (José 07/11). */ drawStreet?: StreetSend; /** «Borrar calle»: anyone, an admin restores (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<PhotoAsset>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<TraceFile>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport; /** «Levantar» on an open observation (José 27/11). */ onLift?: (row: LiftRow) => void }) {
  const { state, ask } = useServiceMap(props.jwt, props.links, props.target);
  /** `area`: ma02's several streets; `single`: the one-street editor (o-02). */
  const [drawing, setDrawing] = useState<'area' | 'single' | null>(null);
  /** What the last save answered («Calle guardada…»): the editor closes, so the board says it. */
  const [notice, setNotice] = useState<string | null>(null);
  const drawWith = (way: 'area' | 'single') => (props.drawStreet ? () => { setNotice(null); setDrawing(way); } : undefined);
  const onDraw = drawWith('single');
  const pageOf = (url: string) => serviceMapPage(url, props.target.serviceId);
  const deleteStreet = deleteThenReload(props.deleteStreet, () => ask(true));
  const editMap = editThenReload(props.editMap, () => ask(true));
  if (state.kind === 'loading') return <View testID="mapa-cargando" className="flex-1 bg-surface-variant" />;
  if (state.kind === 'failed') {
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={BODY}>
        <View testID="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="text-[15px] font-semibold text-on-surface">{state.message}</Text>
          <Pressable testID="mapa-reintentar" onPress={() => void ask()} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-primary/30">
            <Text className="text-[15px] font-semibold text-primary">Reintentar</Text>
          </Pressable>
          {state.url ? <PortalLink url={pageOf(state.url)} /> : null}
        </View>
      </ScrollView>
    );
  }
  const saved = (message: string) => { setNotice(message); setDrawing(null); void ask(); };
  const editor = props.drawStreet ? (
    <>
      <WorkStreetEditor open={drawing === 'single'} title={props.title} map={state.map} send={props.drawStreet} findPlace={placeAsker(props.jwt)} start={props.start} onClose={() => setDrawing(null)} onSaved={saved} />
      {drawing === 'area' ? <WorkStreetBatch open title={props.title} map={state.map} send={props.drawStreet} start={props.start} onClose={() => setDrawing(null)} onSaved={saved} onPartial={() => void ask(true)} /> : null}
    </>
  ) : null;
  // Photos or units with a place and no street yet: the map still shows where they are (Portal via José 09/11).
  const media = Boolean(props.mapPhotos?.length || props.discharges?.length);
  if (!state.map && !media) return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={BODY}>{editor}<WorkMapFirst drawUrl={props.drawUrl ?? null} onDraw={onDraw} trace={editMap ? <View className="gap-2">{props.uploadTrace ? <ImportTrace send={editMap} upload={props.uploadTrace} /> : null}<ServiceCroquisButton send={editMap} title={props.title} onDone={() => void ask(true)} /></View> : null} /></ScrollView>;
  return <>{editor}<WorkMapBoard onLift={props.onLift} map={state.map ?? EMPTY_WORK_MAP} pageUrl={state.url ? pageOf(state.url) : ''} title={props.title} serviceId={props.target.serviceId} badge={props.badge} discharges={props.discharges} mapPhotos={props.mapPhotos} send={props.send} onDraw={onDraw} onArea={drawWith('area')} deleteStreet={deleteStreet} editMap={editMap} admin={props.admin} uploadPhoto={props.uploadPhoto} uploadTrace={props.uploadTrace} mapInReport={props.mapInReport} notice={notice} reload={() => void ask(true)} /></>;
}
