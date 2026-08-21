import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowRight, MessagesSquare } from 'lucide-react-native';
import { COUNTRY_PREFIX, normalizePeruPhone } from '@lilachat/shared';
import { requestOtp } from '../api/client';

/**
 * Alta paso 1 (diseño «Registro: Teléfono»).
 *
 * **La identidad es el TELÉFONO**, no el correo. Es lo que dibuja el diseño y
 * lo que espera cualquiera en una app de mensajería: a la gente se la encuentra
 * por número. La primera versión pedía email por una suposición que quedó
 * obsoleta —que la lista de miembros vivía en Torre, que es por correo—; con la
 * lista en NUESTRA base, la identidad la decidimos nosotros.
 *
 * El prefijo va FIJO y no como selector: el servicio solo valida celulares
 * peruanos, y un selector de países que rechaza todos menos uno promete algo
 * que no puede cumplir.
 *
 * SIEMPRE avanza al paso del código con la respuesta genérica: esta pantalla no
 * sabe (ni puede saber) quién está invitado.
 */
export function PhoneScreen({ onCodeRequested }: { onCodeRequested: (phone: string) => void }) {
  const [rawPhone, setRawPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const phone = normalizePeruPhone(rawPhone);

  const submit = async () => {
    if (!phone || sending) return;
    setSending(true);
    setError('');
    const result = await requestOtp(phone);
    setSending(false);
    if (!result.ok && result.status === 'network') {
      setError('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
      return;
    }
    onCodeRequested(phone);
  };

  return (
    <View className="flex-1 justify-between bg-background px-6 pb-10 pt-24" testID="pantalla-telefono">
      <View className="flex-1 justify-center">
        <View className="items-center">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <MessagesSquare size={30} color="#6b38d4" />
          </View>
          <Text className="mt-6 text-3xl font-bold text-on-surface">Bienvenido a Lilachat</Text>
          <Text className="mt-2 text-center text-base leading-6 text-on-surface-variant">
            Ingresa tu número para comenzar a chatear con tus amigos.
          </Text>
        </View>

        {/* Prefijo y campo como en el diseño: dos piezas en una fila, el
            prefijo de ancho fijo y el campo estirándose. */}
        <View className="mt-8 flex-row items-center gap-2">
          <View className="h-[52px] shrink-0 flex-row items-center justify-center rounded-lg border border-outline/20 bg-surface-variant/40 px-4">
            <Text className="text-base font-semibold text-on-surface">🇵🇪 {COUNTRY_PREFIX}</Text>
          </View>
          <TextInput
            testID="input-telefono"
            className="h-[52px] min-w-0 flex-1 rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface"
            placeholder="Número de teléfono"
            placeholderTextColor="#7b7486"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={rawPhone}
            onChangeText={(text) => {
              setRawPhone(text);
              setError('');
            }}
            onSubmitEditing={() => void submit()}
          />
        </View>

        <Text className="mt-3 text-center text-[13px] leading-5 text-on-surface-variant">
          Te enviaremos un código para verificar tu número.
        </Text>

        {error ? (
          <Text className="mt-3 text-center text-sm text-error" testID="error-telefono">
            {error}
          </Text>
        ) : null}
      </View>

      <Pressable
        testID="btn-continuar"
        disabled={!phone || sending}
        onPress={() => void submit()}
        className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-lg ${
          phone && !sending ? 'bg-primary' : 'bg-primary/30'
        }`}
      >
        {sending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Text className="text-base font-bold text-on-primary">Continuar</Text>
            <ArrowRight size={18} color="#ffffff" />
          </>
        )}
      </Pressable>
    </View>
  );
}
