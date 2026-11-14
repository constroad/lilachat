import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { sectionHasBlankRequired, sectionHasError, sectionSlug, type FormField, type FormValues } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

type Props = {
  label: string;
  /** The schema asked for it folded (`x-collapsed`). */
  collapsed: boolean;
  /** The fields of the section that are on screen. */
  fields: readonly FormField[];
  values: FormValues;
  errors: Readonly<Record<string, string>>;
  /** A form that wears design gst-02: its headers are small capitals. */
  designed: boolean;
  /** Where the section sits in the sheet's scroll, so an error inside can be reached. */
  onPosition: (y: number) => void;
  children: ReactNode;
};

/**
 * A header the person opens (agentes 13/11: «Corregir datos» under the steps of «Revisar gasto»). It starts folded when the
 * schema says so, and nothing required hides: it starts open if a required field inside is blank, and opens by itself when an
 * error lands inside. After that the person decides. The web's twin is `FoldedSection`.
 */
export function FoldedSection(props: Props) {
  const colors = useColores();
  const failed = sectionHasError(props.fields, props.errors);
  const [open, setOpen] = useState(() => !props.collapsed || failed || sectionHasBlankRequired(props.fields, props.values));
  useEffect(() => {
    if (failed) setOpen(true);
  }, [failed]);
  const id = sectionSlug(props.label);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View testID={`seccion-${id}`} onLayout={(event) => props.onPosition(event.nativeEvent.layout.y)} className={`rounded-2xl border ${failed ? 'border-error/40' : 'border-outline/15'}`}>
      <Pressable testID={`seccion-${id}-cabecera`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((was) => !was)} className="min-h-[48px] flex-row items-center justify-between gap-2 px-4">
        <Text className={props.designed ? 'text-[11px] font-bold uppercase tracking-[1px] text-on-surface-variant' : 'text-[15px] font-semibold text-on-surface'}>{props.label}</Text>
        <Chevron size={18} color={colors['on-surface-variant']} />
      </Pressable>
      {open ? <View className="gap-3.5 px-4 pb-4">{props.children}</View> : null}
    </View>
  );
}
