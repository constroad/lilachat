import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CloudUpload, HardDrive, RefreshCw, Server, TriangleAlert } from 'lucide-react-native';
import { formatBytes, formatEventWhen } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { getBackupStatus, runBackupNow, type BackupStatus } from './backupApi';

/**
 * Copia de seguridad (diseño «Backup»).
 *
 * DOS COSAS DEL MOCKUP NO SE IMPLEMENTAN, y no por falta de tiempo:
 *
 * 1. **«Google Drive» como cuenta de almacenamiento.** El respaldo vive en la
 *    mini y en el storage de lila (spec §9). Dibujar Drive prometería que los
 *    datos están en una cuenta que el usuario controla, y no es cierto.
 * 2. **«Cifrado de extremo a extremo».** Es F9 y todavía no existe. Un cartel
 *    verde afirmándolo sería mentir justo sobre seguridad, que es la mentira
 *    más cara de todas.
 *
 * Los interruptores de «incluir fotos/videos» tampoco: la media ya vive en el
 * storage de lila y el respaldo guarda la LISTA, no los binarios. Un
 * interruptor que no cambia nada es peor que no tenerlo.
 */
const Section = ({ children }: { children: string }) => (
  <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
    {children}
  </Text>
);

export function BackupScreen({ credential }: { credential: Credential }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const result = await getBackupStatus(credential.jwt);
    setStatus(result.ok ? result.data : null);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setMessage('');
    const result = await runBackupNow(credential.jwt);
    setRunning(false);
    setMessage(
      result.ok
        ? `Respaldo hecho: ${result.data.sizeLabel}.`
        : (result.message ?? 'No se pudo respaldar.')
    );
    void load();
  };

  // El estado manda el color del héroe: sin respaldo, o con uno viejo, NO se
  // pinta el check verde. Un «todo al día» sobre una carpeta vacía convence de
  // que hay respaldo cuando no lo hay, que es el peor resultado posible.
  const alDia = status !== null && !status.stale;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      testID="pantalla-respaldo"
    >
      <View className="items-center pt-4">
        <View
          className={`h-20 w-20 items-center justify-center rounded-full ${
            alDia ? 'bg-primary/10' : 'bg-amber-500/10'
          }`}
        >
          {alDia ? (
            <CloudUpload size={34} color="#6b38d4" />
          ) : (
            <TriangleAlert size={34} color="#d97706" />
          )}
        </View>

        <Text className="mt-4 text-xl font-bold text-on-surface" testID="titulo-respaldo">
          {status === null
            ? 'Consultando…'
            : status.count === 0
              ? 'Todavía sin respaldo'
              : alDia
                ? 'Respaldo al día'
                : 'El respaldo está atrasado'}
        </Text>
        <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
          {status?.count === 0
            ? 'Toca «Respaldar ahora» para crear el primero.'
            : 'Tus chats se guardan cada noche en nuestro servidor.'}
        </Text>
      </View>

      <View className="mt-6 flex-row rounded-xl border border-outline/10 bg-surface">
        <View className="flex-1 items-center py-3">
          <Text className="text-[11px] uppercase tracking-wide text-on-surface-variant">
            Último respaldo
          </Text>
          <Text className="mt-1 text-sm font-semibold text-on-surface" testID="ultimo-respaldo">
            {status?.lastAt ? formatEventWhen(new Date(status.lastAt)) : '—'}
          </Text>
        </View>
        <View className="w-px bg-outline/10" />
        <View className="flex-1 items-center py-3">
          <Text className="text-[11px] uppercase tracking-wide text-on-surface-variant">
            Espacio usado
          </Text>
          <Text className="mt-1 text-sm font-semibold text-on-surface">
            {status ? status.totalLabel : '—'}
          </Text>
        </View>
      </View>

      <Pressable
        testID="btn-respaldar-ahora"
        disabled={running}
        onPress={() => void runNow()}
        className={`mt-4 min-h-[52px] flex-row items-center justify-center gap-2 rounded-lg ${
          running ? 'bg-primary/40' : 'bg-primary'
        }`}
      >
        <RefreshCw size={18} color="#ffffff" />
        <Text className="text-base font-bold text-on-primary">
          {running ? 'Respaldando…' : 'Respaldar ahora'}
        </Text>
      </Pressable>

      {message ? (
        <Text className="mt-3 text-center text-sm text-on-surface-variant" testID="aviso-respaldo">
          {message}
        </Text>
      ) : null}

      <Section>Dónde se guarda</Section>
      <View className="flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Server size={18} color="#6b38d4" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-on-surface">Nuestro servidor</Text>
          <Text className="text-[11px] text-on-surface-variant">
            En la máquina de casa, no en la nube de un tercero.
          </Text>
        </View>
      </View>

      <Section>Cada cuánto</Section>
      <View className="flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <HardDrive size={18} color="#6b38d4" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-on-surface">Todas las noches</Text>
          <Text className="text-[11px] text-on-surface-variant">
            {status ? `Se guardan los últimos 30 días · ${status.count} copias` : '—'}
          </Text>
        </View>
      </View>

      {/* Lo que el respaldo NO cubre se dice acá, y no se calla: enterarse el
          día que hace falta es tarde. */}
      <Text className="mt-6 text-[11px] leading-4 text-on-surface-variant">
        El respaldo guarda tus conversaciones. Las fotos y videos viven en el
        almacenamiento del servidor y se respaldan por separado.
      </Text>
    </ScrollView>
  );
}
