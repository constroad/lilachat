import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';

/**
 * «Ponme al día» (F8).
 *
 * **Stitch no diseñó ninguna pantalla de IA** —el spec las tiene como
 * pendientes de diseño—, así que esto es decisión propia y se anota como tal.
 *
 * Es una banda dentro de la conversación y no un botón fijo: solo tiene sentido
 * cuando hay algo sin leer, y un botón permanente invitaría a gastar una
 * llamada al modelo para que conteste «no te perdiste nada».
 *
 * El resumen se muestra ACÁ y no se publica en el chat: es para quien lo pidió,
 * y mandarlo a la conversación le llenaría el chat a los demás con algo que ya
 * leyeron.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

export function CatchUpBanner({
  chatId,
  credential,
  unread,
}: {
  chatId: string;
  credential: Credential;
  unread: number;
}) {
  const [estado, setEstado] = useState<'oculto' | 'listo' | 'cargando' | 'hecho'>('listo');
  const [texto, setTexto] = useState('');

  if (estado === 'oculto' || (unread === 0 && estado === 'listo')) return null;

  const pedir = async () => {
    setEstado('cargando');
    try {
      const response = await fetch(`${BASE_URL}/api/assistant/catch-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential.jwt}` },
        body: JSON.stringify({ chatId }),
        signal: AbortSignal.timeout(40_000),
      });
      const payload = (await response.json().catch(() => ({}))) as { text?: string; message?: string };
      setTexto(
        response.ok
          ? (payload.text ?? '')
          : (payload.message ?? 'Lila no pudo responder ahora.')
      );
    } catch {
      setTexto('Sin conexión con Lila. Inténtalo de nuevo.');
    }
    setEstado('hecho');
  };

  return (
    <View className="mx-3 mt-3 rounded-xl bg-primary/[0.07] p-3" testID="banda-ponme-al-dia">
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Sparkles size={16} color="#ffffff" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold text-on-surface">
            {estado === 'hecho' ? 'Lila te resume' : `${unread} mensajes sin leer`}
          </Text>
          {estado !== 'hecho' ? (
            <Text className="text-[11px] text-on-surface-variant">
              ¿Quieres que Lila te ponga al día?
            </Text>
          ) : null}
        </View>
        <Pressable
          testID="btn-cerrar-ponme-al-dia"
          onPress={() => setEstado('oculto')}
          className="h-9 w-9 items-center justify-center"
        >
          <X size={16} color="#7b7486" />
        </Pressable>
      </View>

      {estado === 'hecho' ? (
        <Text className="mt-2 text-[13px] leading-5 text-on-surface" testID="resumen-lila">
          {texto}
        </Text>
      ) : (
        <Pressable
          testID="btn-ponme-al-dia"
          disabled={estado === 'cargando'}
          onPress={() => void pedir()}
          className={`mt-2 min-h-[40px] items-center justify-center rounded-lg ${
            estado === 'cargando' ? 'bg-primary/40' : 'bg-primary'
          }`}
        >
          <Text className="text-[13px] font-bold text-on-primary">
            {estado === 'cargando' ? 'Leyendo el chat…' : 'Ponme al día'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
