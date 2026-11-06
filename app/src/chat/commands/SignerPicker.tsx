import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronRight, Search } from 'lucide-react-native';
import { chipLabelOf, filterChoiceOptions, SEARCHABLE_FROM, SIGNER_KICKER, type FormField } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';

type ChoiceField = Extract<FormField, { kind: 'choice' }>;

const CARD_AVATAR = 44;
const CHOSEN_AVATAR = 36;

function Problem({ text }: { text?: string }) {
  return text ? <Text className="mt-1 text-[13px] text-error">{text}</Text> : null;
}

/** The first step of a signing, like Portal's attendance page: a card per person; the camera waits for the name. */
export function SignerPicker(props: { field: ChoiceField; onPick: (value: string) => void }) {
  const { field } = props;
  const colors = useColores();
  const [query, setQuery] = useState('');
  const shown = filterChoiceOptions(field.options, query);
  return (
    <View testID="quien-firma" className="gap-2">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{SIGNER_KICKER}</Text>
      {field.options.length >= SEARCHABLE_FROM ? (
        <View className="min-h-[44px] flex-row items-center gap-2 rounded-full bg-background px-3">
          <Search size={16} color={colors['on-surface-variant']} />
          <TextInput testID="buscar-quien-firma" value={query} onChangeText={setQuery} placeholder="Busca tu nombre" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
        </View>
      ) : null}
      {shown.map((option) => (
        <Pressable key={option.value} testID={`firmante-${option.value}`} accessibilityRole="button" accessibilityLabel={option.label} disabled={option.disabled} onPress={() => props.onPick(option.value)} className="min-h-[64px] flex-row items-center gap-3 rounded-xl border border-outline/15 bg-surface p-3" style={option.disabled ? { opacity: 0.5 } : undefined}>
          <Avatar nombre={option.label} tamano={CARD_AVATAR} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[15px] font-bold text-on-surface">{option.label}</Text>
            {option.sub ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{option.sub}</Text> : null}
          </View>
          <ChevronRight size={18} color={colors['on-surface-variant']} />
        </Pressable>
      ))}
      {shown.length === 0 ? <Text testID="quien-firma-vacio" className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">Nadie se llama «{query}».</Text> : null}
    </View>
  );
}

/** Who is signing, above the camera; «Cambiar» goes back to the cards and turns the camera off. */
export function SignerCard(props: { field: ChoiceField; value: unknown; error?: string; onChange: () => void }) {
  const option = props.field.options.find((one) => one.value === props.value);
  return (
    <View>
      <View testID="firmante-elegido" className="flex-row items-center gap-3 rounded-xl border border-outline/15 p-2.5">
        <Avatar nombre={option?.label ?? ''} tamano={CHOSEN_AVATAR} />
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-bold text-on-surface">{option?.label}</Text>
        <Pressable testID="cambiar-firmante" accessibilityRole="button" onPress={props.onChange} className="min-h-[44px] justify-center px-2"><Text className="text-[13px] font-semibold text-primary">Cambiar</Text></Pressable>
      </View>
      <Problem text={props.error} />
    </View>
  );
}

/** What is signed, as chips in one line (José 06/11: a selector hid it under the camera). */
export function SigningChips(props: { field: ChoiceField; value: unknown; error?: string; onChange: (value: string) => void }) {
  const { field } = props;
  return (
    <View>
      <View testID={`chips-${field.name}`} accessibilityRole="radiogroup" className="flex-row gap-1.5">
        {field.options.map((option) => {
          const picked = props.value === option.value;
          return (
            <Pressable key={option.value} testID={`opcion-${field.name}-${option.value}`} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: picked }} onPress={() => props.onChange(option.value)} className={`min-h-[44px] flex-1 items-center justify-center rounded-full border px-1 ${picked ? 'border-primary bg-primary' : 'border-outline/25'}`}>
              <Text numberOfLines={1} adjustsFontSizeToFit className={`text-[13px] font-semibold ${picked ? 'text-on-primary' : 'text-on-surface'}`}>{chipLabelOf(option)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Problem text={props.error} />
    </View>
  );
}
