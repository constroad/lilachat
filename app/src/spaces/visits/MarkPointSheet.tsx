import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, CheckCircle2, RotateCcw, X } from 'lucide-react-native';
import { pointProblem, VISIT_MEASURE_UNITS, VISIT_POINT_TYPES, type VisitDocument, type VisitPointDraft } from '@lilachat/shared';
import { openCamera, type CapturedShot } from '../../chat/camara/cameraRequests';
import { freshPoint } from '../../chat/location/freshPoint';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import type { DriveFile } from '../clients/useDriveUpload';

type Place = { lat: number; lng: number; precisionM?: number };
type Props = { document: VisitDocument; n: number; onSave: (point: Omit<VisitPointDraft, 'lat' | 'lng'> & { lat?: number; lng?: number }, photo: DriveFile | null) => void; onClose: () => void };

const CAMERA_TITLE = 'Foto del punto';

/** The shot's own GPS (burned in its stamp), else a fresh reading: never the phone's cached one. */
function placeOfShot(shot: CapturedShot | null): Place | null {
  const point = shot?.stamp.point;
  return point ? { lat: point.lat, lng: point.lng, precisionM: Math.round(point.precision) } : null;
}

const fileOf = (shot: CapturedShot): DriveFile => ({ uri: shot.uri, name: `punto-${Date.now()}.${shot.mime.split('/')[1] ?? 'jpg'}`, mime: shot.mime, stamp: shot.stamp });

/** The camera first, and the GPS read beside it (design lv02). */
function useShotAndPlace() {
  const [shot, setShot] = useState<CapturedShot | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [denied, setDenied] = useState(false);
  const take = async () => {
    const taken = await openCamera({ title: CAMERA_TITLE });
    if (taken === 'denied') return setDenied(true);
    if (!taken) return;
    setShot(taken);
    const fromShot = placeOfShot(taken);
    if (fromShot) setPlace(fromShot);
  };
  useEffect(() => {
    void take();
    void freshPoint().then((point) => point && setPlace((known) => known ?? { lat: point.lat, lng: point.lng, precisionM: Math.round(point.precision) }));
    // Once, when the sheet opens.
     
  }, []);
  return { shot, place, denied, take };
}

function PhotoArea({ shot, place, onTake }: { shot: CapturedShot | null; place: Place | null; onTake: () => void }) {
  const colors = useColores();
  const gps = place ? `GPS ±${place.precisionM ?? '?'} m` : 'Buscando GPS…';
  return (
    <View className="h-56 overflow-hidden bg-surface-variant">
      {shot ? <Image source={{ uri: shot.uri }} className="h-full w-full" resizeMode="cover" /> : null}
      <View className="absolute left-3 top-3 rounded-lg bg-black/70 px-2 py-1">
        <Text testID="punto-gps" className="font-mono text-[12px] text-white">{gps}</Text>
      </View>
      <Pressable testID="punto-foto" onPress={onTake} className="absolute right-3 top-3 min-h-[40px] flex-row items-center gap-1.5 rounded-lg bg-surface px-3">
        {shot ? <RotateCcw size={16} color={colors.primary} /> : <Camera size={16} color={colors.primary} />}
        <Text className="text-[14px] font-semibold text-primary">{shot ? 'Repetir' : 'Tomar foto'}</Text>
      </Pressable>
    </View>
  );
}

function TypeChips({ value, onChoose }: { value: string; onChoose: (type: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {VISIT_POINT_TYPES.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable key={option.value} testID={`punto-tipo-${option.value}`} onPress={() => onChoose(option.value)} accessibilityState={{ selected: chosen }} className={`min-h-[52px] basis-[31%] grow items-center justify-center rounded-xl px-2 ${chosen ? 'bg-primary' : 'border border-outline/20 bg-surface'}`}>
            <Text numberOfLines={2} className={`text-center text-[14px] ${chosen ? 'font-bold text-on-primary' : 'text-on-surface'}`}>{option.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MeasureRow({ measure, unit, onMeasure, onUnit }: { measure: string; unit: string; onMeasure: (text: string) => void; onUnit: (unit: string) => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-2">
      <TextInput testID="punto-medida" value={measure} onChangeText={onMeasure} keyboardType="decimal-pad" placeholder="Medida" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] w-28 rounded-xl border border-outline/20 bg-surface px-3 text-[15px] text-on-surface" />
      {VISIT_MEASURE_UNITS.map((option) => (
        <Pressable key={option.value} testID={`punto-unidad-${option.value}`} onPress={() => onUnit(unit === option.value ? '' : option.value)} className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3 ${unit === option.value ? 'bg-primary' : 'border border-outline/20 bg-surface'}`}>
          <Text className={`text-[14px] ${unit === option.value ? 'font-bold text-on-primary' : 'text-on-surface'}`}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** What «Guardar punto» sends: the measure only with a number, the note only when written. */
function draftOf(type: string, measure: string, unit: string, note: string, place: Place | null) {
  const value = Number(measure.replace(',', '.'));
  const hasMeasure = measure.trim() !== '' && Number.isFinite(value);
  return { type, ...(note.trim() ? { note: note.trim() } : {}), ...(hasMeasure ? { measure: value } : {}), ...(unit ? { unit } : {}), ...(place ?? {}) };
}

/**
 * «Marcar un punto» (design lv02): the camera opens first; then what it is, an optional measure and
 * note, and «Guardar punto N». Without GPS the point does not go (Portal needs where it is).
 */
export function MarkPointSheet(props: Props) {
  const colors = useColores();
  const margins = useMargenes();
  const { shot, place, denied, take } = useShotAndPlace();
  const [type, setType] = useState('');
  const [measure, setMeasure] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const draft = draftOf(type, measure, unit, note, place);
  const problem = pointProblem({ lat: Number.NaN, lng: Number.NaN, ...draft }, props.document);
  const save = () => props.onSave(draft, shot ? fileOf(shot) : null);
  return (
    <View testID="marcar-punto" className="absolute inset-0 bg-background" style={{ paddingTop: margins.cabecera }}>
      <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
        <Pressable testID="marcar-punto-cerrar" onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center"><X size={22} color={colors['on-surface']} /></Pressable>
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{`Visita · ${props.document.code}`}</Text>
          <Text className="text-[18px] font-bold text-on-surface">Marcar un punto</Text>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        <PhotoArea shot={shot} place={place} onTake={() => void take()} />
        {denied ? <Text className="px-4 pt-2 text-[13px] text-error">Permite la cámara para tomar la foto.</Text> : null}
        <View className="gap-3 p-4">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">¿Qué es?</Text>
          <TypeChips value={type} onChoose={setType} />
          <MeasureRow measure={measure} unit={unit} onMeasure={setMeasure} onUnit={setUnit} />
          <TextInput testID="punto-nota" value={note} onChangeText={setNote} maxLength={200} placeholder="Nota (opcional)" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/20 bg-surface px-3 text-[15px] text-on-surface" />
        </View>
      </ScrollView>
      <View className="gap-1 border-t border-outline/10 px-4 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
        {problem && type ? <Text testID="punto-problema" className="text-center text-[13px] text-on-surface-variant">{problem}</Text> : null}
        <Pressable testID="guardar-punto" disabled={Boolean(problem)} onPress={save} className={`min-h-[72px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${problem ? 'opacity-50' : ''}`}>
          <CheckCircle2 size={20} color={colors['on-primary']} />
          <Text className="text-[17px] font-bold text-on-primary">{`Guardar punto ${props.n}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
