import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { evidenceLine, formFields, initialValues, liveSelfieFieldOf, submitLabelOf, validateFormValues, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues, type GeoPoint } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { ChoiceField, LocationField, PhotoField, TypedField, type PhotoUpload } from './AppFormFields';
import { LiveSelfie, type LiveSelfieHandle } from './LiveSelfie';
import { useLiveSigning } from './useLiveSigning';

const SHEET_PADDING = 16;
/** A sheet on a tablet or a turned phone stays the width of a phone. */
const SHEET_MAX_WIDTH = 560;
const MAX_SCREEN_SHARE = 0.92;
/** The two steps of a signing, as design e-32 writes them. */
const LIVE_CHOICE_KICKER = '1 · Qué marcas';
const LIVE_PHOTO_KICKER = '2 · Tu foto y tu ubicación';
const LIVE_FOOTER = 'Al tocar se toma la foto con la hora y el lugar, y se envía.';

/**
 * An app's form as a sheet (R160, design e-28): the fields its schema says,
 * the moment and who is registering when it carries a location or a photo, and
 * the app's button («Marcar ingreso», 72 pt: it is used standing, in the
 * plant). What is missing is said field by field before it leaves; Android's
 * back on a filled form asks before throwing it away.
 */
export function AppFormSheet(props: { answer: EphemeralAnswer; personName?: string; onSubmit: (values: FormValues) => Promise<FormSubmitOutcome>; onUpload: PhotoUpload; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const form = props.answer.response!.form!;
  const fields = useMemo(() => formFields(form), [form]);
  // What the app prefilled (agentes, 23/10: the verified phone for «Conecta tu cuenta»).
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  // The keyboard's height: the sheet rises above it and shrinks to fit (José, 23/10: he typed the code without seeing it).
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => setKeyboard(event.endCoordinates.height));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>(() => props.answer.errors ?? {});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // A form with a location and a photo is a signing (pending 94): live selfie, place of now, one tap.
  const live = useMemo(() => liveSelfieFieldOf(fields), [fields]);
  const locationName = fields.find((field) => field.kind === 'location')?.name;
  const selfie = useRef<LiveSelfieHandle>(null);
  const signing = useLiveSigning({ live, locationName, selfie, upload: props.onUpload });
  const evidence = evidenceLine(fields);
  const sheetWidth = Math.min(width, SHEET_MAX_WIDTH);
  const prefilled = useMemo(() => initialValues(fields), [fields]);
  const typed = Object.entries(values).some(([name, value]) => value !== undefined && value !== prefilled[name] && fields.find((field) => field.name === name)?.kind !== 'location');
  const close = () => {
    if (!typed) return props.onClose();
    Alert.alert('¿Descartar el formulario?', 'Lo que llenaste no se envía.', [{ text: 'Seguir llenando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: props.onClose }]);
  };
  const set = (name: string) => (value: unknown) => {
    setValues((before) => ({ ...before, [name]: value }));
    setErrors(({ [name]: _cleared, ...rest }) => rest);
  };
  const send = async () => {
    const checked = validateFormValues(fields, signing.placeholders(values));
    if (!checked.ok) return setErrors(checked.errors);
    setSending(true);
    setMessage('');
    const prepared = await signing.prepare(values);
    if ('errors' in prepared) {
      setSending(false);
      return setErrors(prepared.errors);
    }
    const outcome = await props.onSubmit(prepared.values);
    setSending(false);
    if (!outcome.done) {
      setErrors(outcome.errors);
      setMessage(outcome.errors._ ?? outcome.message ?? '');
    }
  };
  const now = new Date();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 bg-black/40" onPress={close} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior="padding" className="self-center" style={{ width: sheetWidth }}>
        {/* The sheet caps its height and the fields scroll inside it: the button stays in sight (José, 23/10: a long form hid «Marcar»). */}
        <View testID={`formulario-${form.id}`} className="rounded-t-3xl bg-surface" style={{ maxHeight: (height - keyboard) * MAX_SCREEN_SHARE, paddingBottom: keyboard ? 8 : margins.pie + 8 }}>
          <View className="mt-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <View className="flex-row items-center gap-3 border-b border-outline/10 px-4 pb-3 pt-3">
            <Avatar nombre={props.answer.appName} tamano={40} bot />
            <View className="min-w-0 flex-1">
              <Text className="text-[18px] font-bold text-on-surface" numberOfLines={1}>{form.title}</Text>
              <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{`${props.answer.appName} · hoy, ${now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}`}</Text>
            </View>
            <Pressable testID="btn-cerrar-formulario" accessibilityLabel="Cerrar" onPress={close} hitSlop={8} className="h-11 w-11 items-center justify-center">
              <X size={22} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ padding: SHEET_PADDING, gap: 14 }}>
            {props.answer.response?.text ? <Text testID="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[15px] text-on-surface">{props.answer.response.text}</Text> : null}
            {form.intro ? <Text className="text-[15px] text-on-surface-variant">{form.intro}</Text> : null}
            {evidence && !live ? (
              <View className="items-center rounded-2xl border border-outline/15 py-4">
                <Text className="text-[40px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                {props.personName ? <Text className="mt-1 rounded-lg border border-outline/15 px-3 py-1 text-[14px] text-on-surface">{props.personName}</Text> : null}
              </View>
            ) : null}
            {visibleFields(fields, values).map((field) =>
              live && field.name === live.name ? (
                <LiveSelfie key={field.name} ref={selfie} testID={`campo-${field.name}`} label={LIVE_PHOTO_KICKER} width={sheetWidth - SHEET_PADDING * 2} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />
              ) : (
                // In a signing the place shows inside the camera; its field keeps reading behind it.
                <View key={field.name} style={live && field.kind === 'location' ? { display: 'none' } : undefined}>
                  {live && field.kind === 'choice' && field.segmented ? <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{LIVE_CHOICE_KICKER}</Text> : null}
                  <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={set(field.name)} upload={props.onUpload} width={sheetWidth - SHEET_PADDING * 2} />
                </View>
              )
            )}
            {message ? <Text className="text-[14px] text-error">{message}</Text> : null}
          </ScrollView>
          <View className="px-4">
            <Pressable testID="btn-enviar-formulario" disabled={sending} onPress={() => void send()} className={`h-[72px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${sending ? 'opacity-60' : ''}`}>
              {sending ? <ActivityIndicator color={colors['on-primary']} /> : null}
              <Text className="text-[18px] font-bold text-on-primary">{sending ? signing.phaseLabel : submitLabelOf(form, fields, values)}</Text>
            </Pressable>
            {evidence ? <Text className="mt-2 text-center text-[13px] text-on-surface-variant">{live ? LIVE_FOOTER : evidence}</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field(props: { field: FormField; value: unknown; error?: string; onChange: (value: unknown) => void; upload: PhotoUpload; width: number }) {
  const { field, upload, width, ...rest } = props;
  switch (field.kind) {
    case 'choice': return <ChoiceField field={field} {...rest} />;
    case 'location': return <LocationField field={field} {...rest} width={width} />;
    case 'photo': return <PhotoField field={field} {...rest} upload={upload} />;
    default: return <TypedField field={field} {...rest} />;
  }
}
