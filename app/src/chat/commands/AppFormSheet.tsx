import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { evidenceLine, formFields, formRows, liveSelfieFieldOf, submitLabelOf, visibleFields, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues, type GeoPoint, type PreviewReply } from '@lilachat/shared';
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
import { useFormLive } from './useFormLive';
import { useAppFormState } from './useAppFormState';
import { isRichChoice, MultiField, RichChoiceField } from './RichChoiceFields';
import { BotBlocksView } from '../botBlocks/BotBlocksView';

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
/** Built once: Hermes builds a new formatter for every date string with options. */
const TODAY = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
const CLOCK = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

type SheetProps = { answer: EphemeralAnswer; personName?: string; onSubmit: (values: FormValues) => Promise<FormSubmitOutcome>; onUpload: PhotoUpload; onClose: () => void; /** `x-refresh`: the app sends the form again for the new draft. */ onRefresh?: (draft: FormValues) => Promise<void>; /** `x-preview`: the app's summary of the draft. */ onPreview?: (draft: FormValues) => Promise<PreviewReply> };

/** The keyboard's height: the sheet rises above it and shrinks to fit (José, 23/10: he typed the code without seeing it). */
function useKeyboardHeight() {
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => setKeyboard(event.endCoordinates.height));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return keyboard;
}

/** After a refusal the sheet goes to the first field with an error (E2E 28/10), at `y` in the scroll. */
function revealField(scroll: RefObject<ScrollView | null>, y: number | undefined, keyboardUp: boolean) {
  if (y === undefined) return;
  const reveal = () => scroll.current?.scrollTo({ y: Math.max(0, y - REVEAL_MARGIN), animated: true });
  if (!keyboardUp) return reveal();
  // With the keyboard up, the scroll goes back to the focused input (E2E 28/10: «Fecha»'s error stayed out of sight):
  // close it first, and go once the sheet has its height back.
  const hidden = Keyboard.addListener('keyboardDidHide', () => {
    hidden.remove();
    requestAnimationFrame(reveal);
  });
  Keyboard.dismiss();
}

/** Something the person wrote, beyond what came prefilled and the place read by itself. */
function typedSomething(fields: readonly FormField[], values: FormValues, prefilled: FormValues): boolean {
  return Object.entries(values).some(([name, value]) => value !== undefined && value !== prefilled[name] && fields.find((field) => field.name === name)?.kind !== 'location');
}

/**
 * An app's form as a sheet (R160, design e-28): the fields its schema says,
 * the moment and who is registering when it carries a location or a photo, and
 * the app's button («Marcar ingreso», 72 pt: it is used standing, in the
 * plant). What is missing is said field by field before it leaves; Android's
 * back on a filled form asks before throwing it away.
 */
export function AppFormSheet(props: SheetProps) {
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const form = props.answer.response!.form!;
  const fields = useMemo(() => formFields(form), [form]);
  const keyboard = useKeyboardHeight();
  // A form with a location and a photo is a signing (pending 94): live selfie, place of now, one tap.
  const live = useMemo(() => liveSelfieFieldOf(fields), [fields]);
  const locationName = fields.find((field) => field.kind === 'location')?.name;
  const selfie = useRef<LiveSelfieHandle>(null);
  const signing = useLiveSigning({ live, locationName, selfie, upload: props.onUpload });
  // Where each field sits in the scroll, to reach the first one with an error.
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const state = useAppFormState({ fields, refused: props.answer.errors, signing, onSubmit: props.onSubmit, reveal: (name) => revealField(scroll, positions.current[name], keyboard > 0) });
  const formLive = useFormLive({ fields, values: state.values, preview: form.preview, onRefresh: props.onRefresh, onPreview: props.onPreview });
  const sheetWidth = Math.min(width, SHEET_MAX_WIDTH);
  // The summary's remarks under their fields; the person's own errors win.
  const slot: SlotContext = { values: state.values, errors: { ...formLive.summary.errors, ...state.errors }, live, locationName, selfie, upload: props.onUpload, set: state.set, setList: state.setList, width: sheetWidth, positions };
  // Sent and answered later (consensus 24/10): «Enviando…» until the answer closes it or the errors come back here.
  const waiting = props.answer.waiting === true;
  const evidence = evidenceLine(fields);
  const close = () => {
    if (!typedSomething(fields, state.values, state.prefilled)) return props.onClose();
    Alert.alert('¿Descartar el formulario?', 'Lo que llenaste no se envía.', [{ text: 'Seguir llenando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: props.onClose }]);
  };
  const label = waiting ? 'Enviando…' : state.sending ? signing.phaseLabel : submitLabelOf(form, fields, state.values);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 bg-black/40" onPress={close} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior="padding" className="self-center" style={{ width: sheetWidth }}>
        {/* The sheet caps its height and the fields scroll inside it: the button stays in sight (José, 23/10: a long form hid «Marcar»). */}
        <View testID={`formulario-${form.id}`} className="rounded-t-3xl bg-surface" style={{ maxHeight: (height - keyboard) * MAX_SCREEN_SHARE, paddingBottom: keyboard ? 8 : margins.pie + 8 }}>
          <View className="mt-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <SheetHeader answer={props.answer} onClose={close} />
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ padding: SHEET_PADDING, gap: 14 }}>
            <FormIntro answer={props.answer} refreshing={formLive.refreshing} clock={Boolean(evidence) && !live} personName={props.personName} />
            {/* Two short fields share a row (José, 28/10: a field per row made the forms a sheet). */}
            {formRows(visibleFields(fields, state.values)).map((row) =>
              row.length === 2 ? (
                <View key={row[0]!.name} onLayout={(event) => row.forEach((field) => (positions.current[field.name] = event.nativeEvent.layout.y))} className="flex-row items-start" style={{ gap: ROW_GAP }}>
                  {row.map((field) => <FieldSlot key={field.name} field={field} half context={slot} />)}
                </View>
              ) : (
                <FieldSlot key={row[0]!.name} field={row[0]!} half={false} context={slot} />
              )
            )}
          </ScrollView>
          <SheetFooter summary={formLive.summary.blocks} message={state.message} busy={state.sending || waiting} label={label} note={evidence ? (live ? LIVE_FOOTER : evidence) : ''} onSend={() => void state.send()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The app, the form's title and today, with the close. */
function SheetHeader(props: { answer: EphemeralAnswer; onClose: () => void }) {
  const colors = useColores();
  const { answer } = props;
  const today = TODAY.format(new Date());
  return (
    <View className="flex-row items-center gap-3 border-b border-outline/10 px-4 pb-3 pt-3">
      {answer.avatarUrl ? <AppLogo avatarUrl={answer.avatarUrl} size={40} /> : <Avatar nombre={answer.appName} tamano={40} bot />}
      <View className="min-w-0 flex-1">
        <Text className="text-[18px] font-bold text-on-surface" numberOfLines={1}>{answer.response?.form?.title}</Text>
        <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{`${answer.appName} · hoy, ${today}`}</Text>
      </View>
      <Pressable testID="btn-cerrar-formulario" accessibilityLabel="Cerrar" onPress={props.onClose} hitSlop={8} className="h-11 w-11 items-center justify-center">
        <X size={22} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

/** Above the fields: why the options are changing, the app's line, and the clock of a registration. */
function FormIntro(props: { answer: EphemeralAnswer; refreshing: boolean; clock: boolean; personName?: string }) {
  const { answer } = props;
  return (
    <>
      {props.refreshing ? <Text testID="formulario-actualizando" className="text-[14px] text-on-surface-variant">Actualizando las opciones…</Text> : null}
      {answer.response?.text ? <Text testID="formulario-texto" className="rounded-xl bg-primary/10 px-3 py-2.5 text-[15px] text-on-surface">{answer.response.text}</Text> : null}
      {answer.response?.form?.intro ? <Text className="text-[15px] text-on-surface-variant">{answer.response.form.intro}</Text> : null}
      {props.clock ? (
        <View className="items-center rounded-2xl border border-outline/15 py-4">
          <Text className="text-[40px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{CLOCK.format(new Date())}</Text>
          {props.personName ? <Text className="mt-1 rounded-lg border border-outline/15 px-3 py-1 text-[14px] text-on-surface">{props.personName}</Text> : null}
        </View>
      ) : null}
    </>
  );
}

/** By the button, never at the end of the scroll: a refusal there looked like a dead button (E2E 24/10). */
function SheetFooter(props: { summary: PreviewReply['blocks']; message: string; busy: boolean; label: string; note: string; onSend: () => void }) {
  const colors = useColores();
  return (
    <View className="px-4">
      {props.summary.length ? (
        <View testID="formulario-resumen" className="mb-2 mt-2 rounded-2xl border border-outline/15 p-3">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Resumen</Text>
          <BotBlocksView blocks={props.summary} />
        </View>
      ) : null}
      {props.message ? <Text testID="formulario-error" accessibilityRole="alert" className="mb-2 pt-2 text-[14px] text-error">{props.message}</Text> : null}
      <Pressable testID="btn-enviar-formulario" disabled={props.busy} onPress={props.onSend} className={`h-[72px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${props.busy ? 'opacity-60' : ''}`}>
        {props.busy ? <ActivityIndicator color={colors['on-primary']} /> : null}
        <Text className="text-[18px] font-bold text-on-primary">{props.label}</Text>
      </Pressable>
      {props.note ? <Text className="mt-2 text-center text-[13px] text-on-surface-variant">{props.note}</Text> : null}
    </View>
  );
}

/** What every field of the sheet draws from. */
type SlotContext = {
  values: FormValues;
  errors: Record<string, string>;
  live: Pick<FormField, 'name'> | null;
  locationName?: string;
  selfie: RefObject<LiveSelfieHandle | null>;
  upload: PhotoUpload;
  set: (name: string) => (value: unknown) => void;
  setList: (name: string) => (items: FormValues[], changed: string) => void;
  width: number;
  positions: MutableRefObject<Record<string, number>>;
};

/** One field; in a row of two (`half`) its position is the row's, written by the row. */
function FieldSlot(props: { field: FormField; half: boolean; context: SlotContext }) {
  const { field, half } = props;
  const { values, errors, live, locationName, upload, width } = props.context;
  if (live && field.name === live.name) {
    return <LiveSelfie ref={props.context.selfie} testID={`campo-${field.name}`} label={LIVE_PHOTO_KICKER} width={width - SHEET_PADDING * 2} location={locationName ? ((values[locationName] as GeoPoint | undefined) ?? null) : null} error={errors[field.name] ?? (locationName ? errors[locationName] : undefined)} />;
  }
  return (
    // In a signing the place shows inside the camera; its field keeps reading behind it.
    <View onLayout={half ? undefined : (event) => (props.context.positions.current[field.name] = event.nativeEvent.layout.y)} style={live && field.kind === 'location' ? { display: 'none' } : half ? { flex: 1, minWidth: 0 } : undefined}>
      {live && field.kind === 'choice' && field.segmented ? <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{LIVE_CHOICE_KICKER}</Text> : null}
      {field.kind === 'list' ? (
        <ListField
          field={field}
          value={values[field.name]}
          errors={errors}
          onChange={props.context.setList(field.name)}
          renderField={(child, value, error, onChange, key, halfCell) => <Field key={key} field={child} value={value} error={error} onChange={onChange} upload={upload} width={width - SHEET_PADDING * 4} half={halfCell} />}
        />
      ) : (
        <Field field={field} value={values[field.name]} error={errors[field.name]} onChange={props.context.set(field.name)} upload={upload} width={width - SHEET_PADDING * 2} half={half} />
      )}
    </View>
  );
}

function Field(props: { field: Exclude<FormField, { kind: 'list' }>; value: unknown; error?: string; onChange: (value: unknown) => void; upload: PhotoUpload; width: number; half?: boolean }) {
  const { field, upload, width, half, ...rest } = props;
  switch (field.kind) {
    case 'choice': return isRichChoice(field) ? <RichChoiceField field={field} {...rest} /> : <ChoiceField field={field} {...rest} compact={half} />;
    case 'multi': return <MultiField field={field} {...rest} />;
    case 'date': return <DateField field={field} {...rest} compact={half} />;
    case 'location': return <LocationField field={field} {...rest} width={width} />;
    case 'photo': return field.multiple ? <PhotoListField field={field} error={rest.error} onChange={rest.onChange} upload={upload} /> : <PhotoField field={field} {...rest} upload={upload} />;
    default: return <TypedField field={field} {...rest} />;
  }
}
