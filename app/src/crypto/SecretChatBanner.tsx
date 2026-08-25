import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { KeyRound, ShieldCheck, TriangleAlert, X } from 'lucide-react-native';
import type { SecretSession } from './useSecretChat';

/**
 * Lo que la conversación secreta le dice al usuario (F9).
 *
 * **Dice lo que NO hace, no solo lo que hace.** Un cartel de «cifrado de
 * extremo a extremo» a secas deja a la gente creyendo que tiene Signal. Acá se
 * nombran las tres consecuencias reales, porque las tres se notan:
 * Lila no entra, el respaldo no lo recupera, y perder el teléfono es perder la
 * conversación.
 *
 * Y la huella se puede mirar. Sin una forma de comparar, el cifrado protege
 * contra el server pero no contra que el server te dé la clave equivocada — que
 * es el único ataque que le queda a quien controla el directorio.
 */
export function SecretChatBanner({ session }: { session: SecretSession }) {
  const [viendoHuella, setViendoHuella] = useState(false);

  if (session.estado === 'cargando') {
    return (
      <View className="mx-3 mt-3 h-11 rounded-xl bg-primary/[0.07]" testID="cifrado-cargando" />
    );
  }

  if (session.estado === 'sin-clave') {
    return (
      <View
        className="mx-3 mt-3 flex-row items-center gap-3 rounded-xl bg-amber-500/10 p-3"
        testID="cifrado-sin-clave"
      >
        <TriangleAlert size={18} color="#d97706" />
        <Text className="min-w-0 flex-1 text-[12px] leading-4 text-on-surface">
          Todavía no puedes escribir aquí: la otra persona no ha abierto Lilachat
          en su teléfono, así que no tiene con qué descifrar.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        testID="banda-cifrado"
        onPress={() => setViendoHuella(true)}
        className="mx-3 mt-3 flex-row items-center gap-3 rounded-xl bg-primary/[0.07] p-3"
      >
        <ShieldCheck size={18} color="#6b38d4" />
        <Text className="min-w-0 flex-1 text-[12px] leading-4 text-on-surface-variant">
          Cifrado de punta a punta. Ni el servidor ni Lila pueden leer esto.
          <Text className="font-semibold text-primary"> Ver huella</Text>
        </Text>
      </Pressable>

      <Modal
        visible={viendoHuella}
        transparent
        animationType="fade"
        onRequestClose={() => setViendoHuella(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setViendoHuella(false)}
        >
          <View className="rounded-t-2xl bg-surface px-5 pb-10 pt-4" testID="hoja-huella">
            <View className="mb-3 flex-row items-center gap-2">
              <KeyRound size={18} color="#6b38d4" />
              <Text className="flex-1 text-base font-bold text-on-surface">
                Huella de seguridad
              </Text>
              <Pressable
                onPress={() => setViendoHuella(false)}
                className="h-9 w-9 items-center justify-center"
              >
                <X size={18} color="#7b7486" />
              </Pressable>
            </View>

            <Text className="text-[13px] leading-5 text-on-surface-variant">
              Compárala en voz alta con la otra persona. Si los dos ven los
              mismos números, nadie está en el medio.
            </Text>

            <Text
              testID="huella"
              className="mt-4 rounded-xl bg-primary/[0.07] p-4 text-center text-lg font-bold tracking-wider text-on-surface"
            >
              {session.fingerprint}
            </Text>

            {/* Lo que el cifrado APAGA. Se dice acá y no en letra chica: son
                tres cosas que el usuario va a notar, y enterarse después se
                siente como que la app se rompió. */}
            <Text className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              En este chat
            </Text>
            {[
              'Lila no puede resumirlo ni responder aquí.',
              'El respaldo lo guarda cifrado: no se lee sin este teléfono.',
              'Si pierdes el teléfono, se pierde la conversación.',
            ].map((linea) => (
              <Text key={linea} className="mt-1.5 text-[13px] leading-5 text-on-surface">
                · {linea}
              </Text>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
