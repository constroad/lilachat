import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { evidenceLine, firstErrorField, formFields, formRows, initialValues, liveSelfieFieldOf, submitLabelOf, validateFormValues, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues, type GeoPoint } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { ChoiceField, LocationField, PhotoField, TypedField, type PhotoUpload } from './AppFormFields';
import { DateField } from './DateField';
import { ListField } from './ListField';
import { PhotoListField } from './PhotoListField';
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
/** Room above a field the sheet scrolls to, so its title shows too. */
const REVEAL_MARGIN = 12;
/** Between the two fields of a row. */
const ROW_GAP = 12;

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
  // What the app prefilled (agentes, 23/10: the verified phone) and today's date (José, 24/10); read once, so «now» is one instant.
  const prefilled = useMemo(() => initialValues(fields), [fields]);
  const [values, setValues] = useState<FormValues>(prefilled);
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
  // Sent and answered later (consensus 24/10): «Enviando…» until the answer closes it or the errors come back here.
  const waiting = props.answer.waiting === true;
  // Where each field sits in the scroll: after a refusal the sheet goes to the first one with an error (E2E 28/10).
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const showErrors = (next: Record<string, string>) => {
    setErrors(next);
    const name = firstErrorField(visibleFields(fields, values).map((field) => field.name), next);
    const y = name ? positions.current[name] : undefined;
    if (y === undefined) return;
    const reveal = () => scroll.current?.scrollTo({ y: Math.max(0, y - REVEAL_MARGIN), animated: true });
    if (!keyboard) return reveal();
    // With the keyboard up, the scroll goes back to the focused input (E2E 28/10: «Fecha»'s error stayed out of sight):
    // close it first, and go once the sheet has its height back.
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      hidden.remove();
      requestAnimationFrame(reveal);
    });
    Keyboard.dismiss();
  };
  useEffect(() => {
    if (!props.answer.errors) return;
    showErrors(props.answer.errors);
    setMessage(props.answer.errors._ ?? '');
  }, [props.answer.errors]);
  const evidence = evidenceLine(fields);
  const sheetWidth = Math.min(width, SHEET_MAX_WIDTH);
  const typed = Object.entries(values).some(([name, value]) => value !== undefined && value !== prefilled[name] && fields.find((field) => field.name === name)?.kind !== 'location');
  const close = () => {
    if (!typed) return props.onClose();
    Alert.alert('¿Descartar el formulario?', 'Lo que llenaste no se envía.', [{ text: 'Seguir llenando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: props.onClose }]);
  };
  const set = (name: string) => (value: unknown) => {
    setValues((before) => ({ ...before, [name]: value }));
    setErrors(({ [name]: _cleared, ...rest }) => rest);
  };
  /** A list: the cell that changed loses its error, and so does the list's own («Agrega al menos uno»). */
  const setList = (name: string) => (items: FormValues[], changed: string) => {
    setValues((before) => ({ ...before, [name]: items }));
    setErrors(({ [name]: _list, [changed]: _cell, ...rest }) => rest);
  };
  const send = async () => {
    const checked = validateFormValues(fields, signing.placeholders(values));
    if (!checked.ok) return showErrors(checked.errors);
    setSending(true);
    setMessage('');
    const prepared = await signing.prepare(values);
    if ('errors' in prepared) {
      setSending(false);
      return showErrors(prepared.errors);
    }
    const outcome = await props.onSubmit(prepared.values);
    setSending(false);
    if (!outcome.done) {
      showErrors(outcome.errors);
      setMessage(outcome.errors._ ?? outcome.message ?? '');
    }
  };
  /** One field; in a row of two (`half`) its position is the row's, written by the row. */
  const drawField = (field: FormField, half: boolean) =>
    live && field.name === live.name ? (
      <LiveSelfie key={field.name} ref={selfie} testID={`campo-${field.name}`} label={LIVE_PHOTO_KICKER} width={sheetWidth - SHEET_PADDING * 2} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />
    ) : (
      // In a signing the place shows inside the camera; its field keeps reading behind it.
      <View key={field.name} onLayout={half ? undefined : (event) => (positions.current[field.name] = event.nativeEvent.layout.y)} style={live && field.kind === 'location' ? { display: 'none' } : half ? { flex: 1, minWidth: 0 } : undefined}>
        {live && field.kind === 'choice' && field.segmented ? <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{LIVE_CHOICE_KICKER}</Text> : null}
        {field.kind === 'list' ? (
          <ListField
            field={field}
            value={values[field.name]}
            errors={errors}
            onChange={setList(field.name)}
            renderField={(child, value, error, onChange, key, half) => <Field key={key} field={child} value={value} error={error} onChange={onChange} upload={props.onUpload} width={sheetWidth - SHEET_PADDING * 4} half={half} />}
          />
        ) : (
          <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={set(field.name)} upload={props.onUpload} width={sheetWidth - SHEET_PADDING * 2} half={half} />
        )}
      </View>
    );
  const now = new Date();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 bg-black/40" onPress={close} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior="padding" className="self-center" style={{ width: sheetWidth }}>
        {/* The sheet caps its height and the fields scroll inside it: the button stays in sight (José, 23/10: a long form hid «Marcar»). */}
        <View testID={`formulario-${form.id}`} className="rounded-t-3xl bg-surface" style={{ maxHeight: (height - keyboard) * MAX_SCREEN_SHARE, paddingBottom: keyboard ? 8 : margins.pie + 8 }}>
          <View className="mt-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <View className="flex-row items-center gap-3 border-b border-outline/10 px-4 pb-3 pt-3">
            {props.answer.avatarUrl ? <AppLogo avatarUrl={props.answer.avatarUrl} size={40} /> : <Avatar nombre={props.answer.appName} tamano={40} bot />}
            <View className="min-w-0 flex-1">
              <Text className="text-[18px] font-bold text-on-surface" numberOfLines={1}>{form.title}</Text>
              <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{`${props.answer.appName} · hoy, ${now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}`}</Text>
            </View>
            <Pressable testID="btn-cerrar-formulario" accessibilityLabel="Cerrar" onPress={close} hitSlop={8} className="h-11 w-11 items-center justify-center">
              <X size={22} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ padding: SHEET_PADDING, gap: 14 }}>
            {props.answer.response?.text ? <Text testID="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[15px] text-on-surface">{props.answer.response.text}</Text> : null}
            {form.intro ? <Text className="text-[15px] text-on-surface-variant">{form.intro}</Text> : null}
            {evidence && !live ? (
              <View className="items-center rounded-2xl border border-outline/15 py-4">
                <Text className="text-[40px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                {props.personName ? <Text className="mt-1 rounded-lg border border-outline/15 px-3 py-1 text-[14px] text-on-surface">{props.personName}</Text> : null}
              </View>
            ) : null}
            {/* Two short fields share a row (José, 28/10: a field per row made the forms a sheet). */}
            {formRows(visibleFields(fields, values)).map((row) =>
              row.length === 2 ? (
                <View key={row[0]!.name} onLayout={(event) => row.forEach((field) => (positions.current[field.name] = event.nativeEvent.layout.y))} className="flex-row items-start" style={{ gap: ROW_GAP }}>
                  {row.map((field) => drawField(field, true))}
                </View>
              ) : (
                drawField(row[0]!, false)
              )
            )}
          </ScrollView>
          <View className="px-4">
            {/* Next to the button, never at the end of the scroll: a refusal there looked like a dead button (E2E 24/10). */}
            {message ? <Text testID="formulario-error" accessibilityRole="alert" className="mb-2 pt-2 text-[14px] text-error">{message}</Text> : null}
            <Pressable testID="btn-enviar-formulario" disabled={sending || waiting} onPress={() => void send()} className={`h-[72px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${sending || waiting ? 'opacity-60' : ''}`}>
              {sending || waiting ? <ActivityIndicator color={colors['on-primary']} /> : null}
              <Text className="text-[18px] font-bold text-on-primary">{waiting ? 'Enviando…' : sending ? signing.phaseLabel : submitLabelOf(form, fields, values)}</Text>
            </Pressable>
            {evidence ? <Text className="mt-2 text-center text-[13px] text-on-surface-variant">{live ? LIVE_FOOTER : evidence}</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field(props: { field: Exclude<FormField, { kind: 'list' }>; value: unknown; error?: string; onChange: (value: unknown) => void; upload: PhotoUpload; width: number; half?: boolean }) {
  const { field, upload, width, half, ...rest } = props;
  switch (field.kind) {
    case 'choice': return <ChoiceField field={field} {...rest} />;
    case 'date': return <DateField field={field} {...rest} compact={half} />;
    case 'location': return <LocationField field={field} {...rest} width={width} />;
    case 'photo': return field.multiple ? <PhotoListField field={field} error={rest.error} onChange={rest.onChange} upload={upload} /> : <PhotoField field={field} {...rest} upload={upload} />;
    default: return <TypedField field={field} {...rest} />;
  }
}
