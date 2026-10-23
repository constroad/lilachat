import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, CircleDot } from 'lucide-react-native';
import { PRESENCE_MODES, broadcastStatus, presenceLine, type PresenceMode } from '@lilachat/shared';
import { readPresence, savePresence, type PresencePrefs } from '../../api/client';
import { Modal } from '../../ui/Modal';
import { Avatar } from '../../ui/Avatar';
import { FilaDeAjuste } from '../../ui/FilaDeAjuste';
import { Interruptor } from '../../ui/Interruptor';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

/** The dot of each mode, as in the design (`r148-estado`): green, amber, red, and a hollow grey ring. */
const DOT: Record<PresenceMode, string> = { auto: 'bg-en-linea', away: 'bg-warning', busy: 'bg-error', invisible: 'border-2 border-outline' };
const LINE_TONE: Record<PresenceMode, string> = { auto: 'text-en-linea', away: 'text-warning', busy: 'text-error', invisible: 'text-on-surface-variant' };

const summaryOf = (prefs: PresencePrefs): string => {
  const label = PRESENCE_MODES.find((one) => one.mode === prefs.mode)?.label ?? 'En línea';
  return `${label} · ${prefs.lastSeenHidden ? 'tu última vez no se ve' : 'tu última vez se ve'}`;
};

/**
 * «Estado» in Ajustes (pending 15, design `r148-estado`): how the others see
 * me — online, away, busy or invisible — whether my «últ. vez» shows, and a
 * preview of the line under my name. Each change is saved at once.
 */
export function PresenceSetting(props: { jwt: string; name: string }) {
  const colors = useColores();
  const margins = useMargenes();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<PresencePrefs>({ mode: 'auto', lastSeenHidden: false });
  const [error, setError] = useState('');

  useEffect(() => {
    void readPresence(props.jwt).then((response) => response.ok && setPrefs(response.data));
  }, [props.jwt]);

  const change = (next: PresencePrefs) => {
    const before = prefs;
    setPrefs(next);
    setError('');
    void savePresence(props.jwt, next).then((response) => {
      if (response.ok) return;
      setPrefs(before);
      setError(response.status === 'network' ? 'Sin conexión: no se guardó.' : (response.message ?? 'No se pudo guardar.'));
    });
  };

  const preview = prefs.mode === 'invisible' ? (prefs.lastSeenHidden ? '' : 'últ. vez sin cambios') : (presenceLine({ online: true, status: broadcastStatus(prefs.mode) }) ?? '').toLowerCase();

  return (
    <>
      <FilaDeAjuste testID="ajuste-estado" icono={CircleDot} titulo="Estado" detalle={summaryOf(prefs)} onPress={() => setOpen(true)} />
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }} testID="pantalla-estado">
          <View className="h-14 flex-row items-center gap-2 border-b border-outline/10 bg-surface px-2">
            <Pressable testID="btn-volver-estado" accessibilityLabel="Volver" onPress={() => setOpen(false)} className="h-11 w-11 items-center justify-center">
              <ArrowLeft size={22} color={colors['on-surface']} />
            </Pressable>
            <Text className="text-lg font-semibold text-on-surface">Estado</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24 }}>
            <Text className="mb-3 text-[14px] text-on-surface-variant">Elige cómo te ven los demás</Text>
            <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
              {PRESENCE_MODES.map((option, index) => {
                const selected = prefs.mode === option.mode;
                return (
                  <Pressable key={option.mode} testID={`estado-${option.mode}`} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => change({ ...prefs, mode: option.mode })} className={`min-h-[68px] flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-outline/10' : ''}`}>
                    <View className={`h-3 w-3 rounded-full ${DOT[option.mode]}`} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-on-surface">{option.label}</Text>
                      <Text className="mt-0.5 text-[13px] leading-5 text-on-surface-variant">{option.hint}</Text>
                    </View>
                    <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? 'border-primary' : 'border-outline/40'}`}>
                      {selected ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Privacidad</Text>
            <View className="flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 py-3">
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-on-surface">Mostrar mi última vez</Text>
                <Text className="mt-0.5 text-[13px] leading-5 text-on-surface-variant">Si lo apagas, nadie ve cuándo te conectaste por última vez.</Text>
              </View>
              <Interruptor testID="sw-ultima-vez" value={!prefs.lastSeenHidden} onValueChange={(show) => change({ ...prefs, lastSeenHidden: !show })} />
            </View>
            {error ? <Text testID="error-estado" className="mt-3 text-[13px] text-error">{error}</Text> : null}
            <Text className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Vista previa</Text>
            <View className="flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 py-3">
              <View>
                <Avatar nombre={props.name} tamano={44} />
                {prefs.mode === 'invisible' ? null : <View testID="punto-vista-previa" className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface ${DOT[prefs.mode]}`} />}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-on-surface">{props.name}</Text>
                <Text testID="vista-previa-estado" className={`text-[13px] ${LINE_TONE[prefs.mode]}`}>{preview || ' '}</Text>
              </View>
              <View className="rounded-full border border-outline/20 px-3 py-1">
                <Text className="text-[12px] text-on-surface-variant">Así te ven</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
