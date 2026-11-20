import { useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Link2, Share2, X } from 'lucide-react-native';
import { SERVICE_LINK_DAY_OPTIONS, type ServiceLinkChoice, type ServiceMapResult } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';

export type ServiceLinkCreate = (choice: ServiceLinkChoice) => Promise<ServiceMapResult>;
type LinkState = { busy: boolean; url: string | null; error: string | null };
const IDLE: LinkState = { busy: false, url: null, error: null };
const OPTION = 'min-h-[44px] flex-1 items-center justify-center rounded-xl border';

/** The term of the link: 7, 30 or 60 days, or «No expira». */
function TermPicker(props: { choice: ServiceLinkChoice; onChoice: (choice: ServiceLinkChoice) => void }) {
  const { choice } = props;
  const tone = (on: boolean) => (on ? 'border-primary bg-primary/10' : 'border-outline/20');
  const label = (on: boolean) => `text-[13px] font-semibold ${on ? 'text-primary' : 'text-on-surface'}`;
  const option = (testID: string, text: string, on: boolean, next: ServiceLinkChoice) => (
    <Pressable key={testID} testID={testID} accessibilityState={{ selected: on }} onPress={() => props.onChoice(next)} className={`${OPTION} ${tone(on)}`}>
      <Text className={label(on)} numberOfLines={1}>{text}</Text>
    </Pressable>
  );
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-semibold text-on-surface">Vigencia</Text>
      <View className="flex-row gap-2">
        {SERVICE_LINK_DAY_OPTIONS.map((days) => option(`enlace-servicio-dias-${days}`, `${days} días`, !choice.never && choice.days === days, { days, never: false }))}
        {option('enlace-servicio-no-expira', 'No expira', choice.never, { ...choice, never: true })}
      </View>
    </View>
  );
}

/** The link made: its address, «Copiar» (the app's toast) and «Compartir» (Android's sheet). */
function MadeLink({ url }: { url: string }) {
  const colors = useColores();
  const copy = () => void Clipboard.setStringAsync(url).then(() => ToastAndroid.show('Enlace copiado', ToastAndroid.SHORT));
  const share = () => void Share.share({ message: url }).catch((failure: Error) => console.warn('service link: share closed', failure.name));
  return (
    <View className="gap-2">
      <Text testID="enlace-servicio-url" numberOfLines={1} className="rounded-lg border border-outline/20 bg-background px-2.5 py-2 font-mono text-[12px] text-on-surface">{url}</Text>
      <View className="flex-row gap-2">
        <Pressable testID="enlace-servicio-copiar" onPress={copy} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary/10">
          <Copy size={15} color={colors.primary} />
          <Text className="text-[13px] font-semibold text-primary">Copiar</Text>
        </Pressable>
        <Pressable testID="enlace-servicio-compartir" onPress={share} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-outline/20">
          <Share2 size={15} color={colors['on-surface']} />
          <Text className="text-[13px] font-semibold text-on-surface">Compartir</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * «Enlace del servicio» (José 20/11: it only took him to the chat and did nothing): the public link
 * of the service made here, over the service, with its term; copied or shared from the sheet.
 */
export function ServiceLinkSheet(props: { visible: boolean; serviceName: string; create: ServiceLinkCreate; onClose: () => void }) {
  const colors = useColores();
  const [choice, setChoice] = useState<ServiceLinkChoice>({ days: SERVICE_LINK_DAY_OPTIONS[0], never: false });
  const [state, setState] = useState<LinkState>(IDLE);
  const pick = (next: ServiceLinkChoice) => { setChoice(next); setState(IDLE); };
  const close = () => { setState(IDLE); props.onClose(); };
  const create = async () => {
    setState({ busy: true, url: null, error: null });
    const made = await props.create(choice);
    setState(made.ok ? { busy: false, url: made.url, error: null } : { busy: false, url: null, error: made.message });
  };
  return (
    <Sheet visible={props.visible} onClose={close} testID="hoja-enlace-servicio" className="gap-4 px-4">
      <View className="flex-row items-start gap-3 pt-1">
        <View className="min-w-0 flex-1">
          <Text className="text-[20px] font-bold text-on-surface">Enlace del servicio</Text>
          <Text className="text-[13px] text-on-surface-variant">{`El cliente abre «${props.serviceName}» sin cuenta de Portal.`}</Text>
        </View>
        <Pressable testID="enlace-servicio-cerrar" accessibilityLabel="Cerrar" onPress={close} className="h-11 w-11 items-center justify-center rounded-full border border-outline/15">
          <X size={18} color={colors['on-surface']} />
        </Pressable>
      </View>
      <TermPicker choice={choice} onChoice={pick} />
      {state.url ? <MadeLink url={state.url} /> : null}
      {state.error ? <Text testID="enlace-servicio-error" className="text-[13px] font-semibold text-error">{state.error}</Text> : null}
      {!state.url ? (
        <Pressable testID="enlace-servicio-crear" disabled={state.busy} onPress={() => void create()} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary ${state.busy ? 'opacity-60' : ''}`}>
          {state.busy ? <ActivityIndicator size="small" color={colors['on-primary']} /> : <Link2 size={17} color={colors['on-primary']} />}
          <Text className="text-[15px] font-semibold text-on-primary" numberOfLines={1}>{state.busy ? 'Creando…' : 'Crear enlace'}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}
