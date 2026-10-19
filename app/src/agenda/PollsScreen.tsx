import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { BarChart3, Plus, RotateCw } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { agendaGet, type AgendaPoll } from './agendaApi';
import { TarjetaDeEncuesta } from './TarjetaDeEncuesta';
import { useAccionesDeEncuesta } from './useAccionesDeEncuesta';
import { useColores } from '../ui/tema';

/**
 * Encuestas (diseño «New Poll», pestaña Encuestas).
 *
 * Los resultados se ven SIEMPRE, no solo después de votar: en un chat familiar
 * esconderlos hasta emitir el voto obliga a votar para poder mirar, que es lo
 * contrario de lo que una encuesta quiere.
 */
export function PollsScreen({
  credential,
  recarga,
  onCreate,
  onCambio,
}: {
  credential: Credential;
  /** Sube al crear una encuesta: se vuelve a pedir SIN esqueleto (17/10/2026). */
  recarga: number;
  onCreate: () => void;
  /** Se votó, cerró o eliminó: cambia el contador de la pestaña. */
  onCambio?: () => void;
}) {
  const colores = useColores();
  const [polls, setPolls] = useState<AgendaPoll[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await agendaGet<{ polls: AgendaPoll[] }>('/polls', credential.jwt);
    // Sin red NO es «sin encuestas»: se conserva lo que había y se dice.
    if (result.ok) {
      setPolls(result.data.polls);
      setFallo(false);
      // Lo que falló antes ya no vale contra la lista nueva.
      acciones.limpiarErrores();
    } else setFallo(true);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load, recarga]);

  const agenda = agendaPorTelefono();
  const reemplazar = (id: string, nueva: AgendaPoll | null) => {
    setPolls((antes) => (antes ?? []).flatMap((poll) => (poll.id !== id ? [poll] : nueva ? [nueva] : [])));
    onCambio?.();
  };
  const { ocupada, errores, votar, cerrar, eliminar, ...acciones } = useAccionesDeEncuesta({
    jwt: credential.jwt,
    yo: credential.userId,
    reemplazar,
    recargar: () => void load(),
  });
  const refresco = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    />
  );

  return (
    <View className="flex-1 bg-background" testID="pantalla-encuestas">
      {fallo ? (
        <Pressable testID="encuestas-error" onPress={() => void load()} className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-error/10 px-4 py-3">
          <RotateCw size={16} color={colores.error} />
          <Text className="flex-1 text-[13px] text-error">No se pudo actualizar. Toca para reintentar.</Text>
        </Pressable>
      ) : null}
      {polls === null && fallo ? null : polls === null ? (
        <View className="px-4 pt-4" testID="encuestas-cargando">
          {[0, 1].map((index) => (
            <View key={index} className="mb-3 h-32 rounded-xl bg-surface-variant" />
          ))}
        </View>
      ) : (polls ?? []).length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={refresco}>
          <View className="flex-1 items-center justify-center px-8" testID="encuestas-vacio">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <BarChart3 size={28} color={colores.primary} />
            </View>
            <Text className="mt-4 text-lg font-semibold text-on-surface">Sin encuestas</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
              Pregúntale algo al grupo y deja que decidan.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          refreshControl={refresco}
        >
          {(polls ?? []).map((poll) => (
            <TarjetaDeEncuesta
              key={poll.id}
              poll={poll}
              yo={credential.userId}
              agenda={agenda}
              ocupada={ocupada === poll.id}
              error={errores[poll.id]}
              onVotar={(indice) => void votar(poll, indice)}
              onCerrar={() => void cerrar(poll)}
              onEliminar={() => void eliminar(poll)}
            />
          ))}
        </ScrollView>
      )}

      <Pressable
        testID="btn-nueva-encuesta"
        onPress={onCreate}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Plus size={24} color={colores["on-primary"]} />
      </Pressable>
    </View>
  );
}
