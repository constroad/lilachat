import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, CameraOff, Plus, RotateCcw, Spline, Undo2, X } from 'lucide-react-native';
import { arAimLine, type ArPoint } from '@lilachat/shared';
import { ArMeasureView, type ArFrame, type ArMeasureHandle } from '../../../../modules/ar-measure/src';
import { useColores } from '../../../ui/tema';
import { ArOverlay } from './ArOverlay';

export type ArMeasured = { points: ArPoint[]; stable: boolean };
type Props = { kicker: string; zone: number; onBack: () => void; onMeasured: (measured: ArMeasured) => void; onPhotoInstead: () => void };
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
function useCorners(handle: React.RefObject<ArMeasureHandle | null>, onMeasured: (measured: ArMeasured) => void) {
  const [count, setCount] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const run = async (step: (view: ArMeasureHandle) => Promise<void>) => {
    if (!handle.current) return;
    setFailure(null);
    try {
      await step(handle.current);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'No se pudo marcar la esquina.');
    }
  };
  return {
    count, failure,
    mark: () => run(async (view) => setCount(await view.addCorner())),
    undo: () => run(async (view) => setCount(await view.undoCorner())),
    restart: () => run(async (view) => setCount(await view.clearCorners())),
    close: () => run(async (view) => onMeasured(await view.readCorners())),
  };
}

/**
 * Design la-02 (José 15/11, «AR + wincha»): the camera with ARCore, a corner
 * marked under the reticle with «Marcar esquina» (72 px), «Deshacer», and
 * «Cerrar» with three or more. The figures come from the corners in la-03.
 */
export function ArMeasureScreen(props: Props) {
  const gate = useCameraGate();
  const handle = useRef<ArMeasureHandle>(null);
  const [frame, setFrame] = useState<ArFrame | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const corners = useCorners(handle, props.onMeasured);
  const NativeView = ArMeasureView;
  const blocked = gate === 'denied' ? 'no-permission' : !NativeView ? 'unsupported' : frame && ['unsupported', 'declined', 'no-permission', 'error'].includes(frame.state) ? frame.state : null;
  if (blocked) return <ArUnavailable state={blocked} onBack={props.onBack} onPhotoInstead={props.onPhotoInstead} />;
  return (
    <View testID="medir-ar-pantalla" className="flex-1 bg-black" onLayout={(event) => setSize(event.nativeEvent.layout)}>
      {gate === 'granted' && NativeView ? <NativeView ref={handle} style={{ flex: 1 }} onArFrame={(event) => setFrame(event.nativeEvent)} /> : null}
      <ArOverlay frame={frame} size={size} />
      <ArTopBar kicker={props.kicker} zone={props.zone} frame={frame} onBack={props.onBack} />
      {frame && !frame.stable && corners.count ? <TrackingLost onRestart={corners.restart} /> : null}
      <ArBottomBar frame={frame} count={corners.count} failure={corners.failure} onUndo={corners.undo} onMark={corners.mark} onClose={corners.close} />
    </View>
  );
}

function ArTopBar(props: { kicker: string; zone: number; frame: ArFrame | null; onBack: () => void }) {
  const tracking = props.frame?.state === 'tracking' && props.frame.floor;
  const state = props.frame?.state === 'installing' ? 'Instalando AR…' : tracking ? 'Piso detectado' : 'Buscando piso';
  return (
    <View className="absolute inset-x-3 top-3 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-2">
      <Pressable testID="cerrar-ar" onPress={props.onBack} accessibilityLabel="Salir sin guardar" className="h-11 w-11 items-center justify-center rounded-full bg-white/10"><X size={22} color="white" /></Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-white/70" numberOfLines={1}>{`${props.kicker} · Zona ${props.zone}`}</Text>
        <Text className="text-[17px] font-bold text-white">{`Zona ${props.zone}`}</Text>
      </View>
      <Text testID="estado-ar" className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${tracking ? 'border-primary/60 bg-primary/30 text-white' : 'border-white/20 text-white/80'}`}>{state}</Text>
    </View>
  );
}

function ArBottomBar(props: { frame: ArFrame | null; count: number; failure: string | null; onUndo: () => void; onMark: () => void; onClose: () => void }) {
  const colors = useColores();
  const line = props.failure ?? (props.frame ? arAimLine(props.frame, props.count) : 'Abriendo la cámara…');
  const canClose = props.count >= MIN_CORNERS;
  return (
    <View className="absolute inset-x-3 bottom-4 gap-3">
      <Text testID="guia-ar" className="self-center rounded-full bg-black/70 px-4 py-2 text-[15px] font-semibold text-white">{line}</Text>
      <View className="flex-row items-center justify-between rounded-3xl border border-white/10 bg-black/60 px-4 py-3">
        <ArButton testID="deshacer-esquina-ar" label="Deshacer" disabled={!props.count} onPress={props.onUndo} icon={<Undo2 size={22} color="white" />} />
        <View className="items-center gap-1">
          <Pressable testID="marcar-esquina" onPress={props.onMark} accessibilityLabel="Marcar esquina" className="h-[72px] w-[72px] items-center justify-center rounded-full bg-primary"><Plus size={34} color={colors['on-primary']} /></Pressable>
          <Text className="text-[13px] font-semibold text-white">{`Marcar esquina · ${props.count}`}</Text>
        </View>
        <ArButton testID="cerrar-poligono" label="Cerrar" disabled={!canClose} onPress={props.onClose} icon={<Spline size={22} color="white" />} />
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

const UNAVAILABLE: Record<string, { title: string; body: string }> = {
  'no-permission': { title: 'Lilachat necesita la cámara para medir', body: 'Activa el permiso de cámara en los ajustes del teléfono y vuelve aquí.' },
  declined: { title: 'Falta instalar Google Play Services para AR', body: 'Instálalo desde Play Store para medir con AR, o mide ahora con una foto desde arriba y la wincha.' },
  error: { title: 'El AR no pudo arrancar', body: 'Mide la zona con una foto desde arriba y la wincha.' },
};
const unavailableCopy = (state: string) => UNAVAILABLE[state] ?? { title: 'Este teléfono no tiene AR', body: 'Mide la zona con una foto desde arriba y la wincha.' };

/** Design la-07: no camera permission, or a phone without AR: the photo and the tape still measure. */
function ArUnavailable(props: { state: string; onBack: () => void; onPhotoInstead: () => void }) {
  const colors = useColores();
  const permission = props.state === 'no-permission';
  const { title, body } = unavailableCopy(props.state);
  return (
    <View testID="ar-no-disponible" className="flex-1 justify-center gap-4 bg-background p-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-variant"><CameraOff size={30} color={colors['on-surface-variant']} /></View>
      <Text className="text-[22px] font-bold text-on-surface">{title}</Text>
      <Text className="text-[15px] text-on-surface-variant">{body}</Text>
      {permission ? <Pressable testID="abrir-ajustes" onPress={() => void Linking.openSettings()} className="h-14 items-center justify-center rounded-2xl border border-primary/40"><Text className="text-[16px] font-bold text-primary">Abrir ajustes</Text></Pressable> : null}
      <Pressable testID="medir-con-foto" onPress={props.onPhotoInstead} className="h-14 items-center justify-center rounded-2xl bg-primary"><Text className="text-[16px] font-bold text-on-primary">Medir con foto + wincha</Text></Pressable>
      <Pressable onPress={props.onBack} className="h-11 items-center justify-center"><Text className="text-[15px] text-on-surface-variant">Volver</Text></Pressable>
    </View>
  );
}
