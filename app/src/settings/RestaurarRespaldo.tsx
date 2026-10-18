import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { DatabaseBackup } from 'lucide-react-native';
import { passphraseValida } from '@lilachat/shared';
import { descripcionDeRespaldo, descripcionDeRestauracion } from '../respaldo/planDeRestauracion';
import {
  restaurarDesdeLaMini,
  type PasoDeRestauracion,
  type RespaldoEnLaMini,
  type ResultadoDeRestauracion,
} from '../respaldo/restaurar';
import { registrarTareaDeFondo } from '../respaldo/tareaDeFondo';
import { useColores } from '../ui/tema';

/**
 * «Hay un respaldo de este número del 15/09 · 1,2 MB. ¿Restaurar?» (F12.2).
 *
 * Aparece sola en un teléfono nuevo (almacén vacío) y a mano desde Ajustes.
 * Pide la passphrase, muestra el paso en que va, y dice qué pasó: passphrase
 * incorrecta, descarga cortada, o «listo, N chats». Sin letra chica: si la
 * passphrase se perdió, no hay recuperación.
 */
const FRASE_DE_PASO: Record<PasoDeRestauracion, string> = {
  bajando: 'Bajando el respaldo del servidor…',
  verificando: 'Comprobando el archivo…',
  abriendo: 'Abriendo con tu passphrase…',
  importando: 'Guardando los mensajes en el teléfono…',
};

const FRASE_DE_FALLO: Record<Extract<ResultadoDeRestauracion, { ok: false }>['motivo'], string> = {
  descarga: 'No se pudo bajar el respaldo. Revisa la conexión y prueba de nuevo.',
  huella: 'El archivo llegó incompleto. Prueba de nuevo.',
  passphrase: 'La passphrase no es la de este respaldo.',
  importacion: 'No se pudo guardar el respaldo en el teléfono.',
};

export function RestaurarRespaldo({
  jwt,
  respaldo,
  onCerrar,
  onRestaurado,
}: {
  jwt: string;
  respaldo: RespaldoEnLaMini;
  onCerrar: () => void;
  onRestaurado: () => void;
}) {
  const colores = useColores();
  const [passphrase, setPassphrase] = useState('');
  const [paso, setPaso] = useState<PasoDeRestauracion | null>(null);
  const [resultado, setResultado] = useState<ResultadoDeRestauracion | null>(null);
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';
  const trabajando = paso !== null && !resultado;

  const restaurar = async () => {
    setResultado(null);
    setPaso('bajando');
    const salida = await restaurarDesdeLaMini({ jwt, respaldo, passphrase, onPaso: setPaso });
    setResultado(salida);
    if (salida.ok) {
      await registrarTareaDeFondo();
      onRestaurado();
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={trabajando ? undefined : onCerrar}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-2xl bg-surface p-5" testID="hoja-restaurar">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <DatabaseBackup size={18} color={colores.primary} />
            </View>
            <Text className="flex-1 text-base font-bold text-on-surface">Restaurar tus chats</Text>
          </View>
          <Text className="mt-3 text-sm text-on-surface" testID="restaurar-descripcion">
            Hay un respaldo de este número {descripcionDeRespaldo(respaldo, zona)}.
          </Text>

          {resultado?.ok ? (
            <>
              <Text className="mt-3 text-sm text-on-surface" testID="restaurar-listo">
                {descripcionDeRestauracion(resultado)}
              </Text>
              <Pressable testID="btn-restaurar-cerrar" onPress={onCerrar} className="mt-4 min-h-[44px] items-center justify-center rounded-lg bg-primary px-4">
                <Text className="text-sm font-semibold text-on-primary">Entrar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                testID="restaurar-passphrase"
                value={passphrase}
                onChangeText={setPassphrase}
                editable={!trabajando}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Tu passphrase de respaldo"
                placeholderTextColor={colores['on-surface-variant']}
                className="mt-3 min-h-[44px] rounded-lg bg-surface-variant px-3 text-sm text-on-surface"
              />
              {trabajando && paso ? (
                <View className="mt-3 flex-row items-center gap-2">
                  <ActivityIndicator color={colores.primary} />
                  <Text className="text-[12px] text-on-surface-variant" testID="restaurar-paso">{FRASE_DE_PASO[paso]}</Text>
                </View>
              ) : null}
              {resultado && !resultado.ok ? (
                <Text className="mt-2 text-[12px] text-error" testID="restaurar-fallo">{FRASE_DE_FALLO[resultado.motivo]}</Text>
              ) : null}
              <View className="mt-4 flex-row gap-2">
                <Pressable
                  testID="btn-restaurar"
                  disabled={!passphraseValida(passphrase) || trabajando}
                  onPress={() => void restaurar()}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-4 ${passphraseValida(passphrase) && !trabajando ? 'bg-primary' : 'bg-primary/40'}`}
                >
                  <Text className="text-sm font-semibold text-on-primary">Restaurar</Text>
                </Pressable>
                <Pressable
                  testID="btn-restaurar-ahora-no"
                  disabled={trabajando}
                  onPress={onCerrar}
                  className="min-h-[44px] items-center justify-center rounded-lg border border-outline/20 px-4"
                >
                  <Text className="text-sm font-semibold text-on-surface">Ahora no</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
