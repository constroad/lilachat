import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, ChevronLeft, Play, Video, X } from 'lucide-react-native';
import { clipLength, observationPins, observationWorkMap, type Observation, type ObservationMap, type ObservationMedia, type WorkMapPoint } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { WorkMapSurface } from '../workMap/WorkMapSurface';
import type { CapturedEvidence } from '../useDriveUpload';

/**
 * The pieces the three observation screens share (José 11/11, designs `ob-01`
 * list, `ob-02` new, `ob-03` lift): header, evidence tiles, the camera's two
 * buttons, the map and the button at the bottom.
 */
export function ObservationHeader(props: { kicker: string; title: string; caption?: string; side?: ReactNode; onBack: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-start gap-2 border-b border-outline/10 bg-surface px-3 pb-3 pt-2">
      <Pressable testID="volver-observaciones" onPress={props.onBack} accessibilityLabel="Volver" className="h-14 w-14 items-center justify-center rounded-full">
        <ChevronLeft size={22} color={colors.primary} />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary" numberOfLines={1}>{props.kicker}</Text>
        <Text className="mt-0.5 text-[20px] font-bold text-on-surface" numberOfLines={2}>{props.title}</Text>
        {props.caption ? <Text className="mt-0.5 text-[13px] text-on-surface-variant" numberOfLines={1}>{props.caption}</Text> : null}
      </View>
      {props.side}
    </View>
  );
}

export function SectionTitle(props: { title: string; side?: string; sideTone?: 'primary' | 'error' }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{props.title}</Text>
      {props.side ? <Text className={`text-[11px] font-bold uppercase tracking-[1.5px] ${props.sideTone === 'error' ? 'text-error' : 'text-primary'}`}>{props.side}</Text> : null}
    </View>
  );
}

/** A square with a photo or the play mark of a video; its label on top and its length when it has one. */
function Tile(props: { testID: string; label: string; image?: string; video: boolean; seconds?: number; onPress?: () => void; onRemove?: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={props.onPress} disabled={!props.onPress} className="h-[112px] w-[112px] overflow-hidden rounded-xl border border-outline/20 bg-surface-variant">
      {props.image ? <Image source={{ uri: props.image }} className="absolute inset-0" resizeMode="cover" /> : null}
      <View className="flex-1 items-center justify-center">{props.video ? <View className="h-10 w-10 items-center justify-center rounded-full bg-primary"><Play size={18} color={colors['on-primary']} /></View> : props.image ? null : <Camera size={26} color={colors['on-surface-variant']} />}</View>
      <Text className="absolute left-1.5 top-1.5 rounded-md bg-on-surface/70 px-1.5 py-0.5 text-[10px] font-bold uppercase text-surface">{props.label}</Text>
      {props.seconds ? <Text className="absolute bottom-1.5 right-1.5 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{clipLength(props.seconds)}</Text> : null}
      {props.onRemove ? (
        <Pressable testID={`${props.testID}-quitar`} onPress={props.onRemove} accessibilityLabel="Quitar" className="absolute right-1 top-1 h-8 w-8 items-center justify-center rounded-full bg-surface/90">
          <X size={16} color={colors['on-surface']} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const isVideo = (mime: string) => mime.startsWith('video/');

/** What Portal already holds: photos show, videos play in the viewer. */
export function MediaRow(props: { media: readonly ObservationMedia[]; testID: string; onOpen: (index: number) => void }) {
  if (!props.media.length) return <Text className="text-[13px] text-on-surface-variant">Sin fotos ni videos.</Text>;
  return (
    <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {props.media.map((one, index) => (
        <Tile key={one.url} testID={`${props.testID}-${index}`} label={`${isVideo(one.mime) ? 'Video' : 'Foto'} ${index + 1}`} image={isVideo(one.mime) ? one.thumbUrl : one.thumbUrl ?? one.url} video={isVideo(one.mime)} seconds={one.durationS} onPress={() => props.onOpen(index)} />
      ))}
    </ScrollView>
  );
}

/** The two big buttons that open the camera (72 px: used walking, with gloves). */
export function CaptureButtons(props: { disabled: boolean; onTake: (kind: 'photo' | 'video') => void }) {
  const colors = useColores();
  return (
    <View className="flex-row gap-2">
      <Pressable testID="tomar-foto" disabled={props.disabled} onPress={() => props.onTake('photo')} className={`min-h-[72px] flex-1 items-center justify-center rounded-xl bg-primary ${props.disabled ? 'opacity-50' : ''}`}>
        <Camera size={22} color={colors['on-primary']} />
        <Text className="mt-1 text-[13px] font-bold uppercase text-on-primary">Foto</Text>
      </Pressable>
      <Pressable testID="grabar-video" disabled={props.disabled} onPress={() => props.onTake('video')} className={`min-h-[72px] flex-1 items-center justify-center rounded-xl border-[1.5px] border-primary bg-surface ${props.disabled ? 'opacity-50' : ''}`}>
        <Video size={22} color={colors.primary} />
        <Text className="mt-1 text-[13px] font-bold uppercase text-primary">Video</Text>
        <Text className="text-[10px] text-on-surface-variant">máx. 30 s</Text>
      </Pressable>
    </View>
  );
}

/** What was just taken, before it leaves the phone; each can be taken out. */
export function CapturedRow(props: { items: readonly CapturedEvidence[]; onRemove: (key: string) => void }) {
  if (!props.items.length) return null;
  return (
    <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {props.items.map((one, index) => (
        <Tile key={one.file.key} testID={`evidencia-${index}`} label={`${isVideo(one.preview.mime) ? 'Video' : 'Foto'} ${index + 1}`} image={isVideo(one.preview.mime) ? undefined : one.preview.uri} video={isVideo(one.preview.mime)} seconds={one.preview.seconds} onRemove={() => props.onRemove(one.file.key)} />
      ))}
    </ScrollView>
  );
}

/** The work map with every observation numbered; `here` adds the phone's place for a new one. */
export function ObservationMapView(props: { map: ObservationMap; observations: readonly Observation[]; here?: WorkMapPoint | null; height: number; testID: string }) {
  const view = useMemo(() => observationWorkMap(props.map, props.here ? [...props.observations, { ...hereAsObservation, ...props.here }] : props.observations), [props.map, props.observations, props.here]);
  const pins = useMemo(() => [...observationPins(props.observations), ...(props.here ? [{ id: 'aqui', label: '•', lat: props.here.lat, lng: props.here.lng, outside: false }] : [])], [props.observations, props.here]);
  return (
    <View testID={props.testID} pointerEvents="none" style={{ height: props.height }} className="overflow-hidden rounded-xl border-[1.5px] border-outline/15 bg-surface-variant">
      <WorkMapSurface view={view} moves={false} pins={pins} />
    </View>
  );
}

/** Only to frame the map on where the phone is. */
const hereAsObservation: Observation = { id: 'aqui', code: '', note: '', lat: null, lng: null, at: null, status: 'open', media: [], liftMedia: [] };

/** The one action of the screen, at the bottom; what stops it is said under it. */
/** Never turned off (§5-ter rule 4): the screen gives it the next pending step. Only a write in course holds it. */
export function BottomAction(props: { testID: string; label: string; icon: ReactNode; busy: boolean; tone?: 'primary' | 'ok'; note?: string | null; onPress: () => void }) {
  const colors = useColores();
  const fill = props.tone === 'ok' ? 'bg-en-linea' : 'bg-primary';
  return (
    <View className="gap-1.5 border-t border-outline/10 bg-surface px-4 pb-4 pt-3">
      <Pressable testID={props.testID} disabled={props.busy} onPress={props.onPress} className={`min-h-[60px] flex-row items-center justify-center gap-2 rounded-2xl ${fill} ${props.busy ? 'opacity-50' : ''}`}>
        {props.busy ? <ActivityIndicator color={colors['on-primary']} /> : props.icon}
        <Text className="text-[17px] font-bold text-on-primary">{props.label}</Text>
      </Pressable>
      {props.note ? <Text testID={`${props.testID}-nota`} className="text-center text-[13px] text-on-surface-variant">{props.note}</Text> : null}
    </View>
  );
}
