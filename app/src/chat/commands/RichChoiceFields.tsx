import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronDown, Image as ImageIcon, Lock, X } from 'lucide-react-native';
import type { ChoiceOption, FormField } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { useFileViewer } from '../../spaces/clients/useFileViewer';
import { ErrorLine, Label } from './AppFormFields';

type FieldProps<K extends FormField['kind']> = { field: Extract<FormField, { kind: K }>; value: unknown; error?: string; onChange: (value: unknown) => void };
const SHEET_MAX_SHARE = '85%';
const ROW_HEIGHT = 76;

/** Whether a choice needs the rich list: a thumbnail to see, or an option that shows but cannot be picked. */
export const isRichChoice = (field: Extract<FormField, { kind: 'choice' }>): boolean => field.options.some((option) => option.thumb || option.disabled);

/** A locked option's look: dimmed, its label struck, its reason in the warning tone (design h-01). */
function OptionText(props: { option: ChoiceOption }) {
  const { option } = props;
  return (
    <View className="min-w-0 flex-1">
      <Text numberOfLines={1} className={`text-[16px] ${option.disabled ? 'text-on-surface-variant line-through' : 'font-semibold text-on-surface'}`}>{option.label}</Text>
      {option.sub ? <Text numberOfLines={1} className={`text-[13px] ${option.disabled ? 'text-warning' : 'text-on-surface-variant'}`}>{option.sub}</Text> : null}
    </View>
  );
}

/**
 * Several options at once (agentes 2483da7, design h-01): a row per option
 * with its check; a locked one stays in the list with why, never picked.
 * The web's `MultiField` is its twin.
 */
export function MultiField({ field, value, error, onChange }: FieldProps<'multi'>) {
  const colors = useColores();
  const picked = new Set(Array.isArray(value) ? value.map(String) : []);
  const toggle = (option: ChoiceOption) => {
    if (option.disabled) return;
    const next = new Set(picked);
    if (next.has(option.value)) next.delete(option.value);
    else next.add(option.value);
    onChange(field.options.filter((one) => next.has(one.value)).map((one) => one.value));
  };
  return (
    <View>
      <View className="flex-row items-center justify-between gap-2">
        <Label field={field} />
        {picked.size ? <Text testID={`elegidos-${field.name}`} className="mb-1.5 rounded-full border border-primary/30 px-2.5 py-0.5 text-[12px] font-semibold text-primary">{`${picked.size} ${picked.size === 1 ? 'elegido' : 'elegidos'}`}</Text> : null}
      </View>
      {field.options.length === 0 ? <Text testID={`sin-opciones-${field.name}`} className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">No hay opciones para elegir</Text> : null}
      <View className="gap-2">
        {field.options.map((option) => {
          const on = picked.has(option.value);
          return (
            <Pressable key={option.value} testID={`opcion-${field.name}-${option.value}`} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: Boolean(option.disabled) }} onPress={() => toggle(option)} className={`min-h-[60px] flex-row items-center gap-3 rounded-xl border px-3 py-2 ${option.disabled ? 'border-outline/15 bg-background' : on ? 'border-primary bg-primary/[0.06]' : 'border-outline/25'}`}>
              <View className={`h-7 w-7 items-center justify-center rounded-md border ${option.disabled ? 'border-outline/20' : on ? 'border-primary bg-primary' : 'border-outline/40'}`}>
                {option.disabled ? <Lock size={14} color={colors['on-surface-variant']} /> : on ? <Check size={16} strokeWidth={3} color={colors['on-primary']} /> : null}
              </View>
              <OptionText option={option} />
            </Pressable>
          );
        })}
      </View>
      {field.help ? <Text className="mt-1 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <ErrorLine text={error} />
    </View>
  );
}

/** The option's square picture, with how many photos are behind it (designs h-01, h-02). */
function Thumb(props: { option: ChoiceOption; size: number; onOpen?: () => void }) {
  const colors = useColores();
  const { option, size } = props;
  const count = option.photos?.length ?? 0;
  const body = (
    <View className="items-center justify-center overflow-hidden rounded-lg bg-background" style={{ width: size, height: size, opacity: option.disabled ? 0.5 : 1 }}>
      {option.thumb ? <Image source={{ uri: option.thumb }} style={{ width: size, height: size }} contentFit="cover" recyclingKey={option.value} /> : <ImageIcon size={20} color={colors['on-surface-variant']} />}
      {count > 1 ? <Text style={{ color: '#ffffff' }} className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-bold">{count}</Text> : null}
    </View>
  );
  if (!props.onOpen || !(count || option.thumb)) return body;
  return <Pressable testID={`ver-fotos-${option.value}`} accessibilityLabel={`Ver las fotos de ${option.label}`} onPress={props.onOpen}>{body}</Pressable>;
}

/**
 * One option out of a list that carries pictures or locked options (agentes
 * 2483da7, designs h-02/h-03): the picked one with its thumbnail; tapping
 * opens the list, tapping a thumbnail opens its photos in the viewer, and
 * «Elegir» confirms. The web's `RichChoiceField` is its twin.
 */
export function RichChoiceField({ field, value, error, onChange }: FieldProps<'choice'>) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const current = field.options.find((option) => option.value === value);
  return (
    <View>
      <Label field={field} />
      <Pressable testID={`campo-${field.name}`} accessibilityRole="button" onPress={() => setOpen(true)} className="min-h-[60px] flex-row items-center gap-3 rounded-xl border border-outline/25 bg-background px-3 py-2">
        {current ? <Thumb option={current} size={44} /> : null}
        {current ? <OptionText option={current} /> : <Text className="flex-1 text-[16px] text-on-surface-variant">Elige…</Text>}
        <ChevronDown size={18} color={colors['on-surface-variant']} />
      </Pressable>
      {field.help ? <Text className="mt-1 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <ErrorLine text={error} />
      {open ? <RichChoiceSheet field={field} value={current?.value ?? null} onPick={(picked) => { onChange(picked); setOpen(false); }} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

function RichChoiceSheet(props: { field: Extract<FormField, { kind: 'choice' }>; value: string | null; onPick: (value: string) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [draft, setDraft] = useState(props.value);
  const viewer = useFileViewer();
  const showPhotos = (option: ChoiceOption) => {
    const urls = option.photos?.length ? option.photos : option.thumb ? [option.thumb] : [];
    const files = urls.map((url, index) => ({ url, name: `${option.label} · foto ${index + 1}`, mime: 'image/jpeg' }));
    if (files[0]) viewer.open(files[0], files, option.disabled ? undefined : { label: 'Elegir esta opción', onPress: () => props.onPick(option.value) });
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID={`hoja-${props.field.name}`} className="rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: margins.pie + 8, maxHeight: SHEET_MAX_SHARE }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row items-center px-4">
          <Text className="flex-1 text-[20px] font-bold text-on-surface">{props.field.label}</Text>
          <Pressable onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center rounded-full bg-background"><X size={20} color={colors['on-surface-variant']} /></Pressable>
        </View>
        {props.field.options.some((option) => option.photos?.length) ? <Text className="px-4 pb-1 text-[13px] text-on-surface-variant">Toca la miniatura para ver las fotos.</Text> : null}
        <FlatList
          data={props.field.options}
          keyExtractor={(option) => option.value}
          getItemLayout={(_data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          renderItem={({ item: option }) => (
            <View className={`flex-row items-center gap-3 px-4 ${draft === option.value ? 'bg-primary/[0.06]' : ''}`} style={{ height: ROW_HEIGHT }}>
              <Thumb option={option} size={56} onOpen={() => showPhotos(option)} />
              <Pressable testID={`opcion-${props.field.name}-${option.value}`} accessibilityRole="radio" accessibilityState={{ selected: draft === option.value, disabled: Boolean(option.disabled) }} onPress={() => !option.disabled && setDraft(option.value)} className="min-w-0 flex-1 flex-row items-center gap-2">
                <OptionText option={option} />
                {draft === option.value ? <Check size={20} color={colors.primary} /> : null}
              </Pressable>
            </View>
          )}
        />
        <View className="px-4 pt-2">
          <Pressable testID={`elegir-${props.field.name}`} disabled={!draft} onPress={() => draft && props.onPick(draft)} className={`h-14 items-center justify-center rounded-2xl bg-primary ${draft ? '' : 'opacity-50'}`}>
            <Text className="text-[17px] font-bold text-on-primary">Elegir</Text>
          </Pressable>
        </View>
        {viewer.viewer}
      </View>
    </Modal>
  );
}
