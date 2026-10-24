import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, LocateFixed, User } from 'lucide-react-native';
import { geoPointOf, precisionLabel, type FormField, type GeoPoint } from '@lilachat/shared';
import { Segmentado } from '../../ui/Segmentado';
import { useColores } from '../../ui/tema';
import { MapSnippet } from '../location/MapSnippet';
import { useCurrentLocation } from '../location/useCurrentLocation';

const MAP_HEIGHT = 120;
const SELFIE = 80;
/** A selfie for the app, not a portrait: small enough to go up on a weak signal. */
const SELFIE_QUALITY = 0.6;
/** The digits of a one-time code, spread like the six boxes of a sign-in. */
const CODE_LETTER_SPACING = 10;

export type PhotoUpload = (photo: { uri: string; mime: string }, stamp?: GeoPoint) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;
type FieldProps<K extends FormField['kind']> = { field: Extract<FormField, { kind: K }>; value: unknown; error?: string; onChange: (value: unknown) => void };

function ErrorLine(props: { text?: string }) {
  return props.text ? <Text className="mt-1 text-[13px] text-error">{props.text}</Text> : null;
}

function Label(props: { field: FormField }) {
  return (
    <Text className="mb-1.5 text-[14px] font-semibold text-on-surface">
      {props.field.label}
      {props.field.required ? '' : <Text className="font-normal text-on-surface-variant"> · opcional</Text>}
    </Text>
  );
}

/** Up to four side by side (design e-28), more as a list of choices. */
export function ChoiceField({ field, value, error, onChange }: FieldProps<'choice'>) {
  return (
    <View>
      {field.segmented ? null : <Label field={field} />}
      {field.segmented ? (
        <Segmentado opciones={field.options.map((option) => ({ key: option.value, etiqueta: option.label, testID: `opcion-${field.name}-${option.value}` }))} valor={typeof value === 'string' ? value : ''} onCambiar={onChange} />
      ) : (
        <View className="gap-1.5">
          {field.options.map((option) => (
            <Pressable key={option.value} testID={`opcion-${field.name}-${option.value}`} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} className={`min-h-[44px] justify-center rounded-xl border px-3 ${value === option.value ? 'border-primary bg-primary/[0.08]' : 'border-outline/20'}`}>
              <Text className="text-[15px] text-on-surface">{option.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {field.help ? <Text className="mt-1 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <ErrorLine text={error} />
    </View>
  );
}

/** Text, a number with its unit, or a date typed as the schema asks («2026-10-23»). */
export function TypedField({ field, value, error, onChange }: FieldProps<'text' | 'number' | 'date'>) {
  const colors = useColores();
  const multiline = field.kind === 'text' && field.multiline;
  /** A one-time code (connecting an account): big digits, the number pad and the SMS autofill. */
  const code = field.kind === 'text' ? field.digits : undefined;
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return (
    <View>
      <Label field={field} />
      <View className="flex-row items-center gap-2">
        <TextInput
          testID={`campo-${field.name}`}
          value={text}
          onChangeText={(next) => onChange(next === '' ? undefined : next)}
          multiline={multiline}
          maxLength={code ? code : field.kind === 'text' ? field.maxLength : undefined}
          keyboardType={code || (field.kind === 'number' && field.integer) ? 'number-pad' : field.kind === 'number' ? 'decimal-pad' : 'default'}
          textContentType={code ? 'oneTimeCode' : undefined}
          autoComplete={code ? 'sms-otp' : undefined}
          placeholder={field.kind === 'date' ? (field.withTime ? 'AAAA-MM-DD HH:MM' : 'AAAA-MM-DD') : undefined}
          placeholderTextColor={colors['on-surface-variant']}
          className={`min-h-[48px] flex-1 rounded-xl border border-outline/25 bg-background px-3 text-on-surface ${code ? 'text-center text-[28px] font-bold' : 'text-[16px]'} ${multiline ? 'py-2' : ''}`}
          style={multiline ? { minHeight: 88, textAlignVertical: 'top' } : code ? { letterSpacing: CODE_LETTER_SPACING, fontVariant: ['tabular-nums'] } : undefined}
        />
        {field.kind === 'number' && field.unit ? <Text className="text-[15px] font-semibold text-on-surface-variant">{field.unit}</Text> : null}
      </View>
      {field.help ? <Text className="mt-1 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <ErrorLine text={error} />
    </View>
  );
}

/** «Tu ubicación» with its precision on a small map; asked while the sheet is open, never in the background. */
export function LocationField({ field, error, onChange, width }: FieldProps<'location'> & { width: number }) {
  const colors = useColores();
  const { current, retry } = useCurrentLocation(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const point: GeoPoint | null = current.state === 'ready' ? geoPointOf({ latitude: current.location.lat, longitude: current.location.lng, accuracy: current.location.accuracy ?? 0 }) : null;
  useEffect(() => {
    onChangeRef.current(point ?? undefined);
  }, [point?.lat, point?.lng, point?.precision]);
  return (
    <View className="rounded-2xl border border-outline/15 p-3">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="text-[15px] font-semibold text-on-surface">{field.label}</Text>
        {point ? (
          <View testID={`precision-${field.name}`} className="flex-row items-center gap-1.5 rounded-full border border-en-linea/30 bg-en-linea/10 px-2.5 py-1">
            <View className="h-1.5 w-1.5 rounded-full bg-en-linea" />
            <Text className="text-[12px] font-semibold text-en-linea">{precisionLabel(point)}</Text>
          </View>
        ) : null}
      </View>
      {current.state === 'ready' ? (
        <View className="overflow-hidden rounded-xl">
          <MapSnippet location={current.location} width={width - 24} height={MAP_HEIGHT} testID={`mapa-${field.name}`} />
        </View>
      ) : (
        <View className="items-center gap-2 rounded-xl bg-surface-variant px-4 py-5">
          {current.state === 'locating' ? <ActivityIndicator color={colors.primary} /> : <LocateFixed size={20} color={colors['on-surface-variant']} />}
          <Text className="text-center text-[14px] text-on-surface">{current.state === 'locating' ? 'Buscando tu ubicación…' : current.state === 'denied' ? 'Permite la ubicación para registrar.' : 'No se pudo leer tu ubicación.'}</Text>
          {current.state === 'denied' ? (
            <Pressable onPress={() => void Linking.openSettings()} className="h-10 justify-center rounded-full bg-primary px-5"><Text className="text-[13px] font-semibold text-on-primary">Abrir ajustes</Text></Pressable>
          ) : current.state === 'error' ? (
            <Pressable onPress={retry} className="h-10 justify-center rounded-full bg-primary px-5"><Text className="text-[13px] font-semibold text-on-primary">Reintentar</Text></Pressable>
          ) : null}
        </View>
      )}
      <ErrorLine text={error} />
    </View>
  );
}

/** «Tomar selfie»: the front camera, and the photo goes up at once; the form carries its id. */
export function PhotoField({ field, value, error, onChange, upload }: FieldProps<'photo'> & { upload: PhotoUpload }) {
  const colors = useColores();
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ busy: boolean; message?: string }>({ busy: false });
  const take = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setStatus({ busy: false, message: 'Permite la cámara para tomar la foto.' });
    const shot = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: SELFIE_QUALITY, allowsEditing: false });
    const asset = shot.canceled ? null : shot.assets[0];
    if (!asset) return;
    setPreview(asset.uri);
    setStatus({ busy: true });
    onChange(undefined);
    const uploaded = await upload({ uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg' });
    if (uploaded.ok) onChange(uploaded.fileId);
    setStatus({ busy: false, ...(uploaded.ok ? {} : { message: uploaded.message }) });
  };
  return (
    <View className="flex-row items-center gap-4 rounded-2xl border border-outline/15 p-3">
      <View className="items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-outline/30 bg-background" style={{ width: SELFIE, height: SELFIE }}>
        {preview ? <Image source={{ uri: preview }} style={{ width: SELFIE, height: SELFIE }} /> : <User size={30} color={colors['on-surface-variant']} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">{field.label}</Text>
        {field.help ? <Text className="text-[13px] text-on-surface-variant">{field.help}</Text> : null}
        <Pressable testID={`campo-${field.name}`} disabled={status.busy} onPress={() => void take()} className={`mt-2 min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 ${status.busy ? 'opacity-50' : ''}`}>
          {status.busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Camera size={17} color={colors.primary} />}
          <Text className="text-[15px] font-semibold text-on-surface">{status.busy ? 'Subiendo…' : value ? 'Cambiar foto' : 'Tomar selfie'}</Text>
        </Pressable>
        <ErrorLine text={status.message ?? error} />
      </View>
    </View>
  );
}
