import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint } from 'lucide-react-native';
import { APP_LOCK_DELAYS, DEFAULT_APP_LOCK_DELAY_MS } from '@lilachat/shared';
import { FilaDeAjuste, SANGRIA_DEL_TEXTO } from '../ui/FilaDeAjuste';
import { Interruptor } from '../ui/Interruptor';
import { setAppLockPref, useAppLockPref } from './appLock';
import { confirmarQueEresTu } from './desbloqueo';

/**
 * «Bloqueo de la app» (pending 9): on with the phone's own lock, and when to
 * ask again. A phone without a screen lock has nothing to ask with, so the
 * switch says so instead of pretending to protect.
 */
export function AppLockSetting() {
  const pref = useAppLockPref();
  const [phoneHasLock, setPhoneHasLock] = useState<boolean | null>(null);
  useEffect(() => {
    LocalAuthentication.getEnrolledLevelAsync()
      .then((level) => setPhoneHasLock(level !== LocalAuthentication.SecurityLevel.NONE))
      .catch(() => setPhoneHasLock(false));
  }, []);
  const enabled = pref?.enabled === true;
  const delayMs = pref?.delayMs ?? DEFAULT_APP_LOCK_DELAY_MS;

  const toggle = async (next: boolean) => {
    // Turning it on proves the owner can unlock; turning it off too, or anyone could.
    if (!(await confirmarQueEresTu(next ? 'Confirma para activar el bloqueo' : 'Confirma para quitar el bloqueo'))) return;
    setAppLockPref({ enabled: next, delayMs });
  };

  return (
    <FilaDeAjuste
      icono={Fingerprint}
      titulo="Bloqueo de la app"
      detalle={phoneHasLock === false ? 'Configura un bloqueo de pantalla en el teléfono para usarlo' : 'Pide tu huella o el bloqueo del teléfono al abrir Lilachat'}
      derecha={<Interruptor testID="sw-bloqueo-app" value={enabled} onValueChange={(next) => void toggle(next)} disabled={phoneHasLock !== true} />}
    >
      {enabled ? (
        <View className="flex-row flex-wrap gap-2 pb-3" style={{ paddingLeft: SANGRIA_DEL_TEXTO }}>
          {APP_LOCK_DELAYS.map((delay) => (
            <Pressable
              key={delay.ms}
              testID={`bloqueo-espera-${delay.ms}`}
              accessibilityRole="button"
              accessibilityState={{ selected: delay.ms === delayMs }}
              onPress={() => setAppLockPref({ enabled: true, delayMs: delay.ms })}
              className={`min-h-[36px] justify-center rounded-full border px-3 ${delay.ms === delayMs ? 'border-primary bg-primary/10' : 'border-outline/20'}`}
            >
              <Text className={`text-[13px] ${delay.ms === delayMs ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{delay.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </FilaDeAjuste>
  );
}
