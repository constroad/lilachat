import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { EXAMPLE_BANNER_ACTION, EXAMPLE_BANNER_ASK, EXAMPLE_BANNER_CLOSE, exampleDismissKeys, exampleBannerLine, isExampleDismissed, parseExampleDismissed, runExampleFill, showsExampleBanner, withExampleDismissed, type ExampleFiller, type ExampleOutcome, type ExampleProgress, type FieldDocument } from '@lilachat/shared';
import { createPrefStore } from '../../../ui/prefStore';
import { useColores } from '../../../ui/tema';

/** The reports whose banner this phone closed. */
const dismissedStore = createPrefStore<string[]>('informe-ejemplo-oculto', parseExampleDismissed, [], (keys) => JSON.stringify(keys));

type Props = { report: FieldDocument; serviceId: string; type: string; onFill: ExampleFiller };

/**
 * «¿Probando? · Completar datos de ejemplo» over a draft's sections (José 20/11, design imp-05): fills every
 * section that has Portal's example, one save after another; closed, this phone does not show it again
 * for the report. The web's twin is `ExampleBannerWeb`.
 */
export function ExampleBanner(props: Props) {
  const colors = useColores();
  const dismissed = dismissedStore.use();
  const keys = exampleDismissKeys(props.serviceId, props.type, props.report.id);
  const [progress, setProgress] = useState<ExampleProgress | null>(null);
  const [outcome, setOutcome] = useState<ExampleOutcome | null>(null);
  if (isExampleDismissed(dismissed, keys) || (!showsExampleBanner(props.report) && !progress && !outcome)) return null;
  const fill = async () => {
    setOutcome(null);
    setProgress({ done: 0, total: 0 });
    const ended = await runExampleFill(props.onFill, setProgress);
    setProgress(null);
    setOutcome(ended);
  };
  const line = exampleBannerLine(progress, outcome);
  const busy = Boolean(progress);
  return (
    <View testID="aviso-datos-ejemplo" className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
      <View className="flex-row items-center gap-2">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <Sparkles size={18} color={colors.primary} />
        </View>
        <Text className="flex-1 text-[14px] font-semibold text-on-surface">{EXAMPLE_BANNER_ASK}</Text>
        <Pressable testID="ocultar-datos-ejemplo" accessibilityLabel={EXAMPLE_BANNER_CLOSE} disabled={busy} onPress={() => dismissedStore.set(withExampleDismissed(dismissed, keys))} className="h-11 w-11 items-center justify-center rounded-full">
          <X size={18} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      <Pressable testID="completar-datos-ejemplo" disabled={busy} onPress={() => void fill()} className={`mt-2 min-h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/15 px-3 ${busy ? 'opacity-60' : ''}`}>
        <Text className="text-center text-[13px] font-semibold text-primary">{EXAMPLE_BANNER_ACTION}</Text>
      </Pressable>
      {line ? <Text accessibilityLiveRegion="polite" testID="aviso-datos-ejemplo-estado" className={`mt-2 text-[13px] ${outcome?.failed ? 'text-error' : 'text-on-surface-variant'}`}>{line}</Text> : null}
    </View>
  );
}
