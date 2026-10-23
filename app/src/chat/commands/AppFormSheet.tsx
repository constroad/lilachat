import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { evidenceLine, formFields, submitLabelOf, validateFormValues, type EphemeralAnswer, type FormField, type FormSubmitOutcome, type FormValues } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { ChoiceField, LocationField, PhotoField, TypedField, type PhotoUpload } from './AppFormFields';

const SHEET_PADDING = 16;
/** A sheet on a tablet or a turned phone stays the width of a phone. */
const SHEET_MAX_WIDTH = 560;
const MAX_SCREEN_SHARE = 0.92;

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
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const evidence = evidenceLine(fields);
  const sheetWidth = Math.min(width, SHEET_MAX_WIDTH);
  const typed = Object.entries(values).some(([name, value]) => value !== undefined && fields.find((field) => field.name === name)?.kind !== 'location');
  const close = () => {
    if (!typed) return props.onClose();
    Alert.alert('¿Descartar el formulario?', 'Lo que llenaste no se envía.', [{ text: 'Seguir llenando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: props.onClose }]);
  };
  const set = (name: string) => (value: unknown) => {
    setValues((before) => ({ ...before, [name]: value }));
    setErrors(({ [name]: _cleared, ...rest }) => rest);
  };
  const send = async () => {
    const checked = validateFormValues(fields, values);
    if (!checked.ok) return setErrors(checked.errors);
    setSending(true);
    setMessage('');
    const outcome = await props.onSubmit(values);
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="self-center" style={{ width: sheetWidth, maxHeight: height * MAX_SCREEN_SHARE }}>
        <View testID={`formulario-${form.id}`} className="rounded-t-3xl bg-surface" style={{ paddingBottom: margins.pie + 8 }}>
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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: SHEET_PADDING, gap: 14 }}>
            {evidence ? (
              <View className="items-center rounded-2xl border border-outline/15 py-4">
                <Text className="text-[40px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                {props.personName ? <Text className="mt-1 rounded-lg border border-outline/15 px-3 py-1 text-[14px] text-on-surface">{props.personName}</Text> : null}
              </View>
            ) : null}
            {fields.map((field) => <Field key={field.name} field={field} value={values[field.name]} error={errors[field.name]} onChange={set(field.name)} upload={props.onUpload} width={sheetWidth - SHEET_PADDING * 2} />)}
            {message ? <Text className="text-[14px] text-error">{message}</Text> : null}
          </ScrollView>
          <View className="px-4">
            <Pressable testID="btn-enviar-formulario" disabled={sending} onPress={() => void send()} className={`h-[72px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${sending ? 'opacity-60' : ''}`}>
              {sending ? <ActivityIndicator color={colors['on-primary']} /> : null}
              <Text className="text-[18px] font-bold text-on-primary">{sending ? 'Enviando…' : submitLabelOf(form, fields, values)}</Text>
            </Pressable>
            {evidence ? <Text className="mt-2 text-center text-[13px] text-on-surface-variant">{evidence}</Text> : null}
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
