import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, Check, Plus, RotateCcw, Spline, Undo2, X } from 'lucide-react-native';
import { arAimLine, arLiveChips, arScanProgress, type ArPoint, type ShotCorner } from '@lilachat/shared';
import { ArMeasureView, type ArFrame, type ArMeasureHandle } from '../../../../modules/ar-measure/src';
import { useColores } from '../../../ui/tema';
import { ArOverlay } from './ArOverlay';
import { ArUnavailable } from './ArUnavailable';
import type { ZonePlace } from './useZonePlace';

/** The corners, whether tracking held, and the AR's frame with the trace (`file://`) when it could be read. */
export type ArMeasured = { points: ArPoint[]; stable: boolean; photo?: string; /** Where each corner sat on that frame: each side's meters go on the photo (José 15/11). */ shot?: ShotFrame };
export type ShotFrame = { corners: ShotCorner[]; width: number; height: number };
type Props = { kicker: string; zone: number; reportCode: string | null; place: ZonePlace; onBack: () => void; onMeasured: (measured: ArMeasured) => void; onPhotoInstead: () => void };
type Gate = 'asking' | 'granted' | 'denied';

const MIN_CORNERS = 3;

/**
 * The camera permission before the AR opens: without it ARCore cannot start
 * (la-07, state 1). Coming back from the phone's settings reads it again.
 */
function useCameraGate(): Gate {
  const [gate, setGate] = useState<Gate>('asking');
  useEffect(() => {
    let alive = true;
    const answer = (granted: boolean) => { if (alive) setGate(granted ? 'granted' : 'denied'); };
    void ImagePicker.requestCameraPermissionsAsync().then((permission) => answer(permission.granted));
    const back = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ImagePicker.getCameraPermissionsAsync().then((permission) => answer(permission.granted));
    });
    return () => { alive = false; back.remove(); };
  }, []);
  return gate;
}

/** The view's requests with their line when they fail («Apunta al piso», «Acércate»…). */
/** The corners on the last frame seen when «Listo» read the shot (the frames come a few times a second). */
const shotFrameOf = (frame: ArFrame | null): ShotFrame | undefined => (frame?.width && frame.height && frame.corners.length ? { corners: frame.corners, width: frame.width, height: frame.height } : undefined);

function useCorners(handle: React.RefObject<ArMeasureHandle | null>, lastFrame: React.RefObject<ArFrame | null>, onMeasured: (measured: ArMeasured) => void) {
  const [count, setCount] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  // Once a close starts, a second tap or «Cerrar» must not read (and photograph) the zone again (audit 15/11).
  const closed = useRef(false);
  // «Listo» tapped twice in one frame queued two shots; leaving mid-read still saved the zone (audit 15/11).
  const reading = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const finish = (measured: ArMeasured) => {
    if (closed.current || !mounted.current) return;
    closed.current = true;
    onMeasured(measured);
  };
  const run = async (step: (view: ArMeasureHandle) => Promise<void>) => {
    if (!handle.current || closed.current) return;
    setFailure(null);
    try {
      await step(handle.current);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'No se pudo marcar la esquina.');
    }
  };
  // Like José's reference app: the zone closes in the AR (filled, with its area) and «Listo» confirms it.
  const close = () => run(async (view) => { await view.closeZone(); });
  const confirm = () => run(async (view) => {
    if (reading.current) return;
    reading.current = true;
    try {
      const read = await view.readCorners();
      const shot = shotFrameOf(lastFrame.current);
      finish(shot ? { ...read, shot } : read);
    } finally {
      reading.current = false;
    }
  });
  // A tap on the first corner closes the zone (José 15/11: a 5th corner there blocked the save).
  const mark = () => run(async (view) => {
    try {
      setCount(await view.addCorner());
    } catch (error) {
      if ((error as { code?: string }).code !== 'closing') throw error;
      await view.closeZone();
    }
  });
  return {
    count, failure, close, confirm, mark,
    undo: () => run(async (view) => setCount(await view.undoCorner())),
    restart: () => run(async (view) => setCount(await view.clearCorners())),
  };
}

/**
 * Design la-02 (José 15/11, «AR + wincha»), reworked after his test on the phone:
 * first the floor is scanned; then a tap anywhere on the camera marks the corner
 * under the reticle (or «Marcar esquina», 72 px); the side being drawn shows its
 * meters live; aiming at the first corner closes the zone. The trace is drawn
 * natively on the camera image; the figures come from the corners in la-03.
 */
export function ArMeasureScreen(props: Props) {
  const gate = useCameraGate();
  const handle = useRef<ArMeasureHandle>(null);
  const [frame, setFrame] = useState<ArFrame | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const colors = useColores();
  const lastFrame = useRef<ArFrame | null>(null);
  const corners = useCorners(handle, lastFrame, props.onMeasured);
  const NativeView = ArMeasureView;
  const blocked = gate === 'denied' ? 'no-permission' : !NativeView ? 'unsupported' : frame && ['unsupported', 'declined', 'no-permission', 'error'].includes(frame.state) ? frame.state : null;
  if (blocked) return <ArUnavailable state={blocked} kicker={props.kicker} zone={props.zone} reportCode={props.reportCode} onBack={props.onBack} onPhotoInstead={props.onPhotoInstead} />;
  return (
    <View testID="medir-ar-pantalla" className="flex-1 bg-black" onLayout={(event) => setSize(event.nativeEvent.layout)}>
      {gate === 'granted' && NativeView ? <NativeView ref={handle} accent={colors.primary} style={{ flex: 1 }} onArFrame={(event) => { lastFrame.current = event.nativeEvent; setFrame(event.nativeEvent); }} /> : null}
      <Pressable testID="ar-tocar" accessibilityLabel={frame?.closing ? 'Cerrar la zona' : 'Marcar esquina'} onPress={() => { if (!frame?.closed && (corners.count || arScanProgress(frame?.floorM2) >= 1)) void corners.mark(); }} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <ArOverlay frame={frame} size={size} />
      {frame?.state === 'tracking' && !corners.count && arScanProgress(frame.floorM2) < 1 ? <ScanCard progress={arScanProgress(frame.floorM2)} /> : null}
      <ArTopBar kicker={props.kicker} zone={props.zone} place={props.place} frame={frame} onBack={props.onBack} />
      {frame ? <LiveChips frame={frame} /> : null}
      {frame && !frame.stable && corners.count ? <TrackingLost onRestart={corners.restart} /> : null}
      <ArBottomBar frame={frame} count={corners.count} failure={corners.failure} onUndo={corners.undo} onMark={corners.mark} onClose={corners.close} onConfirm={corners.confirm} />
    </View>
  );
}

/** José 15/11 («chips de resumen»): the meters traced while drawing, the area once closed. */
function LiveChips({ frame }: { frame: ArFrame }) {
  const chips = arLiveChips(frame);
  if (!chips.length) return null;
  return (
    <View pointerEvents="none" testID="ar-chips" className="absolute inset-x-3 top-[88px] flex-row justify-center gap-2">
      {chips.map((chip) => <Text key={chip.label} className="rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-[13px] font-bold text-white" style={{ fontVariant: ['tabular-nums'] }}>{`${chip.label} · ${chip.value}`}</Text>)}
    </View>
  );
}

/** Before the first corner: one square meter of floor, so the anchors do not drift (José 15/11). */
function ScanCard({ progress }: { progress: number }) {
  return (
    <View pointerEvents="none" testID="ar-escaneo" className="absolute inset-x-6 top-1/3 gap-3 rounded-2xl border border-white/15 bg-black/70 p-4">
      <Text className="text-[17px] font-bold text-white">Escaneando el piso</Text>
      <Text className="text-[14px] text-white/80">Mueve el teléfono despacio de lado a lado, apuntando al piso de la zona.</Text>
      <View className="h-2 overflow-hidden rounded-full bg-white/20"><View className="h-2 rounded-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></View>
    </View>
  );
}

function ArTopBar(props: { kicker: string; zone: number; place: ZonePlace; frame: ArFrame | null; onBack: () => void }) {
  const tracking = props.frame?.state === 'tracking' && props.frame.floor;
  const state = props.frame?.state === 'installing' ? 'Instalando AR…' : tracking ? 'Piso detectado' : 'Buscando piso';
  return (
    <View className="absolute inset-x-3 top-3 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-2">
      <Pressable testID="cerrar-ar" onPress={props.onBack} accessibilityLabel="Salir sin guardar" className="h-11 w-11 items-center justify-center rounded-full bg-white/10"><X size={22} color="white" /></Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-white/70" numberOfLines={1}>{`${props.kicker} · Zona ${props.zone}`}</Text>
        <Text testID="ar-lugar" className="text-[17px] font-bold text-white" numberOfLines={1}>{props.place.place ?? `Zona ${props.zone}`}</Text>
        {props.place.place ? <Text className="text-[11px] font-bold uppercase text-white/60">Del GPS</Text> : null}
      </View>
      <Text testID="estado-ar" className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${tracking ? 'border-primary/60 bg-primary/30 text-white' : 'border-white/20 text-white/80'}`}>{state}</Text>
    </View>
  );
}

function ArBottomBar(props: { frame: ArFrame | null; count: number; failure: string | null; onUndo: () => void; onMark: () => void; onClose: () => void; onConfirm: () => void }) {
  const colors = useColores();
  const line = props.failure ?? (props.frame ? arAimLine(props.frame, props.count) : 'Abriendo la cámara…');
  const canClose = props.count >= MIN_CORNERS;
  return (
    <View className="absolute inset-x-3 bottom-4 gap-3">
      <Text testID="guia-ar" className="self-center rounded-full bg-black/70 px-4 py-2 text-[15px] font-semibold text-white">{line}</Text>
      <View className="flex-row items-center justify-between rounded-3xl border border-white/10 bg-black/60 px-4 py-3">
        <ArButton testID="deshacer-esquina-ar" label="Deshacer" disabled={!props.count} onPress={props.onUndo} icon={<Undo2 size={22} color="white" />} />
        {props.frame?.closed ? (
          <View className="items-center gap-1">
            <Pressable testID="ar-listo" onPress={props.onConfirm} accessibilityLabel="Listo" className="h-[72px] w-[72px] items-center justify-center rounded-full bg-primary"><Check size={34} color={colors['on-primary']} /></Pressable>
            <Text className="text-[13px] font-semibold text-white">Listo</Text>
          </View>
        ) : (
          <View className="items-center gap-1">
            <Pressable testID="marcar-esquina" onPress={props.onMark} accessibilityLabel="Marcar esquina" className="h-[72px] w-[72px] items-center justify-center rounded-full bg-primary"><Plus size={34} color={colors['on-primary']} /></Pressable>
            <Text className="text-[13px] font-semibold text-white">{`Marcar esquina · ${props.count}`}</Text>
          </View>
        )}
        <ArButton testID="cerrar-poligono" label="Cerrar" disabled={!canClose || Boolean(props.frame?.closed)} onPress={props.onClose} icon={<Spline size={22} color="white" />} />
      </View>
    </View>
  );
}

/** A lost track moves the anchors: the corners marked before it no longer measure, so the zone starts over. */
function TrackingLost({ onRestart }: { onRestart: () => void }) {
  return (
    <View testID="ar-seguimiento-perdido" className="absolute inset-x-3 top-24 gap-3 rounded-2xl border border-error/40 bg-black/80 p-3">
      <View className="flex-row items-center gap-2"><AlertTriangle size={18} color="white" /><Text className="flex-1 text-[15px] font-semibold text-white">El AR perdió el piso y las esquinas pudieron moverse.</Text></View>
      <Pressable testID="reiniciar-ar" onPress={onRestart} className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-white"><RotateCcw size={18} color="black" /><Text className="text-[15px] font-bold text-black">Reiniciar la zona</Text></Pressable>
    </View>
  );
}

function ArButton(props: { testID: string; label: string; disabled: boolean; onPress: () => void; icon: React.ReactNode }) {
  return (
    <Pressable testID={props.testID} onPress={props.onPress} disabled={props.disabled} accessibilityLabel={props.label} className={`items-center gap-1 ${props.disabled ? 'opacity-40' : ''}`}>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-white/15">{props.icon}</View>
      <Text className="text-[13px] text-white">{props.label}</Text>
    </Pressable>
  );
}
