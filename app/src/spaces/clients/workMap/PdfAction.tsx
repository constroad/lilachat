import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { ProgressPdfResult } from '@lilachat/shared';

/** A map PDF made by Portal: asked, then opened in the phone's viewer. */
export function PdfAction(props: { testID: string; label: string; icon: ReactNode; className: string; textClassName: string; create: () => Promise<ProgressPdfResult> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setError(null);
    const made = await props.create();
    setBusy(false);
    if (!made.ok) return setError(made.message);
    await Linking.openURL(made.url).catch((failure: Error) => setError(failure.message));
  };
  return (
    <View className="gap-1.5">
      <Pressable testID={props.testID} disabled={busy} onPress={() => void make()} className={`${props.className} ${busy ? 'opacity-60' : ''}`}>
        {props.icon}<Text className={props.textClassName}>{busy ? 'Generando PDF…' : props.label}</Text>
      </Pressable>
      {error ? <Text testID={`${props.testID}-error`} accessibilityRole="alert" className="text-[14px] font-semibold text-error">{error}</Text> : null}
    </View>
  );
}
