import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PhoneIncoming } from 'lucide-react-native';
import { llamadaNativa } from '../../modules/llamada-entrante/src';
import { versionActual } from '../settings/versionApi';
import { registrarError } from '../diagnostico/diagnostico';
import { sessionInstaller } from '../../modules/instalador-apk/src';
import { askedForVersion, fullScreenLostOnUpdate, lastFullScreenSeen, markAsked, saveFullScreenSeen, shouldAskFullScreen, type FullScreenSeen } from './fullScreenPrompt';
import { Modal } from './Modal';
import { useMargenes } from './useMargenes';
import { useColores } from './tema';

/** After the first paint and the system's own prompts (notifications), not on top of them. */
const ASK_AFTER_MS = 1_500;

/**
 * An update that switched full-screen calls off goes to the diagnostics with
 * who installed it (José, 22/10): it tells whether the session installer
 * (`modules/instalador-apk`) keeps them on, on his Samsung and elsewhere.
 */
async function reportLostOnUpdate(now: FullScreenSeen): Promise<void> {
  if (!now.version) return;
  const before = await lastFullScreenSeen();
  if (fullScreenLostOnUpdate(before, now)) {
    void registrarError(new Error(`full-screen calls off after update ${before?.version} -> ${now.version}, installed by ${sessionInstaller.installedBy() ?? 'unknown'}`), 'pantalla-completa');
  }
  await saveFullScreenSeen(now);
}

/**
 * Once per version, while Android denies full-screen calls: what changes if
 * they stay off, and the shortcut to turn them on (spec §105, item 46).
 */
export function FullScreenCallsPrompt() {
  const colores = useColores();
  const margenes = useMargenes();
  const [visible, setVisible] = useState(false);
  const version = versionActual();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const allowed = llamadaNativa.puedePantallaCompleta();
      void reportLostOnUpdate({ version, allowed });
      void askedForVersion().then((asked) => {
        if (!cancelled && shouldAskFullScreen({ allowed, version, askedForVersion: asked })) setVisible(true);
      });
    }, ASK_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [version]);

  const close = (openSettings: boolean) => {
    setVisible(false);
    void markAsked(version);
    if (openSettings) llamadaNativa.abrirAjustesPantallaCompleta();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-surface px-5 pt-5" style={{ paddingBottom: margenes.pie }} testID="pregunta-pantalla-completa">
          <View className="mb-3 h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <PhoneIncoming size={20} color={colores.primary} />
          </View>
          <Text className="text-base font-bold text-on-surface">Activa las llamadas a pantalla completa</Text>
          <Text className="mt-2 text-[13px] leading-5 text-on-surface-variant">
            Android las apagó, a veces pasa al actualizar. Si las dejas apagadas, las llamadas igual suenan, pero llegan
            como una notificación más: con el teléfono bloqueado no se abre la pantalla para contestar y es fácil perderlas.
          </Text>
          <Pressable
            testID="btn-activar-pantalla-completa"
            onPress={() => close(true)}
            className="mt-5 min-h-[48px] items-center justify-center rounded-full bg-primary"
          >
            <Text className="text-sm font-semibold text-on-primary">Activar</Text>
          </Pressable>
          <Pressable testID="btn-ahora-no-pantalla-completa" onPress={() => close(false)} className="mt-2 min-h-[48px] items-center justify-center">
            <Text className="text-sm font-semibold text-primary">Ahora no</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
