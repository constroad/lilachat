import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { formatPhoneDisplay } from '@lilachat/shared';
import { requestOtp, verifyOtp } from '../api/client';
import { saveCredential, type Credential } from '../auth/credentialStore';
import { isCompleteOtp, mapVerifyFailure, shouldAutoSubmitOtp } from './machine';
import { useColores } from '../ui/tema';

/**
 * Alta paso 2 (diseño Stitch «Verificación OTP»). El sexto dígito envía solo;
 * el deviceId nace ACÁ (lo genera el teléfono, como en Timón) y solo se
 * persiste junto al secreto si el canje sale bien.
 */
/** Lo que el diseño muestra como temporizador antes de habilitar el reenvío. */
const RESEND_SECONDS = 60;

const formatCountdown = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function OtpScreen({
  phone,
  onDone,
  onBack,
}: {
  phone: string;
  onDone: (credential: Credential) => void;
  onBack: () => void;
}) {
  const colores = useColores();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  /**
   * Cuenta regresiva del reenvío, como en el diseño («00:57»). No es adorno:
   * sin ella se puede tocar «Reenviar» sin parar, y cada toque le gasta un
   * correo a constroad-auth y consume el tope por destino.
   */
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [sentByEmail, setSentByEmail] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = async (candidate: string) => {
    if (!isCompleteOtp(candidate) || verifying) return;
    setVerifying(true);
    setError('');
    const deviceId = Crypto.randomUUID();
    const result = await verifyOtp({ phone, code: candidate.trim(), deviceId });
    setVerifying(false);
    if (!result.ok) {
      setError(mapVerifyFailure(result.status, result.message));
      return;
    }
    const credential: Credential = {
      userId: result.data.user.id,
      deviceId,
      deviceSecret: result.data.deviceSecret,
      jwt: result.data.jwt,
      phone,
      name: result.data.user.name,
    };
    await saveCredential(credential);
    onDone(credential);
  };

  const onChange = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, 6);
    const previous = code;
    setCode(digits);
    setError('');
    if (shouldAutoSubmitOtp(previous, digits)) void verify(digits);
  };

  const habilitado = isCompleteOtp(code) && !verifying;

  return (
    <View className="flex-1 bg-background px-6 pt-24" testID="pantalla-otp">
      {/* Badge del diseño: dice de qué se trata la pantalla antes de leer nada. */}
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <ShieldCheck size={24} color={colores.primary} />
      </View>
      <Text className="mt-5 text-3xl font-bold text-on-surface">Verificar Número</Text>
      <Text className="mt-2 text-base leading-6 text-on-surface-variant">
        Si tu número tiene acceso, te llegó un código al {formatPhoneDisplay(phone)}.
      </Text>

      {/* SEIS CAJAS, como el diseño. Un solo input con letter-spacing se ve
          parecido de lejos pero no muestra en qué dígito va uno.
          El input real es invisible y captura el teclado; las cajas son la
          representación — es el patrón estándar y evita seis estados. */}
      <Pressable
        testID="cajas-otp"
        onPress={() => inputRef.current?.focus()}
        className="mt-8 flex-row justify-between"
      >
        {Array.from({ length: 6 }, (_unused, index) => {
          const digit = code[index] ?? '';
          const active = index === code.length;
          return (
            <View
              key={index}
              testID={`otp-caja-${index}`}
              className={`h-14 w-[46px] items-center justify-center rounded-lg border bg-surface ${
                active ? 'border-primary' : digit ? 'border-outline/40' : 'border-outline/20'
              }`}
            >
              <Text className="text-2xl font-semibold text-on-surface">{digit}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        testID="input-otp"
        className="absolute h-px w-px opacity-0"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChangeText={onChange}
      />

      {error ? (
        <Text className="mt-3 text-sm text-error" testID="error-otp">
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="btn-verificar"
        disabled={!habilitado}
        onPress={() => void verify(code)}
        className={`mt-6 min-h-[52px] items-center justify-center rounded-lg ${
          habilitado ? 'bg-primary' : 'bg-primary/30'
        }`}
      >
        {verifying ? (
          <ActivityIndicator color={colores['on-primary']} />
        ) : (
          /**
           * Deshabilitado el texto NO usa `on-primary`.
           *
           * El fondo inactivo es `bg-primary/30`, o sea el primario translúcido
           * sobre el fondo de la pantalla: el resultado se parece al fondo, no al
           * primario. En oscuro eso deja el violeta oscuro de `on-primary` casi
           * encima del navy y el botón queda ilegible (visto en el emulador,
           * 27/08/2026). Con el gris de texto secundario se lee inactivo en los
           * dos modos, que es lo que un deshabilitado tiene que comunicar.
           */
          <Text
            className={`text-base font-bold ${
              habilitado ? 'text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            Entrar
          </Text>
        )}
      </Pressable>

      {/* El respaldo por correo se OFRECE siempre, no solo cuando WhatsApp
          falla con error: el caso real es que WhatsApp responda «ok» y el
          mensaje igual no llegue. Se muestra a todos —incluso a quien no tiene
          respaldo— porque decir quién lo tiene delataría quién está invitado. */}
      <Pressable
        testID="btn-por-correo"
        disabled={sentByEmail}
        onPress={() => {
          setSentByEmail(true);
          setSecondsLeft(RESEND_SECONDS);
          void requestOtp(phone, true);
        }}
        className="mt-6 min-h-[44px] items-center justify-center"
      >
        <Text className="text-sm font-semibold text-secondary">
          {sentByEmail ? 'Te lo mandamos por correo' : '¿No te llegó? Envíalo a mi correo'}
        </Text>
      </Pressable>

      <Pressable
        testID="btn-reenviar"
        disabled={secondsLeft > 0}
        onPress={() => {
          setSecondsLeft(RESEND_SECONDS);
          void requestOtp(phone);
        }}
        className="mt-4 min-h-[44px] items-center justify-center"
      >
        <Text
          className={`text-sm font-semibold ${secondsLeft > 0 ? 'text-on-surface-variant' : 'text-primary'}`}
        >
          {secondsLeft > 0 ? `Reenviar en ${formatCountdown(secondsLeft)}` : 'Reenviar el código'}
        </Text>
      </Pressable>

      <Pressable
        testID="btn-atras"
        onPress={onBack}
        className="min-h-[44px] items-center justify-center"
      >
        <Text className="text-sm text-on-surface-variant">Cambiar el número</Text>
      </Pressable>
    </View>
  );
}
